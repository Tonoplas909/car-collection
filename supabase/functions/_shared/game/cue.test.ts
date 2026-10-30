import { describe, expect, it } from 'vitest'
import { CARS_BY_ID } from './catalog.ts'
import {
  CircuitSim, ENTRY_WINDOW, MAX_STEPS, RaceInputRecorder, autoDrive, carNotes, cornerCue, cornerQuality, cueAdvice, raceSpec, replayCircuit,
} from './circuit.ts'
import { seededRng } from './opponents.ts'
import { TRACKS, isCorner, nextCorner, type TrackId } from './tracks.ts'

const hairpin = TRACKS.touge.sectors[1]
const notes = carNotes(raceSpec(CARS_BY_ID['caterham-seven-620r'], 0))
const vc = hairpin.vRef! * notes.G

describe('entry window', () => {
  it('is the Perfect band of cornerQuality, with the aim inside it', () => {
    expect(cornerQuality(ENTRY_WINDOW.low)).toBe('Perfect')
    expect(cornerQuality(ENTRY_WINDOW.low - 0.001)).toBe('Early')
    expect(cornerQuality(ENTRY_WINDOW.high)).toBe('Perfect')
    expect(cornerQuality(ENTRY_WINDOW.high + 0.001)).toBe('Late')
    expect(ENTRY_WINDOW.aim).toBeGreaterThan(ENTRY_WINDOW.low)
    expect(ENTRY_WINDOW.aim).toBeLessThan(ENTRY_WINDOW.high)
  })
})

describe('corner cue', () => {
  it('gives the green zone in m/s and the distance to the braking point', () => {
    const v = 4 * vc
    const cue = cornerCue(notes, hairpin, v, 400)
    expect(cue.low).toBeCloseTo(vc * ENTRY_WINDOW.low)
    expect(cue.high).toBeCloseTo(vc * ENTRY_WINDOW.high)
    expect(cue.aim).toBeCloseTo(vc * ENTRY_WINDOW.aim)
    expect(cue.toBrake).toBeCloseTo(400 - (v * v - cue.aim * cue.aim) / (2 * notes.B))
  })

  it('has nothing to brake for when already at or under the aim speed', () => {
    expect(cornerCue(notes, hairpin, vc * 0.9, 120).toBrake).toBe(120)
  })

  it('advises go, brake or release', () => {
    const near = (v: number, dist: number) => cornerCue(notes, hairpin, v, dist)
    // far from the braking point: nothing to do
    expect(cueAdvice(near(3 * vc, 900), 3 * vc, false, false)).toBe('go')
    // at the braking point: brake
    expect(cueAdvice(near(3 * vc, 20), 3 * vc, false, false)).toBe('brake')
    // braking, still too fast, or held at the corner speed just before the corner: keep braking
    expect(cueAdvice(near(2 * vc, 80), 2 * vc, true, false)).toBe('brake')
    expect(cueAdvice(near(vc, 15), vc, true, false)).toBe('brake')
    // in the corner: let go
    expect(cueAdvice(near(vc, 60), vc, true, true)).toBe('release')
    // braking far too early, held at the corner speed with the corner still far: let go
    expect(cueAdvice(near(vc, 300), vc, true, false)).toBe('release')
    // slow already, nothing to brake for
    expect(cueAdvice(near(vc * 0.8, 10), vc * 0.8, false, false)).toBe('go')
    // no corner to look at
    expect(cueAdvice(null, 50, true, false)).toBe('release')
    expect(cueAdvice(null, 50, false, false)).toBe('go')
  })
})

/** A driver that does exactly what the cue says. */
function follow(carId: string, trackId: TrackId) {
  const track = TRACKS[trackId]
  const sim = new CircuitSim(raceSpec(CARS_BY_ID[carId], 0), track)
  const rec = new RaceInputRecorder(sim)
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    const ahead = nextCorner(track, sim.s.sector, sim.s.d)
    const cue = ahead ? cornerCue(sim.notes, track.sectors[ahead.index], sim.s.v, ahead.dist) : null
    if (cueAdvice(cue, sim.s.v, sim.s.braking, isCorner(track.sectors[sim.s.sector])) === 'brake') rec.press(); else rec.release()
    sim.step()
  }
  return { state: sim.s, inputs: rec.inputs }
}

