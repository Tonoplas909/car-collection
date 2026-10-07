// Checks the Supabase migration and seed on PGlite (Postgres in WebAssembly) with a stubbed
// auth schema, so the SQL can be tested without Docker. Run with: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite({ extensions: { pgcrypto } })

const STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`
await db.exec(STUB)
const migDir = join(root, 'supabase', 'migrations')
for (const f of readdirSync(migDir).sort()) {
  await db.exec(readFileSync(join(migDir, f), 'utf8'))
  console.log('migration ok:', f)
}
await db.exec(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'))
console.log('seed ok')

let failures = 0
const check = (label, cond, extra) => { if (!cond) { failures++; console.log('FAIL', label, extra ?? '') } else console.log('ok  ', label) }
const as = async uid => db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`)
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const rpc = async (sql, params) => Object.values(await one(sql, params))[0]
const expectErr = async (label, sql, params, code) => {
  try { await db.query(sql, params); check(label, false, 'no error') } catch (e) { check(label, e.message.startsWith(code + '|'), e.message) }
}

// Sign-up trigger
const a = (await one(`insert into auth.users (email, raw_user_meta_data) values ('a@x.test', '{"username":"alice"}') returning id`)).id
const b = (await one(`insert into auth.users (email, raw_user_meta_data) values ('b@x.test', '{"username":"alice"}') returning id`)).id
const pa = await one('select * from profiles where id = $1', [a]); const pb = await one('select * from profiles where id = $1', [b])
check('profile created from metadata', pa.username === 'alice' && Number(pa.credits) === 5000)
check('duplicate username gets a suffix', pb.username.startsWith('alice_'), pb.username)

await as(null)
await expectErr('snapshot requires auth', 'select get_snapshot()', [], 'unauthenticated')

await as(a)
let snap = await rpc('select get_snapshot()')
check('snapshot shape', snap.user.username === 'alice' && snap.user.email === 'a@x.test' && snap.garage.length === 0 && snap.listings.length === 12 && snap.events.length === 5, JSON.stringify(Object.keys(snap)))
check('listing avg from sales', snap.listings.find(l => l.carId === 'porsche-959').avg === 512000)

// Starter pack + pack opening (service role path)
await db.query('select apply_starter_pack($1, $2)', [a, ['ferrari-f40', 'vw-golf-gti-mk1', 'mini-cooper-s']])
await expectErr('starter pack only once', 'select apply_starter_pack($1, $2)', [a, ['bmw-m3-e30']], 'invalid')
const dup = { Common: 300, Rare: 1200, Epic: 4000, Legendary: 15000 }
const pulls = [{ carId: 'vw-golf-gti-mk1', tier: 'Common' }, { carId: 'peugeot-205-gti', tier: 'Common' }, { carId: 'toyota-ae86', tier: 'Common' }, { carId: 'bmw-m3-e30', tier: 'Rare' }, { carId: 'ferrari-f40', tier: 'Legendary' }]
const opened = await rpc('select apply_pack_opening($1, $2, $3, $4, $5, $6)', [a, 'Street', 2000, false, JSON.stringify(pulls), JSON.stringify(dup)])
check('pack duplicates recomputed', opened.creditsBack === 15300 && opened.pulls.filter(p => p.duplicate).length === 2, JSON.stringify(opened))
snap = await rpc('select get_snapshot()')
check('pack charged and credits back', snap.user.credits === 5000 - 2000 + 15300 && snap.garage.length === 6 && snap.stats.pity === 0 && snap.stats.legendaryPulls === 1, snap.user.credits)
// New accounts start with the free pack ready.
await db.query('select apply_pack_opening($1, $2, $3, $4, $5, $6)', [a, 'free Street', 2000, true, JSON.stringify(pulls), JSON.stringify(dup)])
snap = await rpc('select get_snapshot()')
check('free pack does not charge', snap.user.credits === 18300 + 300 * 3 + 1200 + 15000 && snap.freePackAt > Date.now() + 23 * 3600e3, snap.user.credits)
await expectErr('free pack not ready', 'select apply_pack_opening($1, $2, $3, $4, $5, $6)', [a, 'free Street', 0, true, JSON.stringify(pulls), JSON.stringify(dup)], 'invalid')

// Upgrades
snap = await rpc(`select upgrade_car('vw-golf-gti-mk1')`)
check('upgrade costs 1,000 and adds a level', snap.garage.find(g => g.carId === 'vw-golf-gti-mk1').level === 1)
await expectErr('upgrade unknown car', `select upgrade_car('mclaren-f1')`, [], 'not_found')

// Market: buy a house listing, list and cancel
await db.query(`update profiles set credits = 200000 where id = $1`, [a])
snap = await rpc('select get_snapshot()')
const house = snap.listings.find(l => l.carId === 'datsun-240z')
const before = snap.user.credits
snap = await rpc('select buy_listing($1)', [house.id])
check('buy house listing', snap.user.credits === before - 46000 && snap.garage.some(g => g.carId === 'datsun-240z') && !snap.listings.some(l => l.id === house.id))
await expectErr('cannot buy twice', 'select buy_listing($1)', [house.id], 'not_found')
const f40 = snap.listings.find(l => l.carId === 'ferrari-f40')
await expectErr('cannot buy a car you own', 'select buy_listing($1)', [f40.id], 'invalid')
snap = await rpc(`select list_car('datsun-240z', 50000)`)
const mine = snap.listings.find(l => l.mine)
check('list car leaves garage', mine && !snap.garage.some(g => g.carId === 'datsun-240z'))
snap = await rpc('select cancel_listing($1)', [mine.id])
check('cancel returns car with serial', snap.garage.some(g => g.carId === 'datsun-240z') && !snap.listings.some(l => l.mine))
await expectErr('price floor', `select list_car('datsun-240z', 10)`, [], 'invalid')

