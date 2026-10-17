// HTTP contract between the Express backend and the Angular app (see API.md).
// Every mutation answers with the player's full Snapshot so the client never patches state by hand.
import type { OwnedCar, PackId, Pull, RaceEventId, RaceRewards, RaceRow, ShiftQuality } from './game/index.ts'

export interface Settings {
  sound: boolean
  reduceMotion: boolean
  notifications: boolean
  showGarageValue: boolean
}

export interface User {
  id: string
  username: string
  email: string
  region: string
  city: string
  since: number
  level: number
  xp: number
  credits: number
  settings: Settings
}

export interface PlayerStats {
  racesRun: number
  racesWon: number
  seasonPoints: number
  packsOpened: number
  legendaryPulls: number
  /** Packs opened since the last Legendary (pity counter) */
  pity: number
  trades: number
  tradeNet: number
  bestLap: string
  streak: number
  bestStreak: number
}

export interface Listing {
  id: string
  carId: string
  level: number
  price: number
  /** 30-day average sale price */
  avg: number
  seller: string
  endsAt: number
  mine: boolean
}

export interface SwapOffer {
  id: string
  /** Who proposed it */
  from: string
  to: string
  give: string
  get: string
  credits: number
  expiresAt: number
  incoming: boolean
}

export interface Activity {
  at: number
  verb: string
  what: string
}

export interface Friend {
  name: string
  status: string
  online: boolean
  cars: number
  points: number
  showcase: string
}

export interface CalendarEvent {
  id: string
  date: number
  name: string
  rule: string
  prize: string
  eventId: RaceEventId
  fee: number
  featured: boolean
}

/** Everything the signed-in player sees, as returned by the server after each mutation. */
export interface Snapshot {
  user: User
  stats: PlayerStats
  garage: OwnedCar[]
  listings: Listing[]
  offers: SwapOffer[]
  activity: Activity[]
  friends: Friend[]
  events: CalendarEvent[]
  /** Next free Street pack */
  freePackAt: number
  seasonEndsAt: number
  season: number
}

export interface PackOpening {
  packId: PackId | 'free'
  pulls: Pull[]
  creditsBack: number
}

export interface RaceEntry {
  raceId: string
  eventId: RaceEventId
  carId: string
  opponents: { name: string; car: string }[]
}

export interface RaceResult {
  raceId: string
  eventId: RaceEventId
  carId: string
  rows: RaceRow[]
  place: number
  time: number
  /** m/s */
  top: number
  shifts: ShiftQuality[]
  rewards: RaceRewards
}

export type LeaderboardMetric = 'race' | 'value' | 'size'
export type LeaderboardScope = 'global' | 'friends' | 'region'

export interface LeaderboardRow {
  rank: number
  name: string
  cc: string
  car: string
  score: number
}

export interface Leaderboard {
  rows: LeaderboardRow[]
  me: { rank: number; score: number; car: string; gapToNext: number; progress: number; percentile: string }
}

export type GameErrorCode = 'insufficient_credits' | 'not_found' | 'invalid' | 'unauthenticated' | 'not_configured'

/** Error body sent by the API: `{ error: { code, message, needed? } }`. */
export interface ApiErrorBody {
  error: { code: GameErrorCode; message: string; needed?: number }
}

/** Answer to sign-up and log-in. The token goes in `Authorization: Bearer <token>`. */
export interface AuthResponse {
  token: string
  snapshot: Snapshot
}
