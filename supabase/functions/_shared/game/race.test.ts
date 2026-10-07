import { describe, expect, it } from 'vitest'
import { DT, GEARS, RaceSim, calibrateOpponents, perfectTime, raceRewards, replay, shiftQuality, RACE_EVENTS_BY_ID } from './race.ts'

const r34 = { hp: 280, kg: 1560, top: 250, level: 5 }

describe('race model', () => {
  it('classifies shift quality by the rev window', () => {
    expect(shiftQuality(0.5)).toBe('Early')
    expect(shiftQuality(0.82)).toBe('Perfect')
    expect(shiftQuality(0.96)).toBe('Perfect')
    expect(shiftQuality(0.97)).toBe('Late')
  })

  it('replay reproduces a live fixed-step run exactly', () => {
    const live = new RaceSim(r34, 800)
    const shiftSteps: number[] = []
    while (!live.s.finished) {
      if (live.s.gear < GEARS && live.s.rpm >= 0.88) {
        shiftSteps.push(live.s.step)
        live.shift()
      }
      live.step()
    }
    const server = replay(r34, 800, shiftSteps)
    expect(server.finishTime).toBe(live.s.finishTime)
    expect(server.shifts).toEqual(live.s.shifts)
  })

  it('never shifting is slower than shifting perfectly', () => {
    const lazy = replay(r34, 800, [])
    expect(lazy.finishTime).toBeGreaterThan(perfectTime(r34, 800))
  })

  it('a perfect run beats every calibrated opponent, narrowly', () => {
    const tp = perfectTime(r34, 800)
    const opps = calibrateOpponents(r34, 800)
    for (const o of opps) {
      expect(o.finishTime).toBeGreaterThan(tp)
      expect(o.finishTime / tp).toBeLessThan(1.06)
      expect(o.distanceAt(o.finishTime)).toBeCloseTo(800, 0)
    }
  })

  it('simulates in 1/120 s steps', () => {
    const sim = new RaceSim(r34, 402)
    sim.step(); sim.step()
    expect(sim.s.t).toBeCloseTo(2 * DT)
  })

  it('pays the win purse only for first place', () => {
    const ev = RACE_EVENTS_BY_ID.sprint
    expect(raceRewards(ev, 1)).toEqual({ points: 120, credits: 2500, xp: 200 })
    expect(raceRewards(ev, 3)).toEqual({ points: 30, credits: 0, xp: 120 })
  })
})
