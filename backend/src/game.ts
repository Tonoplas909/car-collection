import { randomInt } from 'node:crypto'
import {
  CARS_BY_ID, CREDIT_BUNDLES, DUPLICATE_CREDITS, MARKET_FEE, MAX_LEVEL, OPPONENTS, PACKS_BY_ID, RACE_EVENTS_BY_ID,
  SWAP_TTL_MS, TASTES, XP_PER_LEVEL, carLabel, getCar, rollPack, rollStarterPack, scoreRace, upgradeCost, validShiftSteps,
  type PackId, type PackRoll, type RaceEventId, type TasteId,
} from '../../shared/game/index.ts'
import type {
  Leaderboard, LeaderboardMetric, LeaderboardScope, PackOpening, RaceEntry, RaceResult, Settings, Snapshot,
} from '../../shared/api.ts'
import { GameError, fmt } from './errors.ts'
import { CalendarEvent, Listing, Race, Sale, Season, SwapOffer, User, type Id, type UserDoc } from './models.ts'

// Game rules applied server-side. The client only renders; every credit, car and reward change
// happens here, with the shared rules in shared/game (pack odds, race physics, economy).

const DAY = 86_400_000
const LISTING_TTL = 3 * DAY
const ACTIVITY_KEPT = 50

/** Server-side randomness in [0, 1). */
const rng = () => randomInt(2 ** 47) / 2 ** 47

// ── Per-player lock ──────────────────────────────────────────────────────────
// Mutations load player documents, change them and save them. The API runs as one process, so an
// in-memory lock per player id is enough to keep two requests from overwriting each other.

const locks = new Map<string, Promise<unknown>>()

async function withLock<T>(ids: string[], fn: () => Promise<T>): Promise<T> {
  const keys = [...new Set(ids)].sort()
  const prev = Promise.all(keys.map(k => locks.get(k)))
  const run = prev.catch(() => {}).then(fn)
  const done = run.catch(() => {})
  keys.forEach(k => locks.set(k, done))
  try {
    return await run
  } finally {
    keys.forEach(k => { if (locks.get(k) === done) locks.delete(k) })
  }
}

async function loadUser(id: Id | string): Promise<UserDoc> {
  const u = await User.findById(id)
  if (!u) throw new GameError('unauthenticated', 'Sign in to continue.')
  return u
}

/** Runs `fn` on the signed-in player under the lock, saves, and answers with the fresh snapshot. */
async function mutate<T>(uid: string, fn: (u: UserDoc) => Promise<T> | T): Promise<{ snapshot: Snapshot; value: T }> {
  const value = await withLock([uid], async () => {
    const u = await loadUser(uid)
    const v = await fn(u)
    await u.save()
    return v
  })
  return { snapshot: await snapshot(uid), value }
}

// ── Helpers on a player document ─────────────────────────────────────────────

function spend(u: UserDoc, amount: number) {
  if (u.credits < amount) throw new GameError('insufficient_credits', `You need ${fmt(amount)} CR.`, amount)
  u.credits -= amount
}

function log(u: UserDoc, verb: string, what: string) {
  u.activity.unshift({ at: new Date(), verb, what })
  if (u.activity.length > ACTIVITY_KEPT) u.activity.splice(ACTIVITY_KEPT)
}

function owns(u: UserDoc, carId: string) {
  return u.garage.some(g => g.carId === carId)
}

function addCar(u: UserDoc, carId: string, level = 0, serial?: number | null) {
  const next = Math.max(0, ...u.garage.map(g => g.serial)) + 1
  u.garage.push({ carId, level, serial: serial ?? next, acquiredAt: new Date(), showcase: false })
}

function removeCar(u: UserDoc, carId: string) {
  const i = u.garage.findIndex(g => g.carId === carId)
  if (i < 0) return null
  const [car] = u.garage.splice(i, 1)
  return { level: car.level, serial: car.serial }
}

function addXp(u: UserDoc, xp: number) {
  u.xp += xp
  while (u.xp >= XP_PER_LEVEL) {
    u.xp -= XP_PER_LEVEL
    u.level++
    log(u, 'Reached', `level ${u.level}`)
  }
}

