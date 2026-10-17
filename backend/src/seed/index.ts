import { CARS_BY_ID } from '../../../shared/game/index.ts'
import { hashPassword } from '../auth.ts'
import { CalendarEvent, Listing, Sale, SwapOffer, User } from '../models.ts'
import demo from './demo-players.json' with { type: 'json' }

// Demo data loaded into an empty database: the showcase account from the design handoff, 14 other
// players (converted from the former supabase/demo-seed.sql), house listings, sales and events.
// Every demo account uses the password Demo1234!. Times in demo-players.json are offsets from now.

export const DEMO_EMAIL = 'j.durand@example.com'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const DEMO_GARAGE: [string, number][] = [
  ['ferrari-f40', 3], ['mclaren-f1', 1], ['porsche-911-rs27', 4], ['toyota-2000gt', 0],
  ['nissan-skyline-r34', 5], ['honda-nsx-na1', 2], ['lamborghini-countach', 1], ['toyota-supra-a80', 3],
  ['mazda-rx7-fd', 2], ['bmw-m3-e30', 1], ['alfa-giulia-gta', 0], ['vw-golf-gti-mk1', 4],
  ['peugeot-205-gti', 2], ['mini-cooper-s', 1],
]
const SHOWCASE = ['mclaren-f1', 'nissan-skyline-r34', 'porsche-911-rs27']
const DEMO_FRIENDS = ['apex.julien', 'drift.sato', 'rallye.marco', 'autobahn.lena', 'westcoast.jake']

/** House sellers keep the market stocked: [car, level, price, seller, ends in]. */
const HOUSE_LISTINGS: [string, number, number, string, number][] = [
  ['porsche-959', 2, 540000, 'k.watanabe', 2 * HOUR + 14 * MIN],
  ['mercedes-300sl', 0, 475000, 'lmarchetti', DAY + 6 * HOUR],
  ['ferrari-f40', 5, 455000, 'apex_hunter', 38 * MIN],
  ['lancia-delta-evo', 3, 118000, 'rallye.b', 5 * HOUR + 2 * MIN],
  ['nissan-skyline-r34', 4, 151000, 'bayside.r', 11 * HOUR + 40 * MIN],
  ['toyota-supra-a80', 1, 79500, '2jz_only', 22 * MIN],
  ['datsun-240z', 2, 46000, 'fairlady', 3 * DAY],
  ['bmw-m3-e30', 5, 83000, 'dtm.88', 7 * HOUR + 15 * MIN],
  ['ford-sierra-cosworth', 0, 38500, 'cossie', DAY + 2 * HOUR],
  ['toyota-ae86', 3, 15800, 'touge.t', 4 * HOUR + 50 * MIN],
  ['renault-clio-williams', 1, 8900, 'f.giraud', 2 * DAY],
  ['mini-cooper-s', 0, 7200, 'monte64', 55 * MIN],
]

const DEMO_ACTIVITY: [number, string, string][] = [
  [12 * MIN, 'Won', 'a sprint at Suzuka East in the Skyline GT-R R34'],
  [HOUR, 'Pulled', 'Mercedes-Benz 300 SL W198 from a Heritage pack'],
  [3 * HOUR, 'Upgraded', 'Porsche 911 RS to Lv 4'],
  [DAY, 'Sold', 'Ford Sierra RS Cosworth for 39,000 CR'],
  [DAY + 2 * HOUR, 'Bought', 'BMW M3 E30 from dtm.88'],
  [2 * DAY, 'Reached', 'level 23'],
  [3 * DAY, 'Lost', 'to rallye.b at Monte Carlo Stage 2'],
]

const at = (offset: number, now: number) => new Date(now + offset)

