// Circuit race simulation. The client runs it live with `CircuitSim`; the server rebuilds the same run
// with `replayCircuit` from the brake and nitro steps the player submitted. Fixed step, no randomness.
import { DT, type RaceCarSpec } from './race.ts'
import { isCorner, trackLength, sectorStarts, type Sector, type Track } from './tracks.ts'
import type { Car, Rng } from './types.ts'

/** Every balance constant of the race model, in one place. */
export const TUNING = {
  accelBase: 3, accelPower: 18, accelScale: 1.6, accelLevel: 0.02,
  /** Grip: lighter and more recent cars corner faster. */
  gripBase: 0.75, gripLight: 0.5, gripRecent: 0.1, gripLevel: 0.01, gripMin: 0.75, gripMax: 1.4,
  lightFromKg: 1900, lightSpanKg: 1500, recentFromYear: 1950, recentSpanYears: 75,
  brakeBase: 8, brakeGrip: 4,
  /** 1/s: how fast speed carried into a corner is scrubbed off */
  scrub: 6,
  /**
   * Entering a corner above 1.05 × its speed (r) is a slide: speed drops to vc · max(slideFloor, 1 − slide · (r − 1.05))
   * and the car cannot accelerate for `slideSeconds` per `slideSpan` of excess, at most `slideMaxSeconds`. Without
   * it, braking late would be free.
   */
  slide: 2.5, slideFloor: 0.2, slideSeconds: 1.5, slideSpan: 0.5, slideMaxSeconds: 6,
  /**
   * Braking assist: with the brake held and a corner ahead, the car slows to the corner speed by the corner, braking
   * as hard as needed, between brakeSoft × B (pressed very early) and brakeHard × B (pressed late). Past that it slides.
   */
  brakeSoft: 0.3, brakeHard: 1.5,
  /** Autopilot: how far off the ideal braking distance one unit of `skill` puts it (a fraction of that distance) */
  aiError: 4,
  /** Drag autopilot: how far off the middle of the shift window one unit of `skill` puts it (rev fraction) */
  shiftError: 1.5,
  gravity: 9.81,
}

export const NITRO = { charges: 2, seconds: 2, accel: 1.5, vmax: 1.04 }
export const MAX_RACE_SECONDS = 240
export const MAX_STEPS = Math.round(MAX_RACE_SECONDS / DT)
const MAX_BRAKE_EVENTS = 400
const MAX_NITRO_EVENTS = NITRO.charges
/** Drag: one shift per gear change, from 1st to 6th */
const MAX_SHIFT_EVENTS = 5

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

/** Entry speed over the corner speed: the Perfect band, and the speed the corner cue aims for inside it. */
export const ENTRY_WINDOW = { low: 0.93, aim: 1, high: 1.05 }

/** `r` is the speed at corner entry over the corner speed. */
export const cornerQuality = (r: number): CornerQuality => (r < ENTRY_WINDOW.low ? 'Early' : r <= ENTRY_WINDOW.high ? 'Perfect' : 'Late')

/** What the screen shows for the next corner: the green zone and when to start braking. Speeds in m/s. */
export interface CornerCue {
  low: number
  aim: number
  high: number
  /** Metres until the braking point for the current speed; 0 or less means brake now. */
  toBrake: number
}

export function cornerCue(notes: CarNotes, corner: Sector, v: number, dist: number): CornerCue {
  const vc = corner.vRef! * notes.G
  const aim = vc * ENTRY_WINDOW.aim
  return { low: vc * ENTRY_WINDOW.low, aim, high: vc * ENTRY_WINDOW.high, toBrake: dist - (v > aim ? (v * v - aim * aim) / (2 * notes.B) : 0) }
}

export type CueAdvice = 'go' | 'brake' | 'release'

/** Braking this far before the braking point, already down to the corner speed, is just slow: let go and go again. */
const EARLY_BRAKE_M = 60

/**
 * Brake from the braking point until the corner starts (the assist holds the corner speed), then let go.
 * `cue` is for the next corner ahead, null when there is none; `inCorner` says the car is in a corner now.
 */
export function cueAdvice(cue: CornerCue | null, v: number, braking: boolean, inCorner: boolean): CueAdvice {
  if (!cue) return braking ? 'release' : 'go'
  if (v > cue.aim && cue.toBrake <= 0) return 'brake'
  if (braking && !inCorner) return v <= cue.aim && cue.toBrake > EARLY_BRAKE_M ? 'release' : 'brake'
  return braking ? 'release' : 'go'
}

/** What the player did: steps (not seconds) so the server can replay it exactly. */
export interface RaceInputs {
  /** Alternating on/off steps: [on, off, on, off…]. An odd length means the brake was held at the line. */
  brake: number[]
  /** Steps at which nitro was fired */
  nitro: number[]
  /** Drag only: the steps at which the player shifted up */
  shift?: number[]
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
  /** Seconds left in a slide (no acceleration) */
  slide: number
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
  /** For each sector, the corner that comes next after it (-1 when none): what the braking assist holds the speed at. */
  private cornerAfter: number[]
  private sectorStartT = 0

