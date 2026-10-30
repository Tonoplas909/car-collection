// Race events, rewards and the shared car spec. The circuits are in tracks.ts, the simulation in
// circuit.ts and the scoring in scoring.ts.

import { DRAG_TRACK, TRACKS, trackLength, type TrackId } from './tracks.ts'

export type RaceEventId = TrackId | 'drag'

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
  { id: 'sprint', kind: 'Circuit', len: trackLength(TRACKS.sprint), place: 'Suzuka East', fee: 500, win: 2500, points: 120,
    note: 'A bit of everything: two fast bends, a chicane and a hairpin. The all-rounder wins.' },
  { id: 'drag', kind: 'Drag', len: trackLength(DRAG_TRACK), place: 'Santa Pod, quarter mile', fee: 300, win: 1500, points: 80,
    note: 'A straight line. Shift up when the revs enter the grey window: a perfect shift gives a short boost. Power-to-weight decides it.' },
  { id: 'touge', kind: 'Touge', len: trackLength(TRACKS.touge), place: 'Mount Haruna pass', fee: 700, win: 3800, points: 160,
    note: 'Tight and uphill. Grip and braking beat horsepower.' },
  { id: 'run', kind: 'Highway run', len: trackLength(TRACKS.run), place: 'Autobahn A9, closed section', fee: 1000, win: 6000, points: 220,
    note: 'Long straights and flat-out bends, with one chicane to brake for. Top speed decides it.' },
]
export const RACE_EVENTS_BY_ID = Object.fromEntries(RACE_EVENTS.map(e => [e.id, e])) as Record<RaceEventId, RaceEvent>

/** Fixed simulation step, seconds */
export const DT = 1 / 120

export interface RaceCarSpec {
  hp: number
  kg: number
  /** km/h */
  top: number
  level: number
  year: number
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
