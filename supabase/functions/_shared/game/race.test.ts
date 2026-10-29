import { describe, expect, it } from 'vitest'
import { RACE_EVENTS, RACE_EVENTS_BY_ID, raceRewards } from './race.ts'
import { TRACKS, trackLength } from './tracks.ts'

describe('race events', () => {
  it('has one event per circuit, sized from its circuit', () => {
    expect(RACE_EVENTS.map(e => e.id).sort()).toEqual(Object.keys(TRACKS).sort())
    for (const e of RACE_EVENTS) expect(e.len).toBe(trackLength(TRACKS[e.id]))
  })

  it('prices the mountain pass above the circuit', () => {
    expect(RACE_EVENTS_BY_ID.touge).toMatchObject({ fee: 700, win: 3800, points: 160 })
  })

  it('pays the win purse only for first place', () => {
    const ev = RACE_EVENTS_BY_ID.sprint
    expect(raceRewards(ev, 1)).toEqual({ points: 120, credits: 2500, xp: 200 })
    expect(raceRewards(ev, 3)).toEqual({ points: 30, credits: 0, xp: 120 })
  })
})