const name = (carId: string) => { const c = getCar(carId); return `${c.make} ${carLabel(c)}` }

function bestCarName(u: { garage: { carId: string; showcase?: boolean }[] }, preferShowcase = false) {
  const cars = u.garage.filter(g => CARS_BY_ID[g.carId])
  if (!cars.length) return '—'
  cars.sort((a, b) => (preferShowcase ? Number(!!b.showcase) - Number(!!a.showcase) : 0) || CARS_BY_ID[b.carId].value - CARS_BY_ID[a.carId].value)
  return name(cars[0].carId)
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

/** House listings roll over so the market never empties; a player's expired listing returns the car. */
async function maintain(uid: string) {
  const now = Date.now()
  const stale = await Listing.find({ seller: null, status: 'active', endsAt: { $lt: new Date(now) } })
  for (const l of stale) {
    const periods = Math.ceil((now - l.endsAt.getTime()) / LISTING_TTL + 0.0001)
    l.endsAt = new Date(l.endsAt.getTime() + periods * LISTING_TTL)
    await l.save()
  }
  const expired = await Listing.find({ seller: uid, status: 'active', endsAt: { $lt: new Date(now) } })
  if (expired.length) {
    await withLock([uid], async () => {
      const u = await loadUser(uid)
      for (const l of expired) {
        const claimed = await Listing.findOneAndUpdate({ _id: l._id, status: 'active' }, { status: 'expired' })
        if (claimed) addCar(u, l.carId, l.level, l.serial)
      }
      await u.save()
    })
  }
  await SwapOffer.updateMany(
    { status: 'open', expiresAt: { $lt: new Date(now) }, $or: [{ proposer: uid }, { recipient: uid }] },
    { status: 'declined' },
  )
}

/** Keeps a running season and upcoming calendar events. */
export async function ensureSeasonAndEvents() {
  const now = Date.now()
  let season = await Season.findOne().sort({ number: -1 })
  if (!season || season.endsAt.getTime() < now) {
    await Season.create({ number: (season?.number ?? 3) + 1, endsAt: new Date(now + 12 * DAY + 4 * 3_600_000) })
  }
  if (!(await CalendarEvent.exists({ startsAt: { $gt: new Date(now) } }))) {
    const sat = nextSaturday(now)
    await CalendarEvent.insertMany([
      { startsAt: sat, name: 'Suzuka Sprint', rule: '800 m · JDM cars only', prize: 'Apex pack', eventId: 'sprint', fee: 500, featured: true },
      { startsAt: sat + DAY, name: 'Monte Carlo Rally', rule: '1,600 m · Rally class', prize: '10,000 CR', eventId: 'run', fee: 1000 },
      { startsAt: sat + 7 * DAY, name: 'Quarter Mile Night', rule: '402 m · Any car', prize: 'Rare car', eventId: 'drag', fee: 300 },
      { startsAt: sat + 8 * DAY, name: 'Autobahn Run', rule: '1,600 m · Supercars', prize: 'Legendary pack', eventId: 'run', fee: 1000 },
      { startsAt: sat + 14 * DAY, name: 'Classics Cup', rule: '800 m · Pre-1990', prize: 'Heritage pack', eventId: 'sprint', fee: 500 },
    ].map(e => ({ ...e, startsAt: new Date(e.startsAt) })))
  }
}

function nextSaturday(now: number) {
  const d = new Date(now)
  d.setHours(18, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return d.getTime()
}

/** Everything the signed-in player sees. */
export async function snapshot(uid: string): Promise<Snapshot> {
  await maintain(uid)
  const u = await User.findById(uid).populate<{ friends: { user: UserDoc; accepted: boolean }[] }>('friends.user')
  if (!u) throw new GameError('unauthenticated', 'Sign in to continue.')
  const since = new Date(Date.now() - 30 * DAY)
  const [listings, averages, offers, events, season] = await Promise.all([
    Listing.find({ status: 'active' }).sort({ createdAt: 1 }),
    Sale.aggregate<{ _id: string; avg: number }>([{ $match: { soldAt: { $gt: since } } }, { $group: { _id: '$carId', avg: { $avg: '$price' } } }]),
    SwapOffer.find({ status: 'open', $or: [{ proposer: uid }, { recipient: uid }] }).sort({ expiresAt: 1 }).populate<{ proposer: UserDoc }>('proposer', 'username'),
    CalendarEvent.find({ startsAt: { $gt: new Date(Date.now() - DAY) } }).sort({ startsAt: 1 }),
    Season.findOne().sort({ number: -1 }),
  ])
  const avg = new Map(averages.map(a => [a._id, Math.round(a.avg)]))

  return {
    user: {
      id: u.id, username: u.username, email: u.email, region: u.region, city: u.city,
      since: u.createdAt.getTime(), level: u.level, xp: u.xp, credits: u.credits,
      settings: { sound: u.settings.sound, reduceMotion: u.settings.reduceMotion, notifications: u.settings.notifications, showGarageValue: u.settings.showGarageValue },
    },
    stats: (({ racesRun, racesWon, seasonPoints, packsOpened, legendaryPulls, pity, trades, tradeNet, bestLap, streak, bestStreak }) =>
      ({ racesRun, racesWon, seasonPoints, packsOpened, legendaryPulls, pity, trades, tradeNet, bestLap, streak, bestStreak }))(u.stats),
    garage: u.garage
      .map(g => ({ carId: g.carId, serial: g.serial, level: g.level, acquiredAt: g.acquiredAt.getTime(), showcase: g.showcase }))
      .sort((a, b) => a.serial - b.serial),
    listings: listings.filter(l => CARS_BY_ID[l.carId]).map(l => ({
      id: l.id, carId: l.carId, level: l.level, price: l.price, seller: l.sellerName,
      endsAt: l.endsAt.getTime(), mine: !!l.seller && l.seller.equals(u._id),
      avg: avg.get(l.carId) ?? CARS_BY_ID[l.carId].value,
    })),
    offers: offers.map(o => {
      const incoming = !!o.recipient && o.recipient.equals(u._id)
      return {
        id: o.id, from: o.proposer?.username ?? '—', to: o.recipientName,
        give: incoming ? o.recipientCar : o.proposerCar, get: incoming ? o.proposerCar : o.recipientCar,
        credits: o.credits, expiresAt: o.expiresAt.getTime(), incoming,
      }
    }),
    activity: u.activity.map(a => ({ at: a.at.getTime(), verb: a.verb, what: a.what })),
    friends: u.friends.filter(f => f.user).map(f => ({
      name: f.user.username,
      status: f.accepted ? 'Friend' : 'Request sent',
      online: false,
      cars: f.user.garage.length,
      points: f.user.stats.seasonPoints,
      showcase: bestCarName(f.user, true),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    events: events.map(e => ({
      id: e.id, date: e.startsAt.getTime(), name: e.name, rule: e.rule, prize: e.prize,
      eventId: e.eventId as RaceEventId, fee: e.fee, featured: e.featured,
    })),
    freePackAt: u.freePackAt.getTime(),
    seasonEndsAt: season?.endsAt.getTime() ?? Date.now(),
    season: season?.number ?? 1,
  }
}

// ── Packs ────────────────────────────────────────────────────────────────────

function applyRoll(u: UserDoc, roll: PackRoll, label: string) {
  for (const p of roll.pulls) if (!p.duplicate) addCar(u, p.carId)
  u.credits += roll.creditsBack
  u.stats.packsOpened++
  if (roll.hasLegendary) { u.stats.legendaryPulls++; u.stats.pity = 0 } else u.stats.pity++
  log(u, 'Pulled', `${name(roll.pulls[roll.pulls.length - 1].carId)} from a ${label} pack`)
}

export async function completeOnboarding(uid: string, tastes: unknown) {
  const valid = new Set(TASTES.map(t => t.id))
  const picked = (Array.isArray(tastes) ? tastes : []).filter((t): t is TasteId => valid.has(t))
  const r = await mutate(uid, u => {
    if (u.onboarded || u.garage.length) throw new GameError('invalid', 'The starter pack has already been opened.')
    const ids = rollStarterPack(picked, rng)
    ids.forEach(id => addCar(u, id))
    u.onboarded = true
    log(u, 'Pulled', `${name(ids[0])} from the starter pack`)
    return ids
  })
  return { snapshot: r.snapshot, carIds: r.value }
}

export async function openPack(uid: string, packId: string) {
  const pack = PACKS_BY_ID[packId as PackId]
  if (!pack) throw new GameError('not_found', 'Unknown pack.')
  const r = await mutate(uid, u => {
    spend(u, pack.price)
    const roll = rollPack(pack, new Set(u.garage.map(g => g.carId)), u.stats.pity, rng)
    applyRoll(u, roll, pack.name)
    return { packId: pack.id, pulls: roll.pulls, creditsBack: roll.creditsBack } satisfies PackOpening
  })
  return { snapshot: r.snapshot, opening: r.value }
}

export async function claimFreePack(uid: string) {
  const r = await mutate(uid, u => {
    if (u.freePackAt.getTime() > Date.now()) throw new GameError('invalid', 'Your free pack is not ready yet.')
    const roll = rollPack(PACKS_BY_ID.street, new Set(u.garage.map(g => g.carId)), u.stats.pity, rng)
    applyRoll(u, roll, 'free Street')
    u.freePackAt = new Date(Date.now() + DAY)
    return { packId: 'free', pulls: roll.pulls, creditsBack: roll.creditsBack } satisfies PackOpening
  })
  return { snapshot: r.snapshot, opening: r.value }
}

// ── Market ───────────────────────────────────────────────────────────────────

export async function buyListing(uid: string, listingId: string) {
  const l = await Listing.findOne({ _id: listingId, status: 'active' }).catch(() => null)
  if (!l) throw new GameError('not_found', 'This listing has ended.')
  if (l.seller?.equals(uid)) throw new GameError('invalid', 'You cannot buy your own listing.')
  const sellerId = l.seller?.toString()
  await withLock(sellerId ? [uid, sellerId] : [uid], async () => {
    const u = await loadUser(uid)
    if (owns(u, l.carId)) throw new GameError('invalid', 'This car is already in your garage.')
    spend(u, l.price)
    // Claim the listing atomically: only one buyer can flip it from active to sold.
    const claimed = await Listing.findOneAndUpdate({ _id: l._id, status: 'active' }, { status: 'sold' })
    if (!claimed) throw new GameError('not_found', 'This listing has ended.')
    if (sellerId) {
      const seller = await User.findById(sellerId)
      if (seller) {
        const net = l.price - Math.round(l.price * MARKET_FEE)
        seller.credits += net
        seller.stats.trades++
        seller.stats.tradeNet += net
        log(seller, 'Sold', `${name(l.carId)} for ${fmt(l.price)} CR`)
        await seller.save()
      }
    }
    addCar(u, l.carId, l.level)
    u.stats.trades++
    u.stats.tradeNet -= l.price
    log(u, 'Bought', `${name(l.carId)} from ${l.sellerName}`)
    await u.save()
    await Sale.create({ carId: l.carId, price: l.price })
  })
  return snapshot(uid)
}

export async function listCar(uid: string, carId: string, price: number) {
  if (!Number.isFinite(price) || price < 100) throw new GameError('invalid', 'Set a price of at least 100 CR.')
  const p = Math.round(price)
  return (await mutate(uid, async u => {
    const held = removeCar(u, carId)
    if (!held) throw new GameError('not_found', 'This car is not in your garage.')
    await Listing.create({ seller: u._id, sellerName: u.username, carId, level: held.level, serial: held.serial, price: p, endsAt: new Date(Date.now() + LISTING_TTL) })
    log(u, 'Listed', `${name(carId)} for ${fmt(p)} CR`)
  })).snapshot
}

export async function cancelListing(uid: string, listingId: string) {
  return (await mutate(uid, async u => {
    const l = await Listing.findOneAndUpdate({ _id: listingId, seller: u._id, status: 'active' }, { status: 'cancelled' }).catch(() => null)
    if (!l) throw new GameError('not_found', 'Listing not found.')
    addCar(u, l.carId, l.level, l.serial)
  })).snapshot
}

export async function makeOffer(uid: string, listingId: string, price: number) {
  return (await mutate(uid, async u => {
    const l = await Listing.findOne({ _id: listingId, status: 'active' }).catch(() => null)
    if (!l) throw new GameError('not_found', 'This listing has ended.')
    if (!Number.isFinite(price) || price <= 0) throw new GameError('invalid', 'Enter an offer.')
    if (u.credits < price) throw new GameError('insufficient_credits', 'Your balance is too low for this offer.', price)
    // Price offers are recorded for now; sellers accepting them is a later feature.
    log(u, 'Offered', `${fmt(price)} CR to ${l.sellerName} for the ${carLabel(getCar(l.carId))}`)
  })).snapshot
}

export async function proposeSwap(uid: string, input: { to: string; give: string; get: string; credits: number }) {
  const credits = Math.round(Number(input.credits) || 0)
  if (credits < 0) throw new GameError('invalid', 'Credits cannot be negative.')
  if (!CARS_BY_ID[input.get]) throw new GameError('not_found', 'Unknown car.')
  const recipient = await User.findOne({ username: input.to })
  return (await mutate(uid, async u => {
    if (!owns(u, input.give)) throw new GameError('not_found', 'This car is not in your garage.')
    if (recipient?._id.equals(u._id)) throw new GameError('invalid', 'You cannot swap with yourself.')
    await SwapOffer.create({
      proposer: u._id, recipient: recipient?._id ?? null, recipientName: input.to,
      proposerCar: input.give, recipientCar: input.get, credits, expiresAt: new Date(Date.now() + SWAP_TTL_MS),
    })
    log(u, 'Proposed', `a swap of the ${carLabel(getCar(input.give))} to ${input.to}`)
  })).snapshot
}

export async function acceptSwap(uid: string, offerId: string) {
  const o = await SwapOffer.findOne({ _id: offerId, recipient: uid, status: 'open', expiresAt: { $gt: new Date() } }).catch(() => null)
  if (!o) throw new GameError('not_found', 'This offer has expired.')
  await withLock([uid, o.proposer.toString()], async () => {
    const [u, p] = await Promise.all([loadUser(uid), User.findById(o.proposer)])
    if (!p) throw new GameError('invalid', 'The other player is gone.')
    if (!owns(u, o.recipientCar)) throw new GameError('invalid', 'The car asked for is no longer in your garage.')
    if (!owns(p, o.proposerCar)) throw new GameError('invalid', 'The other player no longer has this car.')
    if (p.credits < o.credits) throw new GameError('invalid', 'The other player cannot pay the credits any more.')
    const claimed = await SwapOffer.findOneAndUpdate({ _id: o._id, status: 'open' }, { status: 'accepted' })
    if (!claimed) throw new GameError('not_found', 'This offer has expired.')
    const mine = removeCar(u, o.recipientCar)!
    const theirs = removeCar(p, o.proposerCar)!
    p.credits -= o.credits
    u.credits += o.credits
    u.stats.trades++; u.stats.tradeNet += o.credits
    p.stats.trades++; p.stats.tradeNet -= o.credits
    // Duplicates convert to credits like pack duplicates.
    if (owns(u, o.proposerCar)) u.credits += DUPLICATE_CREDITS[getCar(o.proposerCar).tier]
    else addCar(u, o.proposerCar, theirs.level)
    if (owns(p, o.recipientCar)) p.credits += DUPLICATE_CREDITS[getCar(o.recipientCar).tier]
    else addCar(p, o.recipientCar, mine.level)
    const a = carLabel(getCar(o.recipientCar)), b = carLabel(getCar(o.proposerCar))
    log(u, 'Swapped', `${a} for ${b} with ${p.username}`)
    log(p, 'Swapped', `${b} for ${a} with ${u.username}`)
    await Promise.all([u.save(), p.save()])
  })
  return snapshot(uid)
}

export async function declineSwap(uid: string, offerId: string) {
  await SwapOffer.updateOne({ _id: offerId, status: 'open', $or: [{ recipient: uid }, { proposer: uid }] }, { status: 'declined' }).catch(() => null)
  return snapshot(uid)
}

// ── Garage ───────────────────────────────────────────────────────────────────

export async function upgradeCar(uid: string, carId: string) {
  return (await mutate(uid, u => {
    const owned = u.garage.find(g => g.carId === carId)
    if (!owned) throw new GameError('not_found', 'This car is not in your garage.')
    const cost = upgradeCost(owned.level)
    if (cost === null) throw new GameError('invalid', `Already at level ${MAX_LEVEL}.`)
    spend(u, cost)
    owned.level++
    log(u, 'Upgraded', `${name(carId)} to Lv ${owned.level}`)
  })).snapshot
}

export async function setShowcase(uid: string, carIds: unknown) {
  const ids = (Array.isArray(carIds) ? carIds : []).slice(0, 3)
  return (await mutate(uid, u => { for (const g of u.garage) g.showcase = ids.includes(g.carId) })).snapshot
}

// ── Races ────────────────────────────────────────────────────────────────────

export async function enterRace(uid: string, eventId: string, carId: string) {
  const ev = RACE_EVENTS_BY_ID[eventId as RaceEventId]
  if (!ev) throw new GameError('not_found', 'Unknown event.')
  const r = await mutate(uid, async u => {
    const owned = u.garage.find(g => g.carId === carId)
    if (!owned) throw new GameError('not_found', 'Choose a car from your garage.')
    spend(u, ev.fee)
    const race = await Race.create({ user: u._id, eventId, carId, level: owned.level })
    return { raceId: race.id, eventId: ev.id, carId, opponents: OPPONENTS.map(o => ({ name: o.name, car: o.car })) } satisfies RaceEntry
  })
  return { snapshot: r.snapshot, entry: r.value }
}

/** The client sends the steps at which it shifted; the server replays the race to score it. */
export async function finishRace(uid: string, raceId: string, shiftSteps: unknown) {
  if (!validShiftSteps(shiftSteps)) throw new GameError('invalid', 'Invalid race data.')
  const r = await mutate(uid, async u => {
    const race = await Race.findOneAndUpdate({ _id: raceId, user: u._id, finishedAt: null }, { finishedAt: new Date() }).catch(() => null)
    if (!race) throw new GameError('not_found', 'This race has already been scored.')
    const ev = RACE_EVENTS_BY_ID[race.eventId as RaceEventId], car = getCar(race.carId)
    const scored = scoreRace({ hp: car.hp, kg: car.kg, top: car.top, level: race.level }, ev, shiftSteps,
      { name: `You · ${u.username}`, car: name(race.carId) })
    u.credits += scored.rewards.credits
    addXp(u, scored.rewards.xp)
    u.stats.racesRun++
    if (scored.place === 1) u.stats.racesWon++
    u.stats.seasonPoints += scored.rewards.points
    if (scored.place === 1) log(u, 'Won', `a ${ev.kind.toLowerCase()} at ${ev.place} in the ${carLabel(car)}`)
    else log(u, `Finished P${scored.place}`, `in a ${ev.kind.toLowerCase()} at ${ev.place}`)
    const result: RaceResult = { raceId: race.id, eventId: ev.id, carId: race.carId, ...scored }
    race.result = result
    await race.save()
    return result
  })
  return { snapshot: r.snapshot, result: r.value }
}

// ── Profile, credits, friends ────────────────────────────────────────────────

/** Local project: no payment provider, the bundle is credited directly. */
export async function topUp(uid: string, bundleId: string) {
  const b = CREDIT_BUNDLES.find(x => x.id === bundleId)
  if (!b) throw new GameError('not_found', 'Unknown bundle.')
  return (await mutate(uid, u => { u.credits += b.credits })).snapshot
}

export async function saveProfile(uid: string, input: { username?: string; email?: string; region?: string; settings?: Partial<Settings> }) {
  const username = String(input.username ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  if (username.length < 3 || username.length > 24) throw new GameError('invalid', 'Usernames are 3 to 24 characters.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new GameError('invalid', 'Enter a valid email.')
  if (await User.exists({ username, _id: { $ne: uid } })) throw new GameError('invalid', 'This username is taken.', undefined, 409)
  if (await User.exists({ email, _id: { $ne: uid } })) throw new GameError('invalid', 'This email is already used.', undefined, 409)
  const s = input.settings ?? {}
  const r = await mutate(uid, u => {
    u.username = username
    u.email = email
    u.region = String(input.region ?? '').trim().slice(0, 40)
    u.settings = {
      sound: s.sound ?? true, reduceMotion: s.reduceMotion ?? false,
      notifications: s.notifications ?? true, showGarageValue: s.showGarageValue ?? true,
    }
  })
  await Listing.updateMany({ seller: uid, status: 'active' }, { sellerName: username })
  return r.snapshot
}

export async function addFriend(uid: string, username: string) {
  const wanted = String(username ?? '').trim()
  if (!wanted) throw new GameError('invalid', 'Enter a username.')
  const f = await User.findOne({ username: wanted })
  if (!f) throw new GameError('not_found', `No player called ${wanted}.`)
  if (f._id.equals(uid)) throw new GameError('invalid', 'That is you.')
  await withLock([uid, f.id], async () => {
    const [u, other] = await Promise.all([loadUser(uid), loadUser(f.id)])
    if (u.friends.some(x => x.user.equals(f._id))) throw new GameError('invalid', `${wanted} is already on your list.`)
    // A request in both directions makes it mutual.
    const back = other.friends.find(x => x.user.equals(u._id))
    u.friends.push({ user: f._id, accepted: !!back })
    if (back) { back.accepted = true; await other.save() }
    await u.save()
  })
  return snapshot(uid)
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

const REGION_CC: Record<string, string> = {
  France: 'FR', Japan: 'JP', Italy: 'IT', Germany: 'DE', 'United Kingdom': 'GB', 'United States': 'US',
  Spain: 'ES', Belgium: 'BE', Switzerland: 'CH', Sweden: 'SE', Monaco: 'MC', Brazil: 'BR',
}

export async function leaderboard(uid: string, metric: LeaderboardMetric, scope: LeaderboardScope): Promise<Leaderboard> {
  const me = await loadUser(uid)
  const friendIds = new Set([uid, ...me.friends.map(f => f.user.toString())])
  const filter = scope === 'friends' ? { _id: { $in: [...friendIds] } } : scope === 'region' ? { region: me.region } : {}
  const players = await User.find(filter, { username: 1, region: 1, garage: 1, stats: 1 })
  const rows = players.map(p => ({
    id: p.id as string,
    name: p.username,
    cc: REGION_CC[p.region] ?? p.region.slice(0, 2).toUpperCase(),
    car: bestCarName(p),
    score: metric === 'value' ? p.garage.reduce((a, g) => a + (CARS_BY_ID[g.carId]?.value ?? 0), 0)
      : metric === 'size' ? p.garage.length
      : p.stats.seasonPoints,
  }))
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  // Competition ranking: equal scores share a rank.
  const ranked = rows.map(r => ({ ...r, rank: rows.findIndex(x => x.score === r.score) + 1 }))
  const mine = ranked.find(r => r.id === uid)!
  const above = ranked.filter(r => r.score > mine.score)
  const next = above.length ? above[above.length - 1].score : null
  const total = ranked.length
  const pct = Math.max(1, Math.ceil((100 * mine.rank) / Math.max(total, 1)))
  return {
    rows: ranked.slice(0, 18).map(({ rank, name, cc, car, score }) => ({ rank, name, cc, car, score })),
    me: {
      rank: mine.rank, score: mine.score, car: mine.car,
      gapToNext: next === null ? 0 : next - mine.score,
      progress: next ? Math.round((mine.score / next) * 100) / 100 : 1,
      percentile: scope === 'friends' ? `${mine.rank} of ${total} friends`
        : scope === 'region' ? `Top ${pct}% in ${me.region}`
        : `Top ${pct}% of ${fmt(total)} active players`,
    },
  }
}
