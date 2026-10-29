// Scores a circuit race: replays the player's inputs, drives the seeded opponents with the autopilot and
// ranks the field. Shared by the Edge Function and the local mock backend.
import { carLabel } from './catalog.ts'
import { MAX_RACE_SECONDS, NITRO, autoDrive, raceSpec, replayCircuit, type CornerQuality, type RaceInputs } from './circuit.ts'
import { opponentsFor, seededRng } from './opponents.ts'
import { DT, RACE_EVENTS_BY_ID, raceRewards, type RaceRewards, type RaceRow } from './race.ts'
import { TRACKS, trackLength, type TrackId } from './tracks.ts'
import type { Car } from './types.ts'

const label = (c: Car) => `${c.make} ${carLabel(c)}`

export interface OpponentTrace {
  name: string
  car: string
  finishTime: number
  /** Distance covered `t` seconds after the start, for drawing the opponent during a live race */
  distanceAt(t: number): number
}

/** Each opponent's whole run, driven by the autopilot with a generator seeded from the race and their handle. */
export function opponentTraces(raceId: string, player: Car, trackId: TrackId): OpponentTrace[] {
  const track = TRACKS[trackId]
  const length = trackLength(track)
  return opponentsFor(raceId, player).map(o => {
    const spec = raceSpec(o.car, 0)
    const inputs = autoDrive(spec, track, seededRng(`${raceId}:${o.name}`), o.skill)
    const dist = [0]
    const end = replayCircuit(spec, track, inputs, s => dist.push(s.d))
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

export interface ScoredCircuitRace {
  rows: RaceRow[]
  place: number
  time: number
  /** m/s */
  top: number
  corners: CornerQuality[]
  splits: number[]
  nitroUsed: number
  rewards: RaceRewards
}

export function scoreCircuitRace(a: {
  raceId: string
  car: Car
  level: number
  eventId: TrackId
  inputs: RaceInputs
  player: { name: string }
}): ScoredCircuitRace {
  const run = replayCircuit(raceSpec(a.car, a.level), TRACKS[a.eventId], a.inputs)
  const time = run.finished ? run.finishTime : MAX_RACE_SECONDS
  const rows: RaceRow[] = [
    { name: a.player.name, car: label(a.car), time, me: true },
    ...opponentTraces(a.raceId, a.car, a.eventId).map(o => ({ name: o.name, car: o.car, time: o.finishTime, me: false })),
  ].sort((x, y) => x.time - y.time || Number(x.me) - Number(y.me))
  const place = rows.findIndex(r => r.me) + 1
  return {
    rows, place, time, top: run.top, corners: run.corners, splits: run.splits,
    nitroUsed: NITRO.charges - run.nitroLeft,
    rewards: raceRewards(RACE_EVENTS_BY_ID[a.eventId], place),
  }
}