describe('following the cue', () => {
  it('takes every corner in the green zone and is close to the autopilot, on every circuit and kind of car', () => {
    for (const carId of ['caterham-seven-620r', 'bugatti-chiron', 'tesla-model-s-plaid', 'mini-cooper-s']) {
      for (const trackId of Object.keys(TRACKS) as TrackId[]) {
        const { state, inputs } = follow(carId, trackId)
        const spec = raceSpec(CARS_BY_ID[carId], 0)
        const ideal = replayCircuit(spec, TRACKS[trackId], autoDrive(spec, TRACKS[trackId], seededRng('cue'), 0)).finishTime
        expect(state.finished, `${carId} ${trackId}`).toBe(true)
        expect(state.corners.filter(q => q === 'Late'), `${carId} ${trackId} late corners`).toEqual([])
        expect(state.finishTime, `${carId} ${trackId} time`).toBeLessThanOrEqual(ideal * 1.1)
        // and the server agrees with what the live run did
        expect(replayCircuit(spec, TRACKS[trackId], inputs).finishTime).toBe(state.finishTime)
      }
    }
  })
})

describe('braking assist', () => {
  const touge = TRACKS.touge
  const make = () => new CircuitSim(raceSpec(CARS_BY_ID['caterham-seven-620r'], 0), touge)

  it('holding the brake before a corner never takes the car under that corner\'s speed', () => {
    const sim = make()
    const aim = touge.sectors[1].vRef! * sim.notes.G * ENTRY_WINDOW.aim
    sim.s.v = 30
    sim.setBrake(true)
    for (let i = 0; i < 5 * 120; i++) sim.step()
    expect(sim.s.sector).toBe(0)
    expect(sim.s.v).toBeCloseTo(aim, 6)
  })

  it('braking far too early costs time but never a slide', () => {
    for (const trackId of Object.keys(TRACKS) as TrackId[]) {
      const track = TRACKS[trackId]
      const spec = raceSpec(CARS_BY_ID['bugatti-chiron'], 0)
      const sim = new CircuitSim(spec, track)
      const rec = new RaceInputRecorder(sim)
      let target = -1
      while (!sim.s.finished && sim.s.step < MAX_STEPS) {
        const ahead = nextCorner(track, sim.s.sector, sim.s.d)
        const cue = ahead ? cornerCue(sim.notes, track.sectors[ahead.index], sim.s.v, ahead.dist) : null
        // Press 60 m before the braking point (about 0.7 s early) and hold until that corner starts
        if (target >= 0 && sim.s.sector >= target) target = -1
        if (target < 0 && ahead && cue && sim.s.v > cue.aim && cue.toBrake < 60) target = ahead.index
        if (target >= 0) rec.press(); else rec.release()
        sim.step()
      }
      const ideal = replayCircuit(spec, track, autoDrive(spec, track, seededRng('early'), 0)).finishTime
      expect(sim.s.finished, trackId).toBe(true)
      expect(sim.s.corners.filter(q => q !== 'Perfect'), trackId).toEqual([])
      expect(sim.s.finishTime, trackId).toBeGreaterThan(ideal)
      expect(sim.s.finishTime, trackId).toBeLessThan(ideal * 1.2)
    }
  })
})

/** A driver who presses `late` × the braking distance after the flag and holds until that corner starts. */
function lateDriver(carId: string, trackId: TrackId, late: number) {
  const track = TRACKS[trackId]
  const sim = new CircuitSim(raceSpec(CARS_BY_ID[carId], 0), track)
  const rec = new RaceInputRecorder(sim)
  let target = -1
  while (!sim.s.finished && sim.s.step < MAX_STEPS) {
    const ahead = nextCorner(track, sim.s.sector, sim.s.d)
    const cue = ahead ? cornerCue(sim.notes, track.sectors[ahead.index], sim.s.v, ahead.dist) : null
    if (target >= 0 && sim.s.sector >= target) target = -1
    if (target < 0 && ahead && cue && sim.s.v > cue.aim) {
      const distance = (sim.s.v * sim.s.v - cue.aim * cue.aim) / (2 * sim.notes.B)
      if (cue.toBrake <= -late * distance) target = ahead.index
    }
    if (target >= 0) rec.press(); else rec.release()
    sim.step()
  }
  return sim.s
}

describe('being late at the flag', () => {
  const cars = ['caterham-seven-620r', 'bugatti-chiron', 'tesla-model-s-plaid', 'mini-cooper-s']

  it('a quarter of the braking distance late is still a clean corner, on every circuit and kind of car', () => {
    for (const carId of cars) {
      for (const trackId of Object.keys(TRACKS) as TrackId[]) {
        const s = lateDriver(carId, trackId, 0.25)
        expect(s.finished, `${carId} ${trackId}`).toBe(true)
        expect(s.corners.filter(q => q === 'Late'), `${carId} ${trackId}`).toEqual([])
      }
    }
  })

  it('braking after the point of no return slides', () => {
    for (const trackId of Object.keys(TRACKS) as TrackId[]) {
      expect(lateDriver('bugatti-chiron', trackId, 0.7).corners.some(q => q === 'Late'), trackId).toBe(true)
    }
  })
})