  constructor(spec: RaceCarSpec, track: Track) {
    this.notes = carNotes(spec)
    this.track = track
    this.length = trackLength(track)
    this.starts = sectorStarts(track)
    this.cornerAfter = track.sectors.map((_, i) => track.sectors.findIndex((x, j) => j > i && isCorner(x)))
    this.s = {
      step: 0, t: 0, d: 0, v: 0, sector: 0, braking: false, nitroLeft: NITRO.charges, nitroT: 0, slide: 0, top: 0,
      corners: [], splits: [], finished: false, finishTime: 0,
    }
    this.enter(0)
  }

  private enter(i: number) {
    const sec = this.track.sectors[i]
    if (!isCorner(sec)) return
    const vc = sec.vRef! * this.notes.G
    const r = this.s.v / vc
    const joined = i > 0 && isCorner(this.track.sectors[i - 1])
    const q = cornerQuality(r)
    // Corners that follow each other leave no room to speed up, so entering slowly is not a mistake there.
    this.s.corners.push(joined && q === 'Early' ? 'Perfect' : q)
    if (r > ENTRY_WINDOW.high) {
      const x = r - ENTRY_WINDOW.high
      this.s.v = vc * Math.max(TUNING.slideFloor, 1 - TUNING.slide * x)
      this.s.slide = Math.min(TUNING.slideMaxSeconds, (TUNING.slideSeconds * x) / TUNING.slideSpan)
    }
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
      const next = this.cornerAfter[s.sector]
      if (next < 0) {
        s.v -= B * DT
      } else {
        // Braking assist: slow to the speed of the next corner by the time it starts, and hold it, never below
        const aim = this.track.sectors[next].vRef! * G * ENTRY_WINDOW.aim
        if (s.v > aim) {
          const dist = this.starts[next] - s.d
          const need = dist > 0.5 ? (s.v * s.v - aim * aim) / (2 * dist) : Infinity
          s.v = Math.max(s.v - Math.min(Math.max(need, TUNING.brakeSoft * B), TUNING.brakeHard * B) * DT, aim)
        }
      }
    } else if (s.slide <= 0) {
      const a = A * (boosted ? NITRO.accel : 1) * Math.max(0, 1 - s.v / (vmax * (boosted ? NITRO.vmax : 1))) - TUNING.gravity * (sec.grade ?? 0)
      s.v = Math.min(s.v + a * DT, Math.max(s.v, vc))
    }
    if (s.v > vc) s.v -= TUNING.scrub * (s.v - vc) * DT
    s.v = Math.max(0, s.v)
    s.nitroT = Math.max(0, s.nitroT - DT)
    s.slide = Math.max(0, s.slide - DT)
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
export function replayCircuit(spec: RaceCarSpec, track: Track, inputs: RaceInputs, onStep?: (s: CircuitState) => void): CircuitState {
  const sim = new CircuitSim(spec, track)
  let b = 0, n = 0
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    while (b < inputs.brake.length && inputs.brake[b] <= sim.s.step) sim.setBrake(b++ % 2 === 0)
    while (n < inputs.nitro.length && inputs.nitro[n] <= sim.s.step) { n++; sim.useNitro() }
    sim.step()
    onStep?.(sim.s)
  }
  return sim.s
}

const stepsOk = (v: unknown, max: number): v is number[] =>
  Array.isArray(v) && v.length <= max && v.every((n, i) => Number.isInteger(n) && n >= 0 && n <= MAX_STEPS && (i === 0 || n >= v[i - 1]))

export function validRaceInputs(v: unknown): v is RaceInputs {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const { brake, nitro, shift } = v as Record<string, unknown>
  return stepsOk(brake, MAX_BRAKE_EVENTS) && stepsOk(nitro, MAX_NITRO_EVENTS) && (shift === undefined || stepsOk(shift, MAX_SHIFT_EVENTS))
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

/**
 * Autopilot: the opponents' driver and the ideal line for tests and tuning. It presses the brake where the car can
 * still just reach the corner speed (brakeHard) and holds it until the corner starts. Per corner it is off by up
 * to `skill` (a fraction of the braking distance, early or late), and it fires nitro on long sections.
 */
export function autoDrive(spec: RaceCarSpec, track: Track, rng: Rng, skill: number): RaceInputs {
  const sim = new CircuitSim(spec, track)
  const rec = new RaceInputRecorder(sim)
  const starts = sectorStarts(track)
  const { sectors } = track
  const { G, B } = sim.notes
  const err = sectors.map(s => (isCorner(s) ? (rng() * 2 - 1) * skill * TUNING.aiError : 0))
  let holding = -1
  let boosted = -1
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    const { sector, v, d } = sim.s
    const j = sectors.findIndex((x, i) => i > sector && isCorner(x))
    if (holding >= 0 && sector >= holding) holding = -1
    if (j >= 0 && holding < 0) {
      const aim = sectors[j].vRef! * G * ENTRY_WINDOW.aim
      const needed = v > aim ? (v * v - aim * aim) / (2 * B * TUNING.brakeHard) : 0
      if (v > aim && starts[j] - d <= needed * Math.max(0, 1 + err[j])) holding = j
    }
    if (holding >= 0) rec.press(); else rec.release()
    if (!isCorner(sectors[sector]) && sectors[sector].len >= 150 && boosted !== sector) { boosted = sector; rec.nitro() }
    sim.step()
  }
  rec.releaseAll()
  return rec.inputs
}
