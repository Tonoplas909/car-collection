import { describe, expect, it } from 'vitest'
import { CARS_BY_ID, CATALOG } from './catalog.ts'
import { MAX_RACE_SECONDS, MAX_STEPS, raceSpec, validRaceInputs } from './circuit.ts'
import {
  DRAG_LENGTH, DragSim, GEARS, GEAR_FACTOR, RPM_RATE, SHIFT_BANDS, SHIFT_BOOST, autoShift, replayDrag, shiftQuality,
} from './drag.ts'
import { seededRng } from './opponents.ts'
import { DT, RACE_EVENTS_BY_ID, raceRewards } from './race.ts'
import { TIERS } from './types.ts'
import { opponentTraces, scoreRace } from './scoring.ts'

const r34 = { hp: 280, kg: 1560, top: 250, level: 5, year: 1999 }
const spec = (id: string) => raceSpec(CARS_BY_ID[id], 0)

/** Finish time of `carId` shifted by the autopilot at `skill` (0 = right in the middle of the window). */
function run(carId: string, skill = 0, seed = 's') {
  const s = spec(carId)
  const d = replayDrag(s, autoShift(s, seededRng(seed), skill))
  return d.finishTime || d.t
}

describe('drag model', () => {
  it('is a quarter mile', () => {
    expect(DRAG_LENGTH).toBe(402)
  })

  it('has gear tables that match their formulas, written out so every engine agrees', () => {
    for (let g = 1; g <= GEARS; g++) {
      expect(RPM_RATE[g]).toBeCloseTo(1.1 / Math.pow(g, 0.85), 12)
      expect(GEAR_FACTOR[g]).toBeCloseTo(1 / Math.pow(g, 0.15), 12)
    }
  })

  it('rates a shift by how close the revs are to the middle of the window', () => {
    expect(shiftQuality(0.5)).toBe('Early')
    expect(shiftQuality(0.7)).toBe('Early')
    expect(shiftQuality(0.8)).toBe('OK')
    expect(shiftQuality(0.85)).toBe('Great')
    expect(shiftQuality(0.9)).toBe('Perfect')
    expect(shiftQuality(0.92)).toBe('Perfect')
    expect(shiftQuality(0.96)).toBe('Great')
    expect(shiftQuality(0.99)).toBe('OK')
    expect(shiftQuality(1)).toBe('Late')
  })

  it('has a Perfect band that is narrow, inside a Great band, inside an OK band', () => {
    expect(SHIFT_BANDS.perfect).toBeLessThan(SHIFT_BANDS.great)
    expect(SHIFT_BANDS.great).toBeLessThan(SHIFT_BANDS.ok)
    expect(SHIFT_BANDS.perfect * 2).toBeLessThanOrEqual(0.08)
    expect(SHIFT_BANDS.center - SHIFT_BANDS.ok).toBeGreaterThan(0.7)
    expect(SHIFT_BANDS.center + SHIFT_BANDS.ok).toBeGreaterThanOrEqual(1)
  })

  it('simulates in 1/120 s steps', () => {
    const sim = new DragSim(r34)
    sim.step(); sim.step()
    expect(sim.s.t).toBeCloseTo(2 * DT)
  })

  it('replay reproduces a live run exactly', () => {
    const live = new DragSim(r34)
    const steps: number[] = []
    while (!live.s.finished) {
      if (live.s.gear < GEARS && live.s.rpm >= 0.88) { steps.push(live.s.step); live.shift() }
      live.step()
    }
    const server = replayDrag(r34, steps)
    expect(server.finishTime).toBe(live.s.finishTime)
    expect(server.shifts).toEqual(live.s.shifts)
    expect(server.top).toBe(live.s.top)
  })

  it('boosts less the further the shift is from the middle, and not at all outside the window', () => {
    const gain = (rpm: number) => {
      const sim = new DragSim(r34)
      sim.s.rpm = rpm
      sim.s.v = 20
      sim.shift()
      const v0 = sim.s.v
      for (let i = 0; i < Math.round(SHIFT_BOOST.Perfect.time / DT); i++) sim.step()
      return sim.s.v - v0
    }
    expect(SHIFT_BOOST.Perfect).toEqual({ time: 0.7, factor: 1.3 })
    expect(SHIFT_BOOST.Great.factor).toBeLessThan(SHIFT_BOOST.Perfect.factor)
    expect(SHIFT_BOOST.OK.factor).toBeLessThan(SHIFT_BOOST.Great.factor)
    expect(SHIFT_BOOST.Early).toEqual({ time: 0, factor: 1 })
    expect(SHIFT_BOOST.Late).toEqual({ time: 0, factor: 1 })
    expect(gain(0.9)).toBeGreaterThan(gain(0.85))
    expect(gain(0.85)).toBeGreaterThan(gain(0.8))
    expect(gain(0.8)).toBeGreaterThan(gain(0.5))
  })

  it('the autopilot with no error shifts Perfect every time', () => {
    for (const id of ['toyota-supra-a80', 'bugatti-chiron', 'mini-cooper-s']) {
      const s = spec(id)
      const d = replayDrag(s, autoShift(s, seededRng('p'), 0))
      expect(d.shifts.length, id).toBeGreaterThan(0)
      expect(d.shifts.every(q => q === 'Perfect'), id).toBe(true)
    }
  })

  it('never shifting is slower than shifting in the window, and still finishes', () => {
    const lazy = replayDrag(r34, [])
    expect(lazy.finished).toBe(true)
    expect(lazy.finishTime).toBeGreaterThan(run('toyota-supra-a80') * 0.9)
    const s = spec('toyota-supra-a80')
    expect(replayDrag(s, []).finishTime).toBeGreaterThan(replayDrag(s, autoShift(s, seededRng('x'), 0)).finishTime)
  })

  it('a sloppier driver is slower', () => {
    const t0 = run('caterham-seven-620r', 0)
    expect(run('caterham-seven-620r', 0.1)).toBeGreaterThanOrEqual(t0 - 1e-9)
    expect(run('caterham-seven-620r', 0.3)).toBeGreaterThanOrEqual(run('caterham-seven-620r', 0.1) - 1e-9)
    expect(run('caterham-seven-620r', 0.6)).toBeGreaterThan(t0 * 1.03)
  })
})