// Player-to-player sale with the 5% fee
snap = await rpc(`select list_car('datsun-240z', 50000)`)
const listing = snap.listings.find(l => l.mine)
await as(b)
await db.query(`update profiles set credits = 100000 where id = $1`, [b])
snap = await rpc('select buy_listing($1)', [listing.id])
check('buyer pays', snap.user.credits === 50000 && snap.garage.some(g => g.carId === 'datsun-240z'))
await as(a)
snap = await rpc('select get_snapshot()')
check('seller receives price minus 5%', snap.activity.some(x => x.verb === 'Sold'), JSON.stringify(snap.activity.slice(0, 2)))
const sellerCredits = (await one('select credits from profiles where id = $1', [a])).credits
check('seller credited 47,500', Number(sellerCredits) === before - 46000 + 47500, sellerCredits)

// Insufficient credits error carries the amount
await db.query(`update profiles set credits = 10 where id = $1`, [a])
try { await db.query(`select enter_race('sprint', 'ferrari-f40')`); check('race fee check', false) }
catch (e) { check('insufficient credits format', e.message === 'insufficient_credits|You need 500 CR.|500', e.message) }
await db.query(`update profiles set credits = 100000 where id = $1`, [a])

// Swaps: b proposes 240Z + 10,000 for a's M3
await as(b)
snap = await rpc(`select propose_swap('alice', 'datsun-240z', 'bmw-m3-e30', 10000)`)
check('swap proposed', snap.offers.length === 1 && snap.offers[0].incoming === false && snap.offers[0].give === 'datsun-240z')
await as(a)
snap = await rpc('select get_snapshot()')
const offer = snap.offers[0]
check('recipient sees incoming swap', offer?.incoming === true && offer.give === 'bmw-m3-e30' && offer.get === 'datsun-240z', JSON.stringify(offer))
snap = await rpc('select accept_swap($1)', [offer.id])
check('swap executed', snap.garage.some(g => g.carId === 'datsun-240z') && !snap.garage.some(g => g.carId === 'bmw-m3-e30') && snap.user.credits === 110000, snap.user.credits)
await as(b)
snap = await rpc('select get_snapshot()')
check('proposer got the car and paid', snap.garage.some(g => g.carId === 'bmw-m3-e30') && snap.user.credits === 40000, snap.user.credits)

// Races
await as(a)
const entered = await rpc(`select enter_race('sprint', 'ferrari-f40')`)
check('enter race charges fee', entered.snapshot.user.credits === 109500 && entered.entry.opponents.length === 3)
await db.query('select apply_race_result($1, $2, $3)', [a, entered.entry.raceId, JSON.stringify({ place: 1, rewards: { points: 120, credits: 2500, xp: 9800 } })])
snap = await rpc('select get_snapshot()')
check('race rewards + level up', snap.user.credits === 112000 && snap.stats.racesWon === 1 && snap.stats.seasonPoints === 120 && snap.user.level === 1 && snap.user.xp === 9800)
await expectErr('race scored once', 'select apply_race_result($1, $2, $3)', [a, entered.entry.raceId, JSON.stringify({ place: 1, rewards: { points: 1, credits: 1, xp: 1 } })], 'not_found')

// Friends + leaderboards
snap = await rpc(`select add_friend($1)`, [pb.username])
check('friend request', snap.friends.length === 1 && snap.friends[0].status === 'Request sent')
await expectErr('no self friend', `select add_friend('alice')`, [], 'invalid')
const lb = await rpc(`select get_leaderboard('race', 'global')`)
check('leaderboard', lb.rows.length === 2 && lb.me.rank === 1 && lb.rows[0].name === 'alice', JSON.stringify(lb))
const lbv = await rpc(`select get_leaderboard('value', 'friends')`)
check('friends value board', lbv.rows.length === 2 && lbv.me.score > 0, JSON.stringify(lbv.me))

// Settings
snap = await rpc(`select save_profile('alice2', 'Germany', '{"reduceMotion": true}')`)
check('save profile', snap.user.username === 'alice2' && snap.user.region === 'Germany' && snap.user.settings.reduceMotion === true && snap.user.settings.sound === true)

// Privileges: authenticated cannot call service-role functions or write tables
const priv = await one(`select has_function_privilege('authenticated', 'public.apply_pack_opening(uuid, text, int, boolean, jsonb, jsonb)', 'execute') as svc,
  has_function_privilege('authenticated', 'public.buy_listing(uuid)', 'execute') as buy,
  has_function_privilege('anon', 'public.get_snapshot()', 'execute') as anon_snap,
  has_table_privilege('authenticated', 'public.profiles', 'update') as upd`)
check('authenticated cannot apply packs', priv.svc === false)
check('authenticated can buy', priv.buy === true)
check('anon cannot read snapshots', priv.anon_snap === false)
console.log('table update grant for authenticated (RLS has no update policy):', priv.upd)

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
