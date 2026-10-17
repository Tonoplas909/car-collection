import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import type { Snapshot } from '@api'
import { TOKEN_KEY, authInterceptor } from './auth.interceptor'
import { Store } from './store'

const snapshot = (credits: number, reduceMotion = false) => ({
  user: { id: 'u1', username: 'tester', email: 't@x.fr', region: 'France', city: '', since: 0, level: 1, xp: 0, credits,
    settings: { sound: true, reduceMotion, notifications: true, showGarageValue: true } },
  stats: {}, garage: [], listings: [], offers: [], activity: [], friends: [], events: [], freePackAt: 0, seasonEndsAt: 0, season: 1,
}) as unknown as Snapshot

describe('Store', () => {
  let store: Store
  let ctrl: HttpTestingController

  beforeEach(() => {
    localStorage.clear()
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    })
    store = TestBed.inject(Store)
    ctrl = TestBed.inject(HttpTestingController)
  })

  it('keeps the token and the snapshot after logging in', async () => {
    const p = store.signIn({ email: 't@x.fr', password: 'Secret123!' })
    ctrl.expectOne('/api/auth/login').flush({ token: 'jwt', snapshot: snapshot(5000, true) })
    await p
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt')
    expect(store.signedIn()).toBe(true)
    expect(store.credits()).toBe(5000)
    expect(document.documentElement.dataset['reduceMotion']).toBe('true')
  })

  it('replaces the snapshot with the server answer after a mutation', async () => {
    const login = store.signIn({ email: 't@x.fr', password: 'x' })
    ctrl.expectOne('/api/auth/login').flush({ token: 'jwt', snapshot: snapshot(5000) })
    await login
    const up = store.upgradeCar('bmw-m3-e30')
    const req = ctrl.expectOne('/api/garage/bmw-m3-e30/upgrade')
    expect(req.request.method).toBe('POST')
    req.flush(snapshot(4000))
    await up
    expect(store.credits()).toBe(4000)
  })

  it('forgets the session on logout', () => {
    localStorage.setItem(TOKEN_KEY, 'jwt')
    store.signOut()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(store.signedIn()).toBe(false)
  })
})
