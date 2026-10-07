import {
  CREDIT_BUNDLES, DUPLICATE_CREDITS, MAX_LEVEL, OPPONENTS, PACKS_BY_ID, RACE_EVENTS_BY_ID, SWAP_TTL_MS, XP_PER_LEVEL,
  carLabel, getCar, rollPack, rollStarterPack, scoreRace, upgradeCost,
  type OwnedCar, type PackId, type PackRoll, type RaceEventId,
} from '@game'
import { DEMO_EMAIL, LB_PLAYERS, demoSnapshot, newPlayerSnapshot } from './seed'
import {
  GameError, type GameApi, type Leaderboard, type LeaderboardMetric, type LeaderboardScope, type PackOpening,
  type RaceResult, type Snapshot,
} from './types'

/**
 * Local stand-in for the Supabase backend. It behaves like the server (validates, rolls packs,
 * simulates races) but keeps everything in localStorage, so the UI can run with no backend.
 */

const KEY = 'marque.mock.v1'
const DAY = 86_400_000

interface Db {
  session: string | null
  accounts: Record<string, Snapshot>
  /** Cars held while listed on the market, by listing id */
  escrow: Record<string, OwnedCar>
  races: Record<string, { eventId: RaceEventId; carId: string; level: number }>
}

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch { /* fall through to a fresh db */ }
  const now = Date.now()
  return { session: DEMO_EMAIL, accounts: { [DEMO_EMAIL]: demoSnapshot(now) }, escrow: {}, races: {} }
}

function write(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked: keep in memory */ }
}

const clone = <T,>(v: T): T => structuredClone(v)
const id = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Run a mutation against the signed-in account and persist it. */
function mutate<T>(fn: (s: Snapshot, db: Db) => T): { snapshot: Snapshot; value: T } {
  const db = read()
  const s = db.session ? db.accounts[db.session] : null
  if (!s) throw new GameError('unauthenticated', 'Sign in to continue.')
  const value = fn(s, db)
  write(db)
  return { snapshot: clone(s), value }
}

function refresh(s: Snapshot, now: number) {
  for (const l of s.listings) if (!l.mine && l.endsAt < now) l.endsAt += 3 * DAY
  s.offers = s.offers.filter(o => o.expiresAt > now)
}

function spend(s: Snapshot, amount: number) {
  if (s.user.credits < amount) throw new GameError('insufficient_credits', `You need ${amount.toLocaleString('en-US')} CR.`, amount)
  s.user.credits -= amount
}

function addXp(s: Snapshot, xp: number) {
  s.user.xp += xp
  while (s.user.xp >= XP_PER_LEVEL) {
    s.user.xp -= XP_PER_LEVEL
    s.user.level++
    s.activity.unshift({ at: Date.now(), verb: 'Reached', what: `level ${s.user.level}` })
  }
}

function addCar(s: Snapshot, carId: string, level = 0) {
  const serial = Math.max(0, ...s.garage.map(g => g.serial)) + 1
  s.garage.push({ carId, level, serial, acquiredAt: Date.now(), showcase: false })
}

function owns(s: Snapshot, carId: string) {
  return s.garage.some(g => g.carId === carId)
}

function applyRoll(s: Snapshot, roll: PackRoll, packName: string) {
  for (const p of roll.pulls) if (!p.duplicate) addCar(s, p.carId)
  s.user.credits += roll.creditsBack
  s.stats.packsOpened++
  if (roll.hasLegendary) { s.stats.legendaryPulls++; s.stats.pity = 0 } else s.stats.pity++
  const best = getCar(roll.pulls[roll.pulls.length - 1].carId)
  s.activity.unshift({ at: Date.now(), verb: 'Pulled', what: `${best.make} ${carLabel(best)} from a ${packName} pack` })
}

const tick = () => new Promise(r => setTimeout(r, 0))

