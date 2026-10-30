import { describe, expect, it } from 'vitest'
import { CARS_BY_ID, CATALOG } from './catalog.ts'
import { MAX_RACE_SECONDS, MAX_STEPS, raceSpec, validRaceInputs } from './circuit.ts'
import {
  BOOST_FACTOR, BOOST_TIME, DRAG_LENGTH, DragSim, GEARS, GEAR_FACTOR, RPM_RATE, SHIFT_WINDOW, autoShift, replayDrag, shiftQuality,
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

  it('classifies shift quality by the rev window', () => {
    expect(shiftQuality(0.5)).toBe('Early')
    expect(shiftQuality(SHIFT_WINDOW.start)).toBe('Perfect')
    expect(shiftQuality(0.96)).toBe('Perfect')
    expect(shiftQuality(SHIFT_WINDOW.perfect)).toBe('Late')
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

  it('a perfect shift boosts the next 0.7 s, an early one does not', () => {
    const after = (rpm: number) => {
      const sim = new DragSim(r34)
      sim.s.gear = 1
      sim.s.rpm = rpm
      sim.s.v = 20
      sim.shift()
      const v0 = sim.s.v
      for (let i = 0; i < Math.round(BOOST_TIME / DT); i++) sim.step()
      return sim.s.v - v0
    }
    expect(BOOST_FACTOR).toBe(1.3)
    expect(after(0.9)).toBeGreaterThan(after(0.5) * 1.1)
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
