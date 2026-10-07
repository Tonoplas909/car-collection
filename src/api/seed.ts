import type { OwnedCar } from '@game'
import type { Activity, CalendarEvent, Friend, Listing, Snapshot, SwapOffer } from './types'

// Sample data from the design handoff, used by the local mock backend.

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const DEMO_EMAIL = 'j.durand@example.com'

const DEMO_GARAGE: [string, number][] = [
  ['ferrari-f40', 3], ['mclaren-f1', 1], ['porsche-911-rs27', 4], ['toyota-2000gt', 0],
  ['nissan-skyline-r34', 5], ['honda-nsx-na1', 2], ['lamborghini-countach', 1], ['toyota-supra-a80', 3],
  ['mazda-rx7-fd', 2], ['bmw-m3-e30', 1], ['alfa-giulia-gta', 0], ['vw-golf-gti-mk1', 4],
  ['peugeot-205-gti', 2], ['mini-cooper-s', 1],
]
const SHOWCASE = ['mclaren-f1', 'nissan-skyline-r34', 'porsche-911-rs27']

export function seedListings(now: number): Listing[] {
  const rows: [string, number, number, number, string, number][] = [
    ['porsche-959', 2, 540000, 512000, 'k.watanabe', 2 * HOUR + 14 * MIN],
    ['mercedes-300sl', 0, 475000, 498000, 'lmarchetti', DAY + 6 * HOUR],
    ['ferrari-f40', 5, 455000, 420000, 'apex_hunter', 38 * MIN],
    ['lancia-delta-evo', 3, 118000, 109000, 'rallye.b', 5 * HOUR + 2 * MIN],
    ['nissan-skyline-r34', 4, 151000, 146000, 'bayside.r', 11 * HOUR + 40 * MIN],
    ['toyota-supra-a80', 1, 79500, 86000, '2jz_only', 22 * MIN],
    ['datsun-240z', 2, 46000, 44500, 'fairlady', 3 * DAY],
    ['bmw-m3-e30', 5, 83000, 72000, 'dtm.88', 7 * HOUR + 15 * MIN],
    ['ford-sierra-cosworth', 0, 38500, 41000, 'cossie', DAY + 2 * HOUR],
    ['toyota-ae86', 3, 15800, 13200, 'touge.t', 4 * HOUR + 50 * MIN],
    ['renault-clio-williams', 1, 8900, 9400, 'f.giraud', 2 * DAY],
    ['mini-cooper-s', 0, 7200, 7600, 'monte64', 55 * MIN],
  ]
  return rows.map(([carId, level, price, avg, seller, ends], i) => ({
    id: `l${i + 1}`, carId, level, price, avg, seller, endsAt: now + ends, mine: false,
  }))
}

