import { describe, expect, it } from 'vitest'
import { CARS_BY_ID, CATALOG } from './catalog.ts'
import { MAX_RACE_SECONDS, autoDrive, raceSpec, replayCircuit } from './circuit.ts'
import { OPPONENT_NAMES, opponentsFor, seededRng } from './opponents.ts'
import { RACE_EVENTS_BY_ID, raceRewards } from './race.ts'
import { opponentTraces, scoreCircuitRace } from './scoring.ts'
import { TRACKS, type TrackId } from './tracks.ts'
import { TIERS } from './types.ts'

const IDS = Object.keys(TRACKS) as TrackId[]

/** Finish time of `car` driven by the autopilot at `skill` (0 = ideal line). */
function drive(carId: string, track: TrackId, skill = 0, seed = 's', level = 0) {
  const spec = raceSpec(CARS_BY_ID[carId], level)
  const s = replayCircuit(spec, TRACKS[track], autoDrive(spec, TRACKS[track], seededRng(seed), skill))
  return s.finishTime || s.t
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

describe('opponents', () => {
  it('are the same for the same race id and never the player car', () => {
    for (const tier of TIERS) {
      const car = CATALOG.find(c => c.tier === tier)!
      const a = opponentsFor('race-1', car)
      expect(opponentsFor('race-1', car)).toEqual(a)
      expect(a).toHaveLength(3)
      expect(new Set(a.map(o => o.car.id)).size).toBe(3)
      expect(new Set(a.map(o => o.name)).size).toBe(3)
      expect(a.every(o => o.car.tier === tier && o.car.id !== car.id)).toBe(true)
      expect(a.map(o => o.skill).sort()).toEqual([0.04, 0.08, 0.12])
    }
  })

  it('differ from one race to the next, and have a handle list to draw from', () => {
    const car = CARS_BY_ID['caterham-seven-620r']
    const lineups = new Set(Array.from({ length: 20 }, (_, i) => opponentsFor(`r${i}`, car).map(o => o.car.id).join()))
    expect(lineups.size).toBeGreaterThan(1)
    expect(OPPONENT_NAMES.length).toBeGreaterThanOrEqual(12)
    expect(OPPONENT_NAMES).toEqual(expect.arrayContaining(['bayside.r', 'rallye.b', 'touge.t']))
  })

  it('seeded generators repeat and stay in [0, 1)', () => {
    const a = seededRng('x'), b = seededRng('x')
    const xs = Array.from({ length: 50 }, () => a())
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()))
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true)
    expect(seededRng('y')()).not.toBe(xs[0])
  })
})

describe('driving skill', () => {
  it('a sloppier driver is slower', () => {
    for (const track of ['touge', 'sprint'] as TrackId[]) {
      const t0 = drive('caterham-seven-620r', track, 0)
      expect(drive('caterham-seven-620r', track, 0.1)).toBeGreaterThanOrEqual(t0 - 1e-9)
      expect(drive('caterham-seven-620r', track, 0.3)).toBeGreaterThanOrEqual(drive('caterham-seven-620r', track, 0.1) - 1e-9)
      expect(drive('caterham-seven-620r', track, 0.5)).toBeGreaterThan(t0 * 1.05)
    }
  })

  it('never braking is clearly slower than braking at the right point', () => {
    for (const carId of ['caterham-seven-620r', 'bugatti-chiron', 'tesla-model-s-plaid']) {
      for (const track of IDS) {
        const spec = raceSpec(CARS_BY_ID[carId], 0)
        const none = replayCircuit(spec, TRACKS[track], { brake: [], nitro: [] })
        expect(none.finished).toBe(true)
        expect(none.finishTime, `${carId} ${track}`).toBeGreaterThan(drive(carId, track) * 1.05)
      }
    }
  })
})

describe('the car matters', () => {
  it('trades places with the circuit', () => {
    // A light 118 hp roadster against a 1,479 hp hypercar
    expect(drive('bugatti-chiron', 'drag')).toBeLessThan(drive('lotus-elise-s1', 'drag'))
    expect(drive('bugatti-chiron', 'run')).toBeLessThan(drive('lotus-elise-s1', 'run'))
    expect(drive('lotus-elise-s1', 'touge')).toBeLessThan(drive('bugatti-chiron', 'touge'))
    expect(drive('lotus-elise-s1', 'touge')).toBeLessThan(drive('tesla-model-s-plaid', 'touge'))
  })
})

