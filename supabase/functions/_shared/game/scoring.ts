// Scores a race, circuit or drag: replays the player's inputs, drives the seeded opponents with the autopilot
// and ranks the field. Shared by the Edge Function and the local mock backend.
import { carLabel } from './catalog.ts'
import { MAX_RACE_SECONDS, NITRO, autoDrive, raceSpec, replayCircuit, type RaceInputs } from './circuit.ts'
import { DRAG_LENGTH, autoShift, replayDrag, type ShiftQuality } from './drag.ts'
import { opponentsFor, seededRng } from './opponents.ts'
import { DT, RACE_EVENTS_BY_ID, raceRewards, type RaceEventId, type RaceRewards, type RaceRow } from './race.ts'
import { TRACKS, trackLength } from './tracks.ts'
import type { Car } from './types.ts'

const label = (c: Car) => `${c.make} ${carLabel(c)}`

export interface OpponentTrace {
  name: string
  car: string
  finishTime: number
  /** Distance covered `t` seconds after the start, for drawing the opponent during a live race */
  distanceAt(t: number): number
}

/**
 * Each opponent's whole run, driven by the autopilot (braking on circuits, shifting at the drag strip) with a
 * generator seeded from the race and their handle.
 */
export function opponentTraces(raceId: string, player: Car, eventId: RaceEventId): OpponentTrace[] {
  const length = eventId === 'drag' ? DRAG_LENGTH : trackLength(TRACKS[eventId])
  return opponentsFor(raceId, player).map(o => {
    const spec = raceSpec(o.car, 0)
    const rng = seededRng(`${raceId}:${o.name}`)
    const dist = [0]
    const end = eventId === 'drag'
      ? replayDrag(spec, autoShift(spec, rng, o.skill), s => dist.push(s.d))
      : replayCircuit(spec, TRACKS[eventId], autoDrive(spec, TRACKS[eventId], rng, o.skill), s => dist.push(s.d))
    return {
      name: o.name,
      car: label(o.car),
      finishTime: end.finished ? end.finishTime : MAX_RACE_SECONDS,
      distanceAt(t: number) {
        if (t <= 0) return 0
        const i = t / DT, lo = Math.floor(i)
        if (lo >= dist.length - 1) return end.finished ? length : Math.min(length, dist[dist.length - 1])
        return Math.min(length, dist[lo] + (dist[lo + 1] - dist[lo]) * (i - lo))
      },
    }
  })
}

export interface ScoredRace {
  rows: RaceRow[]
  place: number
  time: number
  /** m/s */
  top: number
  /** The quality of each corner on a circuit (Early, Perfect, Late), of each shift at the drag strip */
  corners: ShiftQuality[]
  /** Duration of each sector, empty at the drag strip */
  splits: number[]
  nitroUsed: number
  rewards: RaceRewards
}

export interface ScoreArgs {
  raceId: string
  car: Car
  level: number
  eventId: RaceEventId
  inputs: RaceInputs
  player: { name: string }
}

/** Rank the player's finish among the seeded opponents and work out the rewards. */
function ranked(a: ScoreArgs, finished: boolean, finishTime: number, top: number, corners: ShiftQuality[], splits: number[], nitroUsed: number): ScoredRace {
  const time = finished ? finishTime : MAX_RACE_SECONDS
  const rows: RaceRow[] = [
    { name: a.player.name, car: label(a.car), time, me: true },
    ...opponentTraces(a.raceId, a.car, a.eventId).map(o => ({ name: o.name, car: o.car, time: o.finishTime, me: false })),
  ].sort((x, y) => x.time - y.time || Number(x.me) - Number(y.me))
  const place = rows.findIndex(r => r.me) + 1
  return { rows, place, time, top, corners, splits, nitroUsed, rewards: raceRewards(RACE_EVENTS_BY_ID[a.eventId], place) }
}

/** Score a submitted race: replay the player's inputs, rank them against the seeded opponents, work out the rewards. */
export function scoreRace(a: ScoreArgs): ScoredRace {
  const spec = raceSpec(a.car, a.level)
  if (a.eventId === 'drag') {
    const run = replayDrag(spec, a.inputs.shift ?? [])
    return ranked(a, run.finished, run.finishTime, run.top, run.shifts, [], 0)
  }
  const run = replayCircuit(spec, TRACKS[a.eventId], a.inputs)
  return ranked(a, run.finished, run.finishTime, run.top, run.corners, run.splits, NITRO.charges - run.nitroLeft)
}
