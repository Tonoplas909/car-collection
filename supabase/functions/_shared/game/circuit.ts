// Circuit race simulation. The client runs it live with `CircuitSim`; the server rebuilds the same run
// with `replayCircuit` from the brake and nitro steps the player submitted. Fixed step, no randomness.
import { DT, type RaceCarSpec } from './race.ts'
import { isCorner, trackLength, sectorStarts, type Track } from './tracks.ts'
import type { Car } from './types.ts'

/** Every balance constant of the race model, in one place. */
export const TUNING = {
  accelBase: 3, accelPower: 18, accelScale: 1.6, accelLevel: 0.02,
  /** Grip: lighter and more recent cars corner faster. */
  gripBase: 0.75, gripLight: 0.35, gripRecent: 0.1, gripLevel: 0.01, gripMin: 0.75, gripMax: 1.25,
  lightFromKg: 1900, lightSpanKg: 1500, recentFromYear: 1950, recentSpanYears: 75,
  brakeBase: 8, brakeGrip: 4,
  /** 1/s: how fast speed carried into a corner is scrubbed off */
  scrub: 6,
  gravity: 9.81,
}

export const NITRO = { charges: 2, seconds: 2, accel: 1.5, vmax: 1.04 }
export const MAX_RACE_SECONDS = 240
export const MAX_STEPS = Math.round(MAX_RACE_SECONDS / DT)
const MAX_BRAKE_EVENTS = 40
const MAX_NITRO_EVENTS = NITRO.charges

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export interface CarNotes {
  /** Acceleration, m/s² */
  A: number
  /** Top speed, m/s */
  vmax: number
  /** Grip: scales every corner speed */
  G: number
  /** Braking, m/s² */
  B: number
}

export function carNotes(c: RaceCarSpec): CarNotes {
  const T = TUNING
  const lightness = clamp((T.lightFromKg - c.kg) / T.lightSpanKg, 0, 1)
  const recency = clamp((c.year - T.recentFromYear) / T.recentSpanYears, 0, 1)
  const G = clamp(T.gripBase + T.gripLight * lightness + T.gripRecent * recency + T.gripLevel * c.level, T.gripMin, T.gripMax)
  return {
    A: (T.accelBase + (T.accelPower * c.hp) / c.kg) * T.accelScale * (1 + T.accelLevel * c.level),
    vmax: c.top / 3.6,
    G,
    B: T.brakeBase + T.brakeGrip * G,
  }
}

export const raceSpec = (car: Car, level: number): RaceCarSpec => ({ hp: car.hp, kg: car.kg, top: car.top, level, year: car.year })

export type CornerQuality = 'Early' | 'Perfect' | 'Late'

/** `r` is the speed at corner entry over the corner speed. */
export const cornerQuality = (r: number): CornerQuality => (r < 0.93 ? 'Early' : r <= 1.05 ? 'Perfect' : 'Late')

/** What the player did: steps (not seconds) so the server can replay it exactly. */
export interface RaceInputs {
  /** Alternating on/off steps: [on, off, on, off…]. An odd length means the brake was held at the line. */
  brake: number[]
  /** Steps at which nitro was fired */
  nitro: number[]
}

export interface CircuitState {
  step: number
  t: number
  d: number
  v: number
  sector: number
  braking: boolean
  nitroLeft: number
  /** Seconds of boost remaining */
  nitroT: number
  top: number
  corners: CornerQuality[]
  /** Duration of each completed sector, seconds */
  splits: number[]
  finished: boolean
  finishTime: number
}

export class CircuitSim {
  readonly notes: CarNotes
  readonly track: Track
  readonly length: number
  s: CircuitState
  private starts: number[]
  private sectorStartT = 0

  constructor(spec: RaceCarSpec, track: Track) {
    this.notes = carNotes(spec)
    this.track = track
    this.length = trackLength(track)
    this.starts = sectorStarts(track)
    this.s = {
      step: 0, t: 0, d: 0, v: 0, sector: 0, braking: false, nitroLeft: NITRO.charges, nitroT: 0, top: 0,
      corners: [], splits: [], finished: false, finishTime: 0,
    }
    this.enter(0)
  }

