import { describe, expect, it } from 'vitest'
import { CATALOG } from './catalog.ts'
import {
  CircuitSim, MAX_RACE_SECONDS, MAX_STEPS, NITRO, RaceInputRecorder, carNotes, cornerQuality, raceSpec, replayCircuit, validRaceInputs,
} from './circuit.ts'
import { DT } from './race.ts'
import { TRACKS, isCorner, sectorStarts } from './tracks.ts'

const r34 = { hp: 280, kg: 1560, top: 250, level: 5, year: 1999 }

describe('corner quality', () => {
  it('classifies the entry speed against the corner speed', () => {
    expect(cornerQuality(0.92)).toBe('Early')
    expect(cornerQuality(0.93)).toBe('Perfect')
    expect(cornerQuality(1.05)).toBe('Perfect')
    expect(cornerQuality(1.06)).toBe('Late')
  })
})

describe('car notes', () => {
  it('a light, recent car out-grips a heavy one', () => {
    const light = carNotes({ hp: 310, kg: 545, top: 250, level: 0, year: 2013 })
    const heavy = carNotes({ hp: 1020, kg: 2162, top: 322, level: 0, year: 2021 })
    expect(light.G).toBeGreaterThan(heavy.G)
    expect(light.B).toBeGreaterThan(heavy.B)
  })

  it('keeps grip and braking in range for every catalog car', () => {
    for (const car of CATALOG) {
      for (const level of [0, 5]) {
        const n = carNotes(raceSpec(car, level))
        expect(n.G).toBeGreaterThanOrEqual(0.75)
        expect(n.G).toBeLessThanOrEqual(1.4)
        expect(n.B).toBeGreaterThan(8)
        expect(n.A).toBeGreaterThan(0)
      }
    }
  })
})

describe('circuit simulation', () => {
  it('replay reproduces a live fixed-step run exactly', () => {
    const track = TRACKS.sprint
    const live = new CircuitSim(r34, track)
    const rec = new RaceInputRecorder(live)
    const starts = sectorStarts(track)
    while (!live.s.finished && live.s.step < MAX_STEPS) {
      const next = track.sectors[live.s.sector + 1]
      const dist = next ? starts[live.s.sector + 1] - live.s.d : Infinity
      if (next && isCorner(next) && live.s.v > 35 && dist < 150) rec.press()
      else rec.release()
      if (live.s.step === 600) rec.nitro()
      live.step()
    }
    expect(live.s.finished).toBe(true)
    const server = replayCircuit(r34, track, rec.inputs)
    expect(server.finishTime).toBe(live.s.finishTime)
    expect(server.corners).toEqual(live.s.corners)
    expect(server.splits).toEqual(live.s.splits)
    expect(server.top).toBe(live.s.top)
    expect(server.splits).toHaveLength(track.sectors.length)
    expect(server.corners).toHaveLength(track.sectors.filter(isCorner).length)
  })

  it('braking sheds speed at the braking rate', () => {
    const sim = new CircuitSim(r34, TRACKS.run)
    sim.s.v = 50
    sim.setBrake(true)
    for (let i = 0; i < 120; i++) sim.step()
    expect(sim.s.v).toBeLessThan(50 - 0.9 * sim.notes.B)
    expect(sim.s.v).toBeGreaterThan(0)
  })

  it('scrubs off speed that is carried into a corner and flags it Late', () => {
    const track = TRACKS.touge
    const sim = new CircuitSim(r34, track)
    const hairpin = sectorStarts(track)[1]
    const vc = track.sectors[1].vRef! * sim.notes.G
    sim.s.d = hairpin - 0.01
    sim.s.v = 2 * vc
    for (let i = 0; i < 120 + 2; i++) sim.step()
    expect(sim.s.sector).toBe(1)
    expect(sim.s.corners).toEqual(['Late'])
    expect(sim.s.v).toBeLessThanOrEqual(1.2 * vc)
  })

  it('never accelerates past the corner speed', () => {
    const track = TRACKS.touge
    const sim = new CircuitSim(r34, track)
    const vc = track.sectors[1].vRef! * sim.notes.G
    sim.s.d = sectorStarts(track)[1]
    sim.s.sector = 1
    sim.s.v = vc * 0.5
    for (let i = 0; i < 360; i++) sim.step()
    expect(sim.s.v).toBeLessThanOrEqual(vc + 1e-9)
  })

  it('nitro adds distance, but not while braking, and charges are limited', () => {
    const plain = new CircuitSim(r34, TRACKS.run)
    const boosted = new CircuitSim(r34, TRACKS.run)
    expect(boosted.useNitro()).toBe(true)
    for (let i = 0; i < 360; i++) { plain.step(); boosted.step() }
    expect(boosted.s.d).toBeGreaterThan(plain.s.d)

    const a = new CircuitSim(r34, TRACKS.run), b = new CircuitSim(r34, TRACKS.run)
    a.s.v = b.s.v = 30
    a.setBrake(true); b.setBrake(true)
    b.useNitro()
    for (let i = 0; i < 120; i++) { a.step(); b.step() }
    expect(b.s.v).toBe(a.s.v)

    const sim = new CircuitSim(r34, TRACKS.run)
    const secs = Math.ceil((NITRO.seconds + 0.1) / DT)
    expect(sim.useNitro()).toBe(true)
    expect(sim.useNitro()).toBe(false) // still active
    for (let i = 0; i < secs; i++) sim.step()
    expect(sim.useNitro()).toBe(true)
    for (let i = 0; i < secs; i++) sim.step()
    expect(sim.useNitro()).toBe(false) // both charges spent
    expect(sim.s.nitroLeft).toBe(0)
  })

  it('a race held on the brake never finishes and stops at the cap with finite numbers', () => {
    const s = replayCircuit(r34, TRACKS.drag, { brake: [0], nitro: [] })
    expect(s.finished).toBe(false)
    expect(Math.abs(s.t - MAX_RACE_SECONDS)).toBeLessThanOrEqual(DT)
    for (const n of [s.t, s.d, s.v, s.top, s.finishTime]) expect(Number.isFinite(n)).toBe(true)
  })
})