describe('race length', () => {
  const all = IDS.map(track => ({
    track,
    ideal: CATALOG.map(c => ({ c, t: drive(c.id, track) })),
    idle: CATALOG.map(c => {
      const s = replayCircuit(raceSpec(c, 0), TRACKS[track], { brake: [], nitro: [] })
      return { finished: s.finished, t: s.finishTime }
    }),
  }))

  it('a median car takes 35 to 55 s on every circuit, and 25 to 75 s within each tier', () => {
    for (const { track, ideal } of all) {
      const m = median(ideal.map(x => x.t))
      expect(m, `${track} median`).toBeGreaterThanOrEqual(35)
      expect(m, `${track} median`).toBeLessThanOrEqual(55)
      for (const tier of TIERS) {
        const mt = median(ideal.filter(x => x.c.tier === tier).map(x => x.t))
        expect(mt, `${track} ${tier}`).toBeGreaterThanOrEqual(25)
        expect(mt, `${track} ${tier}`).toBeLessThanOrEqual(75)
      }
    }
  })

  it('every catalog car finishes every circuit before the cap, with and without input', () => {
    for (const { track, ideal, idle } of all) {
      expect(Math.max(...ideal.map(x => x.t)), `${track} ideal`).toBeLessThan(MAX_RACE_SECONDS)
      expect(idle.every(x => x.finished), `${track} idle`).toBe(true)
    }
  })
})

describe('win rate', () => {
  // The middle car of each tier by ideal sprint time: beating three cars of its own tier is a fair test.
  const middle = TIERS.map(tier => {
    const cars = CATALOG.filter(c => c.tier === tier).map(c => ({ c, t: drive(c.id, 'sprint') })).sort((a, b) => a.t - b.t)
    return cars[Math.floor(cars.length / 2)].c
  })
  const rate = (skill: number) => {
    let wins = 0, n = 0
    for (const car of middle) {
      for (let i = 0; i < 40; i++) {
        const raceId = `race-${i}`
        const mine = drive(car.id, 'sprint', skill, raceId)
        const best = Math.min(...opponentTraces(raceId, car, 'sprint').map(o => o.finishTime))
        wins += mine < best ? 1 : 0
        n++
      }
    }
    return wins / n
  }

  it('is neither trivial nor hopeless for a skilled driver, and low for a sloppy one', () => {
    const skilled = rate(0)
    const sloppy = rate(0.5)
    expect(skilled).toBeGreaterThanOrEqual(0.15)
    expect(skilled).toBeLessThanOrEqual(0.9)
    expect(sloppy).toBeLessThanOrEqual(0.1)
    expect(skilled).toBeGreaterThan(sloppy + 0.1)
  })
})

describe('scoreCircuitRace', () => {
  const car = CARS_BY_ID['toyota-supra-a80']
  const spec = raceSpec(car, 2)
  const args = (inputs: ReturnType<typeof autoDrive>) => ({ raceId: 'abc', car, level: 2, eventId: 'sprint' as TrackId, inputs, player: { name: 'You · tester' } })
  const inputs = autoDrive(spec, TRACKS.sprint, seededRng('p'), 0)

  it('ranks four drivers, rewards the place and is repeatable', () => {
    const r = scoreCircuitRace(args(inputs))
    expect(r.rows).toHaveLength(4)
    expect(r.rows.filter(x => x.me)).toHaveLength(1)
    expect([...r.rows].sort((a, b) => a.time - b.time)).toEqual(r.rows)
    expect(r.place).toBe(r.rows.findIndex(x => x.me) + 1)
    expect(r.rewards).toEqual(raceRewards(RACE_EVENTS_BY_ID.sprint, r.place))
    expect(r.splits).toHaveLength(TRACKS.sprint.sectors.length)
    expect(r.nitroUsed).toBeGreaterThanOrEqual(1)
    expect(scoreCircuitRace(args(inputs))).toEqual(r)
  })

  it('a race held on the brake comes last with finite numbers', () => {
    const r = scoreCircuitRace(args({ brake: [0], nitro: [] }))
    expect(r.place).toBe(4)
    expect(r.time).toBe(MAX_RACE_SECONDS)
    expect(Number.isFinite(r.top)).toBe(true)
    expect(r.rows.every(x => Number.isFinite(x.time))).toBe(true)
  })

  it('exposes opponent traces that match their finish times', () => {
    const traces = opponentTraces('abc', car, 'sprint')
    expect(traces).toHaveLength(3)
    for (const o of traces) {
      expect(o.distanceAt(0)).toBe(0)
      expect(o.distanceAt(o.finishTime + 5)).toBeCloseTo(Object.values(TRACKS.sprint.sectors).reduce((a, s) => a + s.len, 0), 0)
      expect(o.distanceAt(o.finishTime / 2)).toBeGreaterThan(0)
    }
  })
})
