import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { createApp } from '../src/app.ts'
import { connect, disconnect } from '../src/db.ts'
import { ensureSeasonAndEvents } from '../src/game.ts'
import { seedIfEmpty } from '../src/seed/index.ts'
import type { AuthResponse, Snapshot } from '../../shared/api.ts'

// End-to-end API tests on a throwaway embedded MongoDB.

let base = ''
let close = () => {}

before(async () => {
  await connect(undefined, { persist: false })
  await seedIfEmpty()
  await ensureSeasonAndEvents()
  const server = createApp().listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  close = () => server.close()
})

after(async () => {
  close()
  await disconnect()
})

async function call<T = Snapshot>(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as T & { error?: { code: string; message: string } } }
}

const register = async (username: string) =>
  (await call<AuthResponse>('POST', '/auth/register', { username, email: `${username}@test.fr`, password: 'Secret123!' })).body

describe('auth', () => {
  it('answers health without a token', async () => {
    const r = await call('GET', '/health')
    assert.equal(r.status, 200)
  })

  it('logs the demo account in', async () => {
    const r = await call<AuthResponse>('POST', '/auth/login', { email: 'j.durand@example.com', password: 'Demo1234!' })
    assert.equal(r.status, 200)
    assert.ok(r.body.token)
    assert.equal(r.body.snapshot.user.username, 'J. Durand')
    assert.equal(r.body.snapshot.garage.length, 14)
    assert.equal(r.body.snapshot.offers.filter(o => o.incoming).length, 2)
  })

  it('rejects a wrong password and a missing token', async () => {
    assert.equal((await call('POST', '/auth/login', { email: 'j.durand@example.com', password: 'nope' })).status, 401)
    const r = await call('GET', '/me')
    assert.equal(r.status, 401)
    assert.equal(r.body.error?.code, 'unauthenticated')
  })

  it('refuses a duplicate email with 409', async () => {
    await register('dup.one')
    const r = await call('POST', '/auth/register', { username: 'dup.two', email: 'dup.one@test.fr', password: 'Secret123!' })
    assert.equal(r.status, 409)
  })
})

describe('game loop', () => {
  it('onboards once, then opens packs against credits', async () => {
    const { token, snapshot } = await register('rookie')
    assert.equal(snapshot.garage.length, 0)
    assert.equal(snapshot.user.credits, 5000)

    const ob = await call<{ snapshot: Snapshot; carIds: string[] }>('POST', '/me/onboarding', { tastes: ['jdm'] }, token)
    assert.equal(ob.status, 200)
    assert.equal(ob.body.carIds.length, 3)
    assert.equal((await call('POST', '/me/onboarding', { tastes: [] }, token)).status, 400)

    const free = await call<{ snapshot: Snapshot }>('POST', '/packs/free/open', undefined, token)
    assert.equal(free.status, 200)
    assert.equal((await call('POST', '/packs/free/open', undefined, token)).status, 400)

    const apex = await call('POST', '/packs/apex/open', undefined, token)
    assert.equal(apex.status, 402)
    assert.equal(apex.body.error?.code, 'insufficient_credits')
  })

  it('sells a car from one player to another with the 5% fee', async () => {
    const seller = await register('seller')
    const buyer = await register('buyer')
    await call('POST', '/me/onboarding', { tastes: [] }, seller.token)
    const carId = (await call('GET', '/me', undefined, seller.token)).body.garage[0].carId

    const listed = await call('POST', '/market/listings', { carId, price: 1000 }, seller.token)
    assert.equal(listed.status, 201)
    assert.ok(!listed.body.garage.some(g => g.carId === carId))
    const listing = listed.body.listings.find(l => l.mine)!

    const bought = await call('POST', `/market/listings/${listing.id}/buy`, undefined, buyer.token)
    assert.equal(bought.status, 200)
    assert.equal(bought.body.user.credits, 4000)
    assert.ok(bought.body.garage.some(g => g.carId === carId))

    const after = (await call('GET', '/me', undefined, seller.token)).body
    assert.equal(after.user.credits, 5950)
    assert.equal((await call('POST', `/market/listings/${listing.id}/buy`, undefined, buyer.token)).status, 404)
  })

  it('swaps cars between players', async () => {
    const a = await register('swap.a')
    const b = await register('swap.b')
    await call('POST', '/me/onboarding', { tastes: ['supercars'] }, a.token)
    await call('POST', '/me/onboarding', { tastes: ['everyday'] }, b.token)
    const give = (await call('GET', '/me', undefined, a.token)).body.garage[0].carId
    const get = (await call('GET', '/me', undefined, b.token)).body.garage[0].carId

    await call('POST', '/swaps', { to: 'swap.b', give, get, credits: 500 }, a.token)
    const offer = (await call('GET', '/me', undefined, b.token)).body.offers.find(o => o.incoming)!
    assert.equal(offer.give, get)

    const done = await call('POST', `/swaps/${offer.id}/accept`, undefined, b.token)
    assert.equal(done.status, 200)
    assert.ok(done.body.garage.some(g => g.carId === give))
    assert.equal(done.body.user.credits, 5500)
  })

  it('scores a race on the server from the shift steps', async () => {
    const { token } = await register('racer')
    await call('POST', '/me/onboarding', { tastes: [] }, token)
    const carId = (await call('GET', '/me', undefined, token)).body.garage[0].carId
    const entry = await call<{ entry: { raceId: string } }>('POST', '/races', { eventId: 'drag', carId }, token)
    assert.equal(entry.status, 201)

    const raceId = entry.body.entry.raceId
    const bad = await call('POST', `/races/${raceId}/finish`, { shiftSteps: 'fast' }, token)
    assert.equal(bad.status, 400)

    const r = await call<{ result: { place: number; rows: unknown[] }; snapshot: Snapshot }>('POST', `/races/${raceId}/finish`, { shiftSteps: [110, 230, 390, 580, 820] }, token)
    assert.equal(r.status, 200)
    assert.equal(r.body.result.rows.length, 4)
    assert.equal(r.body.snapshot.stats.racesRun, 1)
    assert.equal((await call('POST', `/races/${raceId}/finish`, { shiftSteps: [] }, token)).status, 404)
  })

  it('ranks players on the leaderboard', async () => {
    const { token } = await register('ranked')
    const r = await call<{ rows: { rank: number }[]; me: { rank: number } }>('GET', '/leaderboard?metric=value&scope=global', undefined, token)
    assert.equal(r.status, 200)
    assert.ok(r.body.rows.length > 10)
    assert.equal(r.body.rows[0].rank, 1)
    assert.ok(r.body.me.rank > 1)
  })

  it('upgrades a car and saves the profile', async () => {
    const { token } = await register('tuner')
    await call('POST', '/me/onboarding', { tastes: [] }, token)
    const carId = (await call('GET', '/me', undefined, token)).body.garage[0].carId
    const up = await call('POST', `/garage/${carId}/upgrade`, undefined, token)
    assert.equal(up.body.garage.find(g => g.carId === carId)!.level, 1)
    assert.equal(up.body.user.credits, 4000)

    const saved = await call('PUT', '/me', { username: 'tuner.2', email: 'tuner@test.fr', region: 'Japan', settings: { reduceMotion: true } }, token)
    assert.equal(saved.status, 200)
    assert.equal(saved.body.user.username, 'tuner.2')
    assert.equal(saved.body.user.settings.reduceMotion, true)
    assert.equal((await call('PUT', '/me', { username: 'J. Durand', email: 'tuner@test.fr' }, token)).status, 409)
  })
})