export const mockApi: GameApi = {
  async load() {
    await tick()
    const db = read()
    const s = db.session ? db.accounts[db.session] : null
    if (!s) return null
    refresh(s, Date.now())
    write(db)
    return clone(s)
  },

  async signUp({ username, email }) {
    await tick()
    const db = read()
    const key = email.trim().toLowerCase()
    if (db.accounts[key]) throw new GameError('invalid', 'An account with this email already exists. Log in instead.')
    db.accounts[key] = newPlayerSnapshot(Date.now(), username.trim(), key)
    db.session = key
    write(db)
    return clone(db.accounts[key])
  },

  async signIn({ email }) {
    await tick()
    const db = read()
    const key = email.trim().toLowerCase() || DEMO_EMAIL
    if (!db.accounts[key]) {
      if (key !== DEMO_EMAIL) throw new GameError('not_found', 'No account with this email.')
      db.accounts[key] = demoSnapshot(Date.now())
    }
    db.session = key
    write(db)
    return clone(db.accounts[key])
  },

  async signOut() {
    const db = read()
    db.session = null
    write(db)
  },

  async completeOnboarding(tastes) {
    await tick()
    const r = mutate(s => {
      if (s.garage.length) throw new GameError('invalid', 'The starter pack has already been opened.')
      const ids = rollStarterPack(tastes, Math.random)
      ids.forEach(cid => addCar(s, cid))
      const hero = getCar(ids[0])
      s.activity.unshift({ at: Date.now(), verb: 'Pulled', what: `${hero.make} ${carLabel(hero)} from the starter pack` })
      return ids
    })
    return { snapshot: r.snapshot, carIds: r.value }
  },

  async openPack(packId: PackId) {
    await tick()
    const pack = PACKS_BY_ID[packId]
    const r = mutate(s => {
      spend(s, pack.price)
      const roll = rollPack(pack, new Set(s.garage.map(g => g.carId)), s.stats.pity, Math.random)
      applyRoll(s, roll, pack.name)
      return { packId, pulls: roll.pulls, creditsBack: roll.creditsBack } satisfies PackOpening
    })
    return { snapshot: r.snapshot, opening: r.value }
  },

  async claimFreePack() {
    await tick()
    const r = mutate(s => {
      const now = Date.now()
      if (s.freePackAt > now) throw new GameError('invalid', 'Your free pack is not ready yet.')
      const roll = rollPack(PACKS_BY_ID.street, new Set(s.garage.map(g => g.carId)), s.stats.pity, Math.random)
      applyRoll(s, roll, 'free Street')
      s.freePackAt = now + DAY
      return { packId: 'free', pulls: roll.pulls, creditsBack: roll.creditsBack } satisfies PackOpening
    })
    return { snapshot: r.snapshot, opening: r.value }
  },

  async buyListing(listingId) {
    await tick()
    return mutate(s => {
      const l = s.listings.find(x => x.id === listingId)
      if (!l) throw new GameError('not_found', 'This listing has ended.')
      if (l.mine) throw new GameError('invalid', 'You cannot buy your own listing.')
      if (owns(s, l.carId)) throw new GameError('invalid', 'This car is already in your garage.')
      spend(s, l.price)
      addCar(s, l.carId, l.level)
      s.listings = s.listings.filter(x => x.id !== listingId)
      s.stats.trades++
      s.stats.tradeNet -= l.price - l.avg
      const c = getCar(l.carId)
      s.activity.unshift({ at: Date.now(), verb: 'Bought', what: `${c.make} ${carLabel(c)} from ${l.seller}` })
    }).snapshot
  },

  async listCar(carId, price) {
    await tick()
    return mutate((s, db) => {
      const owned = s.garage.find(g => g.carId === carId)
      if (!owned) throw new GameError('not_found', 'This car is not in your garage.')
      if (!Number.isFinite(price) || price < 100) throw new GameError('invalid', 'Set a price of at least 100 CR.')
      const c = getCar(carId)
      const lid = id('l')
      db.escrow[lid] = owned
      s.garage = s.garage.filter(g => g.carId !== carId)
      s.listings.unshift({ id: lid, carId, level: owned.level, price: Math.round(price), avg: c.value, seller: s.user.username, endsAt: Date.now() + 3 * DAY, mine: true })
      s.activity.unshift({ at: Date.now(), verb: 'Listed', what: `${c.make} ${carLabel(c)} for ${Math.round(price).toLocaleString('en-US')} CR` })
    }).snapshot
  },

  async cancelListing(listingId) {
    await tick()
    return mutate((s, db) => {
      const l = s.listings.find(x => x.id === listingId && x.mine)
      if (!l) throw new GameError('not_found', 'Listing not found.')
      const held = db.escrow[listingId]
      if (held) s.garage.push(held)
      else addCar(s, l.carId, l.level)
      delete db.escrow[listingId]
      s.listings = s.listings.filter(x => x.id !== listingId)
    }).snapshot
  },

  async makeOffer(listingId, price) {
    await tick()
    return mutate(s => {
      const l = s.listings.find(x => x.id === listingId)
      if (!l) throw new GameError('not_found', 'This listing has ended.')
      if (s.user.credits < price) throw new GameError('insufficient_credits', 'Your balance is too low for this offer.', price)
      const c = getCar(l.carId)
      s.activity.unshift({ at: Date.now(), verb: 'Offered', what: `${price.toLocaleString('en-US')} CR to ${l.seller} for the ${carLabel(c)}` })
    }).snapshot
  },

  async proposeSwap({ to, give, get, credits }) {
    await tick()
    return mutate(s => {
      if (!owns(s, give)) throw new GameError('not_found', 'This car is not in your garage.')
      s.offers.unshift({ id: id('o'), from: s.user.username, to, give, get, credits, expiresAt: Date.now() + SWAP_TTL_MS, incoming: false })
      const c = getCar(give)
      s.activity.unshift({ at: Date.now(), verb: 'Proposed', what: `a swap of the ${carLabel(c)} to ${to}` })
    }).snapshot
  },

  async acceptSwap(offerId) {
    await tick()
    return mutate(s => {
      const o = s.offers.find(x => x.id === offerId && x.incoming)
      if (!o) throw new GameError('not_found', 'This offer has expired.')
      if (!owns(s, o.give)) throw new GameError('invalid', 'The car asked for is no longer in your garage.')
      s.garage = s.garage.filter(g => g.carId !== o.give)
      if (owns(s, o.get)) s.user.credits += DUPLICATE_CREDITS[getCar(o.get).tier]
      else addCar(s, o.get)
      s.user.credits += o.credits
      s.offers = s.offers.filter(x => x.id !== offerId)
      s.stats.trades++
      s.stats.tradeNet += o.credits
      const a = getCar(o.give), b = getCar(o.get)
      s.activity.unshift({ at: Date.now(), verb: 'Swapped', what: `${carLabel(a)} for ${carLabel(b)} with ${o.from}` })
    }).snapshot
  },

  async declineSwap(offerId) {
    await tick()
    return mutate(s => { s.offers = s.offers.filter(x => x.id !== offerId) }).snapshot
  },

  async upgradeCar(carId) {
    await tick()
    return mutate(s => {
      const owned = s.garage.find(g => g.carId === carId)
      if (!owned) throw new GameError('not_found', 'This car is not in your garage.')
      const cost = upgradeCost(owned.level)
      if (cost === null) throw new GameError('invalid', `Already at level ${MAX_LEVEL}.`)
      spend(s, cost)
      owned.level++
      const c = getCar(carId)
      s.activity.unshift({ at: Date.now(), verb: 'Upgraded', what: `${c.make} ${carLabel(c)} to Lv ${owned.level}` })
    }).snapshot
  },

  async setShowcase(carIds) {
    await tick()
    return mutate(s => { for (const g of s.garage) g.showcase = carIds.includes(g.carId) }).snapshot
  },

  async enterRace(eventId, carId) {
    await tick()
    const ev = RACE_EVENTS_BY_ID[eventId]
    const r = mutate((s, db) => {
      const owned = s.garage.find(g => g.carId === carId)
      if (!owned) throw new GameError('not_found', 'Choose a car from your garage.')
      spend(s, ev.fee)
      const raceId = id('r')
      db.races[raceId] = { eventId, carId, level: owned.level }
      return { raceId, eventId, carId, opponents: OPPONENTS.map(o => ({ name: o.name, car: o.car })) }
    })
    return { snapshot: r.snapshot, entry: r.value }
  },

  async finishRace(raceId, shiftSteps) {
    await tick()
    const r = mutate((s, db) => {
      const race = db.races[raceId]
      if (!race) throw new GameError('not_found', 'This race has already been scored.')
      delete db.races[raceId]
      const ev = RACE_EVENTS_BY_ID[race.eventId], car = getCar(race.carId)
      const spec = { hp: car.hp, kg: car.kg, top: car.top, level: race.level }
      const { rows, place, time, top, shifts, rewards } = scoreRace(spec, ev, shiftSteps, { name: `You · ${s.user.username}`, car: `${car.make} ${carLabel(car)}` })
      s.user.credits += rewards.credits
      addXp(s, rewards.xp)
      s.stats.racesRun++
      if (place === 1) s.stats.racesWon++
      s.stats.seasonPoints += rewards.points
      s.activity.unshift(place === 1
        ? { at: Date.now(), verb: 'Won', what: `a ${ev.kind.toLowerCase()} at ${ev.place} in the ${carLabel(car)}` }
        : { at: Date.now(), verb: `Finished P${place}`, what: `in a ${ev.kind.toLowerCase()} at ${ev.place}` })
      return { raceId, eventId: race.eventId, carId: race.carId, rows, place, time, top, shifts, rewards } satisfies RaceResult
    })
    return { snapshot: r.snapshot, result: r.value }
  },

  async topUp(bundleId) {
    await tick()
    const b = CREDIT_BUNDLES.find(x => x.id === bundleId)
    if (!b) throw new GameError('not_found', 'Unknown bundle.')
    // Mock only: no payment is taken. The real flow goes through a payment provider.
    return mutate(s => { s.user.credits += b.credits }).snapshot
  },

  async saveProfile({ username, email, region, settings }) {
    await tick()
    return mutate(s => {
      if (!username.trim()) throw new GameError('invalid', 'Username cannot be empty.')
      Object.assign(s.user, { username: username.trim(), email: email.trim(), region: region.trim(), settings })
    }).snapshot
  },

  async addFriend(username) {
    await tick()
    return mutate(s => {
      const name = username.trim()
      if (!name) throw new GameError('invalid', 'Enter a username.')
      if (s.friends.some(f => f.name === name)) throw new GameError('invalid', `${name} is already on your list.`)
      s.friends.push({ name, status: 'Request sent', online: false, cars: 0, points: 0, showcase: '—' })
    }).snapshot
  },

  async leaderboard(metric: LeaderboardMetric, scope: LeaderboardScope): Promise<Leaderboard> {
    await tick()
    const db = read()
    const s = db.session ? db.accounts[db.session] : null
    const value = s ? s.garage.reduce((a, g) => a + getCar(g.carId).value, 0) : 0
    const best = s?.garage.slice().sort((a, b) => getCar(b.carId).value - getCar(a.carId).value)[0]
    const bestCar = best ? `${getCar(best.carId).make} ${carLabel(getCar(best.carId))}` : '—'
    const M = {
      race: { top: 18420, step: 0.93, order: LB_PLAYERS.map((_, i) => i), me: { rank: 142, score: s?.stats.seasonPoints ?? 0, gap: 85, prog: 0.72 } },
      value: { top: 8640000, step: 0.9, order: [1, 2, 0, 7, 12, 3, 15, 4, 5, 6, 8, 9, 10, 11, 13, 14, 16, 17], me: { rank: 388, score: value, gap: 14300, prog: 0.41 } },
      size: { top: 211, step: 0.965, order: [5, 0, 8, 10, 3, 2, 1, 4, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17], me: { rank: 1204, score: s?.garage.length ?? 0, gap: 1, prog: 0.9 } },
    }[metric]
    const SC = {
      global: { pct: 'Top 3% of 4,812 active players', rank: (r: number) => r },
      friends: { pct: `4th of ${(s?.friends.length ?? 0) + 17} friends`, rank: () => 4 },
      region: { pct: 'Top 6% in France', rank: () => (metric === 'race' ? 19 : metric === 'value' ? 47 : 162) },
    }[scope]
    const rows = M.order.map((pi, i) => ({
      rank: i + 1, name: LB_PLAYERS[pi][0], cc: LB_PLAYERS[pi][1], car: LB_PLAYERS[pi][2], score: Math.round(M.top * Math.pow(M.step, i)),
    }))
    return { rows, me: { rank: SC.rank(M.me.rank), score: M.me.score, car: metric === 'size' ? '—' : bestCar, gapToNext: M.me.gap, progress: M.me.prog, percentile: SC.pct } }
  },
}
