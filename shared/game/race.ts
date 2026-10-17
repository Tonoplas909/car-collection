// Race model from the design handoff. The client renders the race with `RaceSim`; the server
// re-runs the same fixed-step simulation from the submitted shift steps to produce the result.

export type RaceEventId = 'drag' | 'sprint' | 'run'

export interface RaceEvent {
  id: RaceEventId
  kind: string
  len: number
  place: string
  fee: number
  win: number
  points: number
  note: string
}

export const RACE_EVENTS: RaceEvent[] = [
  { id: 'sprint', kind: 'Sprint', len: 800, place: 'Suzuka East straight', fee: 500, win: 2500, points: 120,
    note: 'Medium length. Gearing and shift timing matter about as much as raw power.' },
  { id: 'drag', kind: 'Drag', len: 402, place: 'Quarter mile, Santa Pod', fee: 300, win: 1500, points: 80,
    note: 'Short and decided early. Light cars with strong low gears do well.' },
  { id: 'run', kind: 'Highway run', len: 1600, place: 'Autobahn A9, closed section', fee: 1000, win: 6000, points: 220,
    note: 'Long enough for top speed to decide it. Perfect shifts still help.' },
]
export const RACE_EVENTS_BY_ID = Object.fromEntries(RACE_EVENTS.map(e => [e.id, e])) as Record<RaceEventId, RaceEvent>

export interface Opponent {
  name: string
  car: string
  /** Asymptotic speed, m/s, for the opponent distance curve */
  vmax: number
  /** Time constant, s */
  tau: number
  /** Finish time relative to the player's perfect run */
  f: number
}

export const OPPONENTS: Opponent[] = [
  { name: 'bayside.r', car: 'Toyota Supra A80', vmax: 72, tau: 8.6, f: 1.03 },
  { name: 'rallye.b', car: 'Lancia Delta Integrale', vmax: 64, tau: 7.4, f: 1.012 },
  { name: 'touge.t', car: 'Honda NSX NA1', vmax: 74, tau: 9.4, f: 1.055 },
]

export const GEARS = 6
export const DT = 1 / 120
export const SHIFT_WINDOW = { start: 0.82, perfect: 0.97 } as const
export const BOOST_TIME = 0.7
export const BOOST_FACTOR = 1.3

export type ShiftQuality = 'Early' | 'Perfect' | 'Late'

export const shiftQuality = (rpm: number): ShiftQuality =>
  rpm < SHIFT_WINDOW.start ? 'Early' : rpm < SHIFT_WINDOW.perfect ? 'Perfect' : 'Late'

export interface RaceCarSpec {
  hp: number
  kg: number
  /** km/h */
  top: number
  level: number
}

export function physics(c: RaceCarSpec) {
  return { vmax: c.top / 3.6, A: (3 + (18 * c.hp) / c.kg) * 1.6 * (1 + 0.02 * c.level) }
}

export interface SimState {
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

/** Fixed-step simulation of the player's car. */
export class RaceSim {
  readonly vmax: number
  readonly A: number
  readonly len: number
  s: SimState

  constructor(car: RaceCarSpec, len: number) {
    const p = physics(car)
    this.vmax = p.vmax
    this.A = p.A
    this.len = len
    this.s = { step: 0, t: 0, d: 0, v: 0, gear: 1, rpm: 0, boost: 0, top: 0, shifts: [], finished: false, finishTime: 0 }
  }

