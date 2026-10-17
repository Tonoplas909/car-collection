import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { firstValueFrom, type Observable } from 'rxjs'
import type {
  AuthResponse, Leaderboard, LeaderboardMetric, LeaderboardScope, PackOpening, RaceEntry, RaceResult, Settings, Snapshot,
} from '@api'
import type { PackId, RaceEventId, TasteId } from '@game'

/**
 * HTTP calls to the Express API (see API.md). Requests go to /api, proxied to the backend by
 * `ng serve` (proxy.conf.json). The JWT is added by authInterceptor; errors become GameError.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient)

  private call<T>(o: Observable<T>) {
    return firstValueFrom(o)
  }
  private get<T>(url: string, params?: HttpParams) { return this.call(this.http.get<T>(`/api${url}`, { params })) }
  private post<T>(url: string, body: unknown = {}) { return this.call(this.http.post<T>(`/api${url}`, body)) }
  private put<T>(url: string, body: unknown) { return this.call(this.http.put<T>(`/api${url}`, body)) }
  private delete<T>(url: string) { return this.call(this.http.delete<T>(`/api${url}`)) }

  register(input: { username: string; email: string; password: string }) { return this.post<AuthResponse>('/auth/register', input) }
  login(input: { email: string; password: string }) { return this.post<AuthResponse>('/auth/login', input) }
  me() { return this.get<Snapshot>('/me') }
  saveProfile(input: { username: string; email: string; region: string; settings: Settings }) { return this.put<Snapshot>('/me', input) }

  completeOnboarding(tastes: TasteId[]) { return this.post<{ snapshot: Snapshot; carIds: string[] }>('/me/onboarding', { tastes }) }
  openPack(packId: PackId) { return this.post<{ snapshot: Snapshot; opening: PackOpening }>(`/packs/${packId}/open`) }
  claimFreePack() { return this.post<{ snapshot: Snapshot; opening: PackOpening }>('/packs/free/open') }

  buyListing(id: string) { return this.post<Snapshot>(`/market/listings/${id}/buy`) }
  listCar(carId: string, price: number) { return this.post<Snapshot>('/market/listings', { carId, price: Math.round(price) }) }
  cancelListing(id: string) { return this.delete<Snapshot>(`/market/listings/${id}`) }
  makeOffer(id: string, price: number) { return this.post<Snapshot>(`/market/listings/${id}/offers`, { price: Math.round(price) }) }
  proposeSwap(input: { to: string; give: string; get: string; credits: number }) { return this.post<Snapshot>('/swaps', input) }
  acceptSwap(id: string) { return this.post<Snapshot>(`/swaps/${id}/accept`) }
  declineSwap(id: string) { return this.post<Snapshot>(`/swaps/${id}/decline`) }

  upgradeCar(carId: string) { return this.post<Snapshot>(`/garage/${carId}/upgrade`) }
  setShowcase(carIds: string[]) { return this.put<Snapshot>('/garage/showcase', { carIds }) }

  enterRace(eventId: RaceEventId, carId: string) { return this.post<{ snapshot: Snapshot; entry: RaceEntry }>('/races', { eventId, carId }) }
  finishRace(raceId: string, shiftSteps: number[]) { return this.post<{ snapshot: Snapshot; result: RaceResult }>(`/races/${raceId}/finish`, { shiftSteps }) }

  topUp(bundleId: string) { return this.post<Snapshot>('/credits/top-up', { bundleId }) }
  addFriend(username: string) { return this.post<Snapshot>('/friends', { username }) }

  leaderboard(metric: LeaderboardMetric, scope: LeaderboardScope) {
    return this.get<Leaderboard>('/leaderboard', new HttpParams().set('metric', metric).set('scope', scope))
  }
}