describe('the car matters on a straight line', () => {
  it('power-to-weight decides it', () => {
    expect(run('bugatti-chiron')).toBeLessThan(run('lotus-elise-s1'))
    expect(run('bugatti-chiron')).toBeLessThan(run('tesla-model-s-plaid'))
    expect(run('lotus-elise-s1')).toBeLessThan(run('mini-cooper-s'))
  })

  it('every catalog car finishes with and without shifting before the cap', () => {
    for (const c of CATALOG) {
      const s = raceSpec(c, 0)
      expect(replayDrag(s, []).finished, c.id).toBe(true)
      expect(run(c.id), c.id).toBeLessThan(MAX_RACE_SECONDS)
    }
  })
})

describe('shift inputs', () => {
  it('are optional and checked like the other inputs', () => {
    expect(validRaceInputs({ brake: [], nitro: [] })).toBe(true)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [] })).toBe(true)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [100, 300, 500, 700, 900] })).toBe(true)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [1, 2, 3, 4, 5, 6] })).toBe(false)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [-1] })).toBe(false)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [5, 2] })).toBe(false)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [1.5] })).toBe(false)
    expect(validRaceInputs({ brake: [], nitro: [], shift: [MAX_STEPS + 1] })).toBe(false)
    expect(validRaceInputs({ brake: [], nitro: [], shift: 'x' })).toBe(false)
  })
})

describe('drag opponents', () => {
  it('are three real cars driven by the autopilot, repeatable, and reach the line', () => {
    const car = CARS_BY_ID['toyota-supra-a80']
    const a = opponentTraces('drag-1', car, 'drag')
    expect(a).toHaveLength(3)
    expect(opponentTraces('drag-1', car, 'drag').map(o => o.finishTime)).toEqual(a.map(o => o.finishTime))
    for (const o of a) {
      expect(o.distanceAt(0)).toBe(0)
      expect(o.distanceAt(o.finishTime / 2)).toBeGreaterThan(0)
      expect(o.distanceAt(o.finishTime + 5)).toBe(DRAG_LENGTH)
      expect(o.finishTime).toBeLessThan(MAX_RACE_SECONDS)
    }
  })
})

describe('drag scoring', () => {
  const car = CARS_BY_ID['toyota-supra-a80']
  const args = (shift: number[]) => ({ raceId: 'abc', car, level: 2, eventId: 'drag' as const, inputs: { brake: [], nitro: [], shift }, player: { name: 'You · tester' } })

  it('ranks four drivers on the drag rewards and reports the quality of each shift', () => {
    const shift = autoShift(raceSpec(car, 2), seededRng('p'), 0)
    const r = scoreRace(args(shift))
    expect(r.rows).toHaveLength(4)
    expect(r.rows.filter(x => x.me)).toHaveLength(1)
    expect([...r.rows].sort((a, b) => a.time - b.time)).toEqual(r.rows)
    expect(r.rewards).toEqual(raceRewards(RACE_EVENTS_BY_ID.drag, r.place))
    expect(r.corners).toHaveLength(GEARS - 1)
    expect(r.corners.every(q => q === 'Perfect')).toBe(true)
    expect(r.splits).toEqual([])
    expect(r.nitroUsed).toBe(0)
    expect(scoreRace(args(shift))).toEqual(r)
  })

  it('a driver who never shifts still finishes, with finite numbers', () => {
    const r = scoreRace(args([]))
    expect(r.time).toBeLessThan(MAX_RACE_SECONDS)
    expect(r.corners).toEqual([])
    expect(Number.isFinite(r.top)).toBe(true)
  })

  it('is neither trivial nor hopeless for a driver who shifts well, and low for a sloppy one', () => {
    const middle = TIERS.map(tier => {
      const cars = CATALOG.filter(c => c.tier === tier).map(c => ({ c, t: run(c.id) })).sort((a, b) => a.t - b.t)
      return cars[Math.floor(cars.length / 2)].c
    })
    const rate = (skill: number) => {
      let wins = 0, n = 0
      for (const c of middle) {
        for (let i = 0; i < 40; i++) {
          const raceId = `race-${i}`
          wins += run(c.id, skill, raceId) < Math.min(...opponentTraces(raceId, c, 'drag').map(o => o.finishTime)) ? 1 : 0
          n++
        }
      }
      return wins / n
    }
    const skilled = rate(0), sloppy = rate(0.5)
    expect(skilled).toBeGreaterThanOrEqual(0.15)
    expect(skilled).toBeLessThanOrEqual(0.9)
    expect(sloppy).toBeLessThanOrEqual(0.1)
    expect(skilled).toBeGreaterThan(sloppy + 0.1)
  })
})