export async function seedIfEmpty() {
  if (await User.exists({})) return
  const now = Date.now()
  const passwordHash = await hashPassword(demo.password)

  const players = await User.insertMany(demo.players.map(p => ({
    username: p.username, email: p.email, passwordHash, region: p.region, city: p.city,
    level: p.level, xp: p.xp, credits: p.credits, stats: p.stats, onboarded: true,
    freePackAt: at(p.freePackAt, now), createdAt: at(p.createdAt, now),
    garage: p.garage.filter(g => CARS_BY_ID[g.carId]).map(g => ({ ...g, acquiredAt: at(g.acquiredAt, now) })),
    activity: p.activity.map(a => ({ ...a, at: at(a.at, now) })).sort((a, b) => b.at.getTime() - a.at.getTime()),
  })))
  const byName = new Map(players.map(p => [p.username, p]))
  for (const p of demo.players) {
    const doc = byName.get(p.username)!
    doc.friends.push(...p.friends.map(f => ({ user: byName.get(f.username)!._id, accepted: f.accepted })))
  }

  const me = new User({
    username: 'J. Durand', email: DEMO_EMAIL, passwordHash, region: 'France', city: 'Lyon',
    createdAt: new Date(2026, 2, 1), level: 23, xp: 6400, credits: 48200, onboarded: true,
    stats: { racesRun: 203, racesWon: 87, seasonPoints: 6310, packsOpened: 61, legendaryPulls: 4, pity: 13, trades: 19, tradeNet: 38400, bestLap: '1:12.48', streak: 9, bestStreak: 31 },
    freePackAt: new Date(now + 6 * HOUR + 42 * MIN),
    garage: DEMO_GARAGE.map(([carId, level], i) => ({
      carId, level, serial: i + 1, acquiredAt: new Date(now - (DEMO_GARAGE.length - i) * DAY), showcase: SHOWCASE.includes(carId),
    })),
    activity: DEMO_ACTIVITY.map(([ago, verb, what]) => ({ at: new Date(now - ago), verb, what })),
  })
  for (const n of DEMO_FRIENDS) {
    const f = byName.get(n)!
    me.friends.push({ user: f._id, accepted: true })
    f.friends.push({ user: me._id, accepted: true })
  }
  await me.save()
  await Promise.all(players.map(p => p.save()))

  // Two incoming swap offers for the demo account, from players who own the car they give.
  const mine = new Set(DEMO_GARAGE.map(([c]) => c))
  const offers: [string, string, number][] = [['drift.sato', 'honda-nsx-na1', 40000], ['autobahn.lena', 'bmw-m3-e30', 25000]]
  await SwapOffer.insertMany(offers.flatMap(([from, wants, credits], i) => {
    const p = byName.get(from)!
    const give = p.garage.find(g => !mine.has(g.carId))
    return give ? [{
      proposer: p._id, recipient: me._id, recipientName: me.username, proposerCar: give.carId, recipientCar: wants,
      credits, expiresAt: new Date(now + (i ? 6 : 19) * HOUR),
    }] : []
  }))
  await SwapOffer.insertMany(demo.offers.map(o => ({
    proposer: byName.get(o.from)!._id, recipient: byName.get(o.to)?._id ?? null, recipientName: o.to,
    proposerCar: o.give, recipientCar: o.get, credits: o.credits, expiresAt: at(o.expiresAt, now),
  })))

  await Listing.insertMany([
    ...HOUSE_LISTINGS.map(([carId, level, price, sellerName, ends]) => ({ seller: null, sellerName, carId, level, price, endsAt: new Date(now + ends) })),
    ...demo.listings.map(l => {
      const seller = byName.get(l.seller)!
      return { seller: seller._id, sellerName: seller.username, carId: l.carId, level: l.level, serial: l.serial, price: l.price, endsAt: at(l.endsAt, now) }
    }),
  ].filter(l => CARS_BY_ID[l.carId]))
  await Sale.insertMany(demo.sales.map(s => ({ ...s, soldAt: at(s.soldAt, now) })))
  await CalendarEvent.insertMany(demo.events.map(e => ({ ...e, startsAt: at(e.date, now) })))

  console.log(`[seed] Demo data loaded: ${players.length + 1} players. Log in with ${DEMO_EMAIL} / ${demo.password}`)
}
