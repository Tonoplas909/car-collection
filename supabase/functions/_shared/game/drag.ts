// Drag: a straight quarter mile with a manual gearbox. Revs climb in each gear and the player shifts up
// when they enter the window: a perfect shift gives a short boost. Same idea as the circuits: the client runs
// `DragSim` live, the server rebuilds the run from the steps at which the player shifted.
import { MAX_STEPS, TUNING, carNotes, type CornerQuality } from './circuit.ts'
import { DT, type RaceCarSpec } from './race.ts'
import { DRAG_TRACK, trackLength } from './tracks.ts'
import type { Rng } from './types.ts'

export const DRAG_LENGTH = trackLength(DRAG_TRACK)
export const GEARS = 6
/** Shifting with revs from `start` up to `perfect` is a perfect shift; above it the shift is late. */
export const SHIFT_WINDOW = { start: 0.82, perfect: 0.97 } as const
export const BOOST_TIME = 0.7
export const BOOST_FACTOR = 1.3

/** Revs per second in each gear (1.1 / gear^0.85) and the power factor of each gear (1 / gear^0.15), index = gear. */
export const RPM_RATE = [0, 1.1, 0.6102632096373148, 0.4323541367498344, 0.338564713669852, 0.2800710254202132, 0.23986347562993135]
export const GEAR_FACTOR = [0, 1, 0.9012504626108302, 0.8480702172136835, 0.8122523963562355, 0.7855150302317644, 0.7643236755902996]

/** Same three values as the circuit corners: too soon, in the window, too late. */
export type ShiftQuality = CornerQuality

export const shiftQuality = (rpm: number): ShiftQuality => (rpm < SHIFT_WINDOW.start ? 'Early' : rpm < SHIFT_WINDOW.perfect ? 'Perfect' : 'Late')

export interface DragState {
  step: number
  t: number
  d: number
  v: number
  gear: number
  rpm: number
  boost: number
  top: number
  shifts: ShiftQuality[]
  finished: boolean
  finishTime: number
}

/** Fixed-step simulation of one car on the strip. */
export class DragSim {
  readonly vmax: number
  readonly A: number
  s: DragState

  constructor(spec: RaceCarSpec) {
    const n = carNotes(spec)
    this.vmax = n.vmax
    this.A = n.A
    this.s = { step: 0, t: 0, d: 0, v: 0, gear: 1, rpm: 0, boost: 0, top: 0, shifts: [], finished: false, finishTime: 0 }
  }

  step() {
    const s = this.s
    if (s.finished) return
    s.step++
    s.t = s.step * DT
    s.rpm = Math.min(1, s.rpm + DT * RPM_RATE[s.gear])
    const limiter = s.rpm >= 1 ? 0.3 : 1
    const a = this.A * (0.35 + 0.65 * s.rpm) * GEAR_FACTOR[s.gear] * Math.max(0, 1 - s.v / this.vmax) * limiter * (s.boost > 0 ? BOOST_FACTOR : 1)
    s.v += a * DT
    s.d += s.v * DT
    s.boost = Math.max(0, s.boost - DT)
    s.top = Math.max(s.top, s.v)
    if (s.d >= DRAG_LENGTH) {
      s.finished = true
      s.finishTime = s.t - (s.d - DRAG_LENGTH) / Math.max(s.v, 1)
    }
  }

  /** Shift up. Returns the quality, or null when no shift is possible. */
  shift(): ShiftQuality | null {
    const s = this.s
    if (s.finished || s.gear >= GEARS) return null
    const q = shiftQuality(s.rpm)
    s.gear++
    s.rpm = Math.max(0.3, s.rpm * 0.55)
    s.boost = q === 'Perfect' ? BOOST_TIME : 0
    s.shifts.push(q)
    return q
  }
}

/** Re-run a drag from the steps at which the player shifted (server-side verification). */
export function replayDrag(spec: RaceCarSpec, shiftSteps: number[], onStep?: (s: DragState) => void): DragState {
  const sim = new DragSim(spec)
  let i = 0
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    while (i < shiftSteps.length && shiftSteps[i] <= sim.s.step) { i++; sim.shift() }
    sim.step()
    onStep?.(sim.s)
  }
  return sim.s
}

/**
 * Autopilot: shifts when the revs reach a target in the middle of the window. Per gear the target is off by up to
 * `skill` (scaled by TUNING.shiftError), so a high skill value misses the window now and then.
 */
export function autoShift(spec: RaceCarSpec, rng: Rng, skill: number): number[] {
  const sim = new DragSim(spec)
  const targets = Array.from({ length: GEARS - 1 }, () => 0.895 + (rng() * 2 - 1) * skill * TUNING.shiftError)
  const steps: number[] = []
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    if (sim.s.gear < GEARS && sim.s.rpm >= targets[sim.s.gear - 1]) { steps.push(sim.s.step); sim.shift() }
    sim.step()
  }
  return steps
}