function nextSaturday(now: number) {
  const d = new Date(now)
  d.setHours(18, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return d.getTime()
}

export function seedEvents(now: number): CalendarEvent[] {
  const sat = nextSaturday(now)
  return [
    { id: 'e1', date: sat, name: 'Suzuka Sprint', rule: '800 m · JDM cars only', prize: 'Apex pack', eventId: 'sprint', fee: 500, featured: true },
    { id: 'e2', date: sat + DAY, name: 'Monte Carlo Rally', rule: '1,600 m · Rally class', prize: '10,000 CR', eventId: 'run', fee: 1000, featured: false },
    { id: 'e3', date: sat + 7 * DAY, name: 'Quarter Mile Night', rule: '402 m · Any car', prize: 'Rare car', eventId: 'drag', fee: 300, featured: false },
    { id: 'e4', date: sat + 8 * DAY, name: 'Autobahn Run', rule: '1,600 m · Supercars', prize: 'Legendary pack', eventId: 'run', fee: 1000, featured: false },
    { id: 'e5', date: sat + 14 * DAY, name: 'Classics Cup', rule: '800 m · Pre-1990', prize: 'Heritage pack', eventId: 'sprint', fee: 500, featured: false },
  ]
}

const DEMO_FRIENDS: Friend[] = [
  { name: 'dtm.88', status: 'Racing at Suzuka', online: true, cars: 204, points: 12810, showcase: 'Honda NSX NA1' },
  { name: 'fairlady', status: 'Online', online: true, cars: 197, points: 10300, showcase: 'Datsun 240Z S30' },
  { name: 'touge.t', status: 'Last seen 2 h ago', online: false, cars: 190, points: 9860, showcase: 'Toyota Supra A80' },
  { name: 'rallye.b', status: 'Online', online: true, cars: 165, points: 13770, showcase: 'Lancia Delta Integrale' },
  { name: 'm.okafor', status: 'Last seen yesterday', online: false, cars: 171, points: 11080, showcase: 'McLaren F1' },
  { name: 's.lindqvist', status: 'Online', online: true, cars: 122, points: 7410, showcase: 'BMW M3 E30' },
]

function demoOffers(now: number): SwapOffer[] {
  return [
    { id: 'o1', from: 'fairlady', to: 'j.durand', give: 'honda-nsx-na1', get: 'datsun-240z', credits: 40000, expiresAt: now + 19 * HOUR, incoming: true },
    { id: 'o2', from: 'cossie', to: 'j.durand', give: 'bmw-m3-e30', get: 'ford-sierra-cosworth', credits: 25000, expiresAt: now + 6 * HOUR, incoming: true },
  ]
}

function demoActivity(now: number): Activity[] {
  return [
    { at: now - 12 * MIN, verb: 'Won', what: 'a sprint at Suzuka East in the Skyline GT-R R34' },
    { at: now - HOUR, verb: 'Pulled', what: 'Mercedes-Benz 300 SL W198 from a Heritage pack' },
    { at: now - 3 * HOUR, verb: 'Upgraded', what: 'Porsche 911 RS to Lv 4' },
    { at: now - DAY, verb: 'Sold', what: 'Ford Sierra RS Cosworth for 39,000 CR' },
    { at: now - DAY - 2 * HOUR, verb: 'Bought', what: 'BMW M3 E30 from dtm.88' },
    { at: now - 2 * DAY, verb: 'Reached', what: 'level 23' },
    { at: now - 3 * DAY, verb: 'Lost', what: 'to rallye.b at Monte Carlo Stage 2' },
  ]
}

export function demoSnapshot(now: number): Snapshot {
  const garage: OwnedCar[] = DEMO_GARAGE.map(([carId, level], i) => ({
    carId, level, serial: i + 1, acquiredAt: now - (DEMO_GARAGE.length - i) * DAY, showcase: SHOWCASE.includes(carId),
  }))
  return {
    user: {
      id: 'demo', username: 'J. Durand', email: DEMO_EMAIL, region: 'France', city: 'Lyon',
      since: new Date(2026, 2, 1).getTime(), level: 23, xp: 6400, credits: 48200,
      settings: { sound: true, reduceMotion: false, notifications: true, showGarageValue: true },
    },
    stats: {
      racesRun: 203, racesWon: 87, seasonPoints: 6310, packsOpened: 61, legendaryPulls: 4, pity: 13,
      trades: 19, tradeNet: 38400, bestLap: '1:12.48', streak: 9, bestStreak: 31,
    },
    garage,
    listings: seedListings(now),
    offers: demoOffers(now),
    activity: demoActivity(now),
    friends: DEMO_FRIENDS,
    events: seedEvents(now),
    freePackAt: now + 6 * HOUR + 42 * MIN + 18_000,
    seasonEndsAt: now + 12 * DAY + 4 * HOUR,
    season: 4,
  }
}

export function newPlayerSnapshot(now: number, username: string, email: string): Snapshot {
  return {
    user: {
      id: `u${now}`, username, email, region: 'France', city: '', since: now, level: 1, xp: 0, credits: 5000,
      settings: { sound: true, reduceMotion: false, notifications: true, showGarageValue: true },
    },
    stats: { racesRun: 0, racesWon: 0, seasonPoints: 0, packsOpened: 0, legendaryPulls: 0, pity: 0, trades: 0, tradeNet: 0, bestLap: '—', streak: 1, bestStreak: 1 },
    garage: [],
    listings: seedListings(now),
    offers: [],
    activity: [],
    friends: [],
    events: seedEvents(now),
    freePackAt: now,
    seasonEndsAt: now + 12 * DAY + 4 * HOUR,
    season: 4,
  }
}

/** Leaderboard players: name, country, best car. */
export const LB_PLAYERS: [string, string, string][] = [
  ['k.watanabe', 'JP', 'Porsche 959'], ['apex_hunter', 'DE', 'McLaren F1'], ['lmarchetti', 'IT', 'Ferrari F40'],
  ['bayside.r', 'JP', 'Skyline GT-R R34'], ['rallye.b', 'FR', 'Lancia Delta Integrale'], ['dtm.88', 'DE', 'BMW M3 E30'],
  ['2jz_only', 'US', 'Toyota Supra A80'], ['m.okafor', 'GB', 'McLaren F1'], ['fairlady', 'JP', 'Datsun 240Z S30'],
  ['s.lindqvist', 'SE', 'Porsche 911 RS F-series'], ['touge.t', 'JP', 'Honda NSX NA1'], ['cossie', 'GB', 'Ford Sierra RS Cosworth'],
  ['a.moreau', 'FR', 'Mercedes 300 SL W198'], ['gandini_fan', 'IT', 'Lamborghini Countach'], ['monte64', 'MC', 'Mini Cooper S Mk1'],
  ['r.costa', 'BR', 'Ferrari F40'], ['ducktail', 'US', 'Porsche 911 RS F-series'], ['rotary.k', 'JP', 'Mazda RX-7 FD'],
]
