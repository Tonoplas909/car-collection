import type { OwnedCar, PackId, Pull, RaceEventId, RaceRewards, RaceRow, ShiftQuality, TasteId, Tier } from '@game'

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

/** Raised for rule violations the UI should explain (not enough credits, car listed, ...). */
export class GameError extends Error {
  code: 'insufficient_credits' | 'not_found' | 'invalid' | 'unauthenticated' | 'not_configured'
  needed?: number
  constructor(code: GameError['code'], message: string, needed?: number) {
    super(message)
    this.code = code
    this.needed = needed
  }
}

export interface GameApi {
  /** Current session's snapshot, or null when signed out. */
  load(): Promise<Snapshot | null>
  signUp(input: { username: string; email: string; password: string }): Promise<Snapshot>
  signIn(input: { email: string; password: string }): Promise<Snapshot>
  signOut(): Promise<void>

  completeOnboarding(tastes: TasteId[]): Promise<{ snapshot: Snapshot; carIds: string[] }>
  openPack(packId: PackId): Promise<{ snapshot: Snapshot; opening: PackOpening }>
  claimFreePack(): Promise<{ snapshot: Snapshot; opening: PackOpening }>

  buyListing(listingId: string): Promise<Snapshot>
  listCar(carId: string, price: number): Promise<Snapshot>
  cancelListing(listingId: string): Promise<Snapshot>
  makeOffer(listingId: string, price: number): Promise<Snapshot>
  proposeSwap(input: { to: string; give: string; get: string; credits: number }): Promise<Snapshot>
  acceptSwap(offerId: string): Promise<Snapshot>
  declineSwap(offerId: string): Promise<Snapshot>

  upgradeCar(carId: string): Promise<Snapshot>
  setShowcase(carIds: string[]): Promise<Snapshot>

  enterRace(eventId: RaceEventId, carId: string): Promise<{ snapshot: Snapshot; entry: RaceEntry }>
  finishRace(raceId: string, shiftSteps: number[]): Promise<{ snapshot: Snapshot; result: RaceResult }>

  topUp(bundleId: string): Promise<Snapshot>
  saveProfile(input: { username: string; email: string; region: string; settings: Settings }): Promise<Snapshot>
  addFriend(username: string): Promise<Snapshot>

  leaderboard(metric: LeaderboardMetric, scope: LeaderboardScope): Promise<Leaderboard>
}

export type { Tier }