  private enter(i: number) {
    const sec = this.track.sectors[i]
    if (isCorner(sec)) this.s.corners.push(cornerQuality(this.s.v / (sec.vRef! * this.notes.G)))
  }

  step() {
    const s = this.s
    if (s.finished) return
    const { A, vmax, G, B } = this.notes
    const sec = this.track.sectors[s.sector]
    s.step++
    s.t = s.step * DT

    const boosted = s.nitroT > 0 && !s.braking
    const vc = isCorner(sec) ? sec.vRef! * G : Infinity
    if (s.braking) {
      s.v -= B * DT
    } else {
      const a = A * (boosted ? NITRO.accel : 1) * Math.max(0, 1 - s.v / (vmax * (boosted ? NITRO.vmax : 1))) - TUNING.gravity * (sec.grade ?? 0)
      s.v = Math.min(s.v + a * DT, Math.max(s.v, vc))
    }
    if (s.v > vc) s.v -= TUNING.scrub * (s.v - vc) * DT
    s.v = Math.max(0, s.v)
    s.nitroT = Math.max(0, s.nitroT - DT)
    s.d += s.v * DT
    s.top = Math.max(s.top, s.v)

    while (s.sector + 1 < this.starts.length && s.d >= this.starts[s.sector + 1]) {
      s.splits.push(s.t - this.sectorStartT)
      this.sectorStartT = s.t
      s.sector++
      this.enter(s.sector)
    }
    if (s.d >= this.length) {
      s.finished = true
      s.finishTime = s.t - (s.d - this.length) / Math.max(s.v, 1)
      s.splits.push(s.finishTime - this.sectorStartT)
    }
  }

  setBrake(on: boolean) {
    if (!this.s.finished) this.s.braking = on
  }

  /** Fire nitro. False when no charge is left or a boost is already running. */
  useNitro(): boolean {
    const s = this.s
    if (s.finished || s.nitroLeft <= 0 || s.nitroT > 0) return false
    s.nitroLeft--
    s.nitroT = NITRO.seconds
    return true
  }
}

/** Re-run a race from the steps at which the player braked and fired nitro (server-side verification). */
export function replayCircuit(spec: RaceCarSpec, track: Track, inputs: RaceInputs): CircuitState {
  const sim = new CircuitSim(spec, track)
  let b = 0, n = 0
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    while (b < inputs.brake.length && inputs.brake[b] <= sim.s.step) sim.setBrake(b++ % 2 === 0)
    while (n < inputs.nitro.length && inputs.nitro[n] <= sim.s.step) { n++; sim.useNitro() }
    sim.step()
  }
  return sim.s
}

const stepsOk = (v: unknown, max: number): v is number[] =>
  Array.isArray(v) && v.length <= max && v.every((n, i) => Number.isInteger(n) && n >= 0 && n <= MAX_STEPS && (i === 0 || n >= v[i - 1]))

export function validRaceInputs(v: unknown): v is RaceInputs {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const { brake, nitro } = v as Record<string, unknown>
  return stepsOk(brake, MAX_BRAKE_EVENTS) && stepsOk(nitro, MAX_NITRO_EVENTS)
}

/** Turns key and button events into the steps the server replays, driving the sim as it records. */
export class RaceInputRecorder {
  readonly inputs: RaceInputs = { brake: [], nitro: [] }
  private sim: CircuitSim

  constructor(sim: CircuitSim) {
    this.sim = sim
  }

  press() {
    const { s } = this.sim
    if (s.braking || s.finished || this.inputs.brake.length >= MAX_BRAKE_EVENTS - 1) return
    this.inputs.brake.push(s.step)
    this.sim.setBrake(true)
  }

  release() {
    const { s } = this.sim
    if (!s.braking) return
    this.inputs.brake.push(s.step)
    this.sim.setBrake(false)
  }

  nitro() {
    const step = this.sim.s.step
    if (this.sim.useNitro()) this.inputs.nitro.push(step)
  }

  /** Window blurred or finger lifted off the screen: the brake must not stay on. */
  releaseAll() {
    this.release()
  }
}
