import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { firstValueFrom } from 'rxjs'
import { TOKEN_KEY, authInterceptor } from './auth.interceptor'
import { GameError } from './game-error'

describe('authInterceptor', () => {
  let http: HttpClient
  let ctrl: HttpTestingController

  beforeEach(() => {
    localStorage.clear()
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    })
    http = TestBed.inject(HttpClient)
    ctrl = TestBed.inject(HttpTestingController)
  })

  afterEach(() => ctrl.verify())

  it('adds the bearer token to API calls', () => {
    localStorage.setItem(TOKEN_KEY, 'abc')
    http.get('/api/me').subscribe()
    expect(ctrl.expectOne('/api/me').request.headers.get('Authorization')).toBe('Bearer abc')
  })

  it('sends no header without a token', () => {
    http.get('/api/health').subscribe()
    expect(ctrl.expectOne('/api/health').request.headers.has('Authorization')).toBe(false)
  })

  it('turns an API error body into a GameError', async () => {
    const p = firstValueFrom(http.post('/api/packs/apex/open', {}))
    ctrl.expectOne('/api/packs/apex/open').flush(
      { error: { code: 'insufficient_credits', message: 'You need 25,000 CR.', needed: 25000 } },
      { status: 402, statusText: 'Payment Required' },
    )
    const err = await p.catch(e => e)
    expect(err).toBeInstanceOf(GameError)
    expect(err.code).toBe('insufficient_credits')
    expect(err.needed).toBe(25000)
  })
})