describe('race inputs', () => {
  it('accepts well-formed submissions, including a brake still held at the line', () => {
    expect(validRaceInputs({ brake: [10, 20, 30], nitro: [5] })).toBe(true)
    expect(validRaceInputs({ brake: [], nitro: [] })).toBe(true)
  })

  it('rejects malformed submissions', () => {
    expect(validRaceInputs({ brake: [-1], nitro: [] })).toBe(false)
    expect(validRaceInputs({ brake: [1.5], nitro: [] })).toBe(false)
    expect(validRaceInputs({ brake: [20, 10], nitro: [] })).toBe(false)
    expect(validRaceInputs({ brake: Array.from({ length: 401 }, (_, i) => i), nitro: [] })).toBe(false)
    expect(validRaceInputs({ brake: [], nitro: [1, 2, 3] })).toBe(false)
    expect(validRaceInputs({ brake: [MAX_STEPS + 1], nitro: [] })).toBe(false)
    expect(validRaceInputs({ brake: [] })).toBe(false)
    expect(validRaceInputs(null)).toBe(false)
    expect(validRaceInputs([10, 20])).toBe(false)
  })

  it('the recorder ignores repeated presses and closes a held brake on releaseAll', () => {
    const sim = new CircuitSim(r34, TRACKS.run)
    const rec = new RaceInputRecorder(sim)
    rec.press(); rec.press()
    expect(rec.inputs.brake).toEqual([0])
    sim.step()
    rec.releaseAll()
    expect(rec.inputs.brake).toEqual([0, 1])
    expect(sim.s.braking).toBe(false)
  })

  it('the recorder keeps a mashed brake within what the server accepts', () => {
    const sim = new CircuitSim(r34, TRACKS.run)
    const rec = new RaceInputRecorder(sim)
    for (let i = 0; i < 300; i++) { rec.press(); sim.step(); rec.release(); sim.step() }
    expect(validRaceInputs(rec.inputs)).toBe(true)
    expect(rec.inputs.brake.length % 2).toBe(0)
  })

  it('lets a driver pulse the brake all race long without the brake going dead', () => {
    // 0.08 s on, 0.42 s off for 40 s: about 80 presses, well past the old 20-press limit
    const sim = new CircuitSim(r34, TRACKS.run)
    const rec = new RaceInputRecorder(sim)
    const period = Math.round(0.5 / DT), on = Math.round(0.08 / DT)
    for (let i = 0; i < 40 / DT; i++) {
      if (i % period === 0) rec.press()
      if (i % period === on) rec.release()
      sim.step()
    }
    expect(rec.inputs.brake.length).toBeGreaterThan(40)
    expect(validRaceInputs(rec.inputs)).toBe(true)
    expect(sim.s.braking === (rec.inputs.brake.length % 2 === 1)).toBe(true)
  })
})