  step() {
    const s = this.s
    if (s.finished) return
    s.step++
    s.t = s.step * DT
    s.rpm = Math.min(1, s.rpm + DT * (1.1 / Math.pow(s.gear, 0.85)))
    const limiter = s.rpm >= 1 ? 0.3 : 1
    const a = this.A * (0.35 + 0.65 * s.rpm) * (1 / Math.pow(s.gear, 0.15)) * Math.max(0, 1 - s.v / this.vmax) * limiter * (s.boost > 0 ? BOOST_FACTOR : 1)
    s.v += a * DT
    s.d += s.v * DT
    s.boost = Math.max(0, s.boost - DT)
    s.top = Math.max(s.top, s.v)
    if (s.d >= this.len) {
      s.finished = true
      s.finishTime = s.t - (s.d - this.len) / Math.max(s.v, 1)
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

const MAX_STEPS = 300 / DT

/** Re-run a race from the steps at which the player shifted (server-side verification). */
export function replay(car: RaceCarSpec, len: number, shiftSteps: number[]): SimState {
  const sim = new RaceSim(car, len)
  const pending = [...shiftSteps].sort((a, b) => a - b)
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    while (pending.length && pending[0] <= sim.s.step) {
      pending.shift()
      sim.shift()
    }
    sim.step()
  }
  return sim.s
}

/** Best achievable time: shift as soon as revs enter the perfect window. */
export function perfectTime(car: RaceCarSpec, len: number): number {
  const sim = new RaceSim(car, len)
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    if (sim.s.gear < GEARS && sim.s.rpm >= 0.9) sim.shift()
    sim.step()
  }
  return sim.s.finishTime || sim.s.t
}

const oppDistRaw = (o: Opponent, t: number) => (t <= 0 ? 0 : o.vmax * (t - o.tau * (1 - Math.exp(-t / o.tau))))

function oppFinishRaw(o: Opponent, len: number) {
  let lo = 0, hi = 200
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2
    if (oppDistRaw(o, m) < len) lo = m
    else hi = m
  }
  return hi
}

/** Opponents time-scaled so a near-perfect run wins narrowly. */
export function calibrateOpponents(car: RaceCarSpec, len: number, opponents: Opponent[] = OPPONENTS) {
  const tp = perfectTime(car, len)
  return opponents.map(o => {
    const k = oppFinishRaw(o, len) / (tp * o.f)
    return {
      ...o,
      finishTime: tp * o.f,
      distanceAt: (t: number) => Math.min(len, oppDistRaw(o, t * k)),
    }
  })
}

export interface RaceRow {
  name: string
  car: string
  time: number
  me: boolean
}

export interface RaceRewards {
  points: number
  credits: number
  xp: number
}

export function raceRewards(ev: RaceEvent, place: number): RaceRewards {
  const won = place === 1
  return {
    points: won ? ev.points : Math.round(ev.points / (place + 1)),
    credits: won ? ev.win : 0,
    xp: 240 - place * 40,
  }
}

export interface ScoredRace {
  rows: RaceRow[]
  place: number
  time: number
  /** m/s */
  top: number
  shifts: ShiftQuality[]
  rewards: RaceRewards
}

/**
 * Score a submitted race: replay the player's shifts, rank against the calibrated opponents and
 * work out the rewards. Shared by the server and the local mock backend.
 */
export function scoreRace(
  car: RaceCarSpec, ev: RaceEvent, shiftSteps: number[],
  player: { name: string; car: string },
  opponents: { name: string; car: string }[] = OPPONENTS,
): ScoredRace {
  const run = replay(car, ev.len, shiftSteps)
  const time = run.finishTime || run.t
  const rows: RaceRow[] = [
    { name: player.name, car: player.car, time, me: true },
    ...calibrateOpponents(car, ev.len).map((o, i) => ({ name: opponents[i]?.name ?? o.name, car: opponents[i]?.car ?? o.car, time: o.finishTime, me: false })),
  ].sort((a, b) => a.time - b.time)
  const place = rows.findIndex(r => r.me) + 1
  return { rows, place, time, top: run.top, shifts: run.shifts, rewards: raceRewards(ev, place) }
}

/** Shift steps must be whole, increasing steps, one per gear change at most. */
export function validShiftSteps(v: unknown): v is number[] {
  return Array.isArray(v) && v.length < GEARS && v.every((n, i) => Number.isInteger(n) && n >= 0 && n <= MAX_STEPS && (i === 0 || n >= v[i - 1]))
}
