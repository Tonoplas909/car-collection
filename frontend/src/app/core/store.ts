import { Injectable, computed, inject, signal } from '@angular/core'
import type { PackOpening, RaceEntry, RaceResult, Settings, Snapshot } from '@api'
import type { PackId, RaceEventId, TasteId } from '@game'
import { ApiService } from './api.service'
import { TOKEN_KEY } from './auth.interceptor'

/**
 * App state as Signals. The server answers every mutation with the player's full Snapshot, so
 * actions only replace `snapshot`; screens derive everything else with computed().
 */
@Injectable({ providedIn: 'root' })
export class Store {
  private api = inject(ApiService)

  readonly status = signal<'loading' | 'ready'>('loading')
  readonly snapshot = signal<Snapshot | null>(null)
  /** Race setup choices, kept across the setup → live → results screens */
  readonly race = signal<{ eventId: RaceEventId; carId: string | null }>({ eventId: 'sprint', carId: null })
  readonly raceEntry = signal<RaceEntry | null>(null)
  readonly raceResult = signal<RaceResult | null>(null)
  readonly opening = signal<PackOpening | null>(null)
  readonly starter = signal<string[] | null>(null)
  readonly tastes = signal<TasteId[]>(['jdm', 'classics'])

  readonly signedIn = computed(() => !!this.snapshot())
  readonly user = computed(() => this.snapshot()?.user ?? null)
  readonly credits = computed(() => this.snapshot()?.user.credits ?? 0)

  /** The signed-in player's snapshot. Only use under routes that require a session. */
  snap(): Snapshot {
    const s = this.snapshot()
    if (!s) throw new Error('No session')
    return s
  }

  private setSnapshot(s: Snapshot | null) {
    this.snapshot.set(s)
    const root = document.documentElement
    if (s?.user.settings.reduceMotion) root.dataset['reduceMotion'] = 'true'
    else delete root.dataset['reduceMotion']
  }

  private async withSnapshot(p: Promise<Snapshot>) {
    const s = await p
    this.setSnapshot(s)
    return s
  }

  private saveToken(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch { /* storage blocked: the session lasts until reload */ }
  }

  /** Restores the session from the stored token (an expired token signs out). */
  async init() {
    try {
      const has = (() => { try { return !!localStorage.getItem(TOKEN_KEY) } catch { return false } })()
      if (has) this.setSnapshot(await this.api.me())
    } catch {
      this.saveToken(null)
      this.setSnapshot(null)
    }
    this.status.set('ready')
  }

  async signUp(input: { username: string; email: string; password: string }) {
    const r = await this.api.register(input)
    this.saveToken(r.token)
    this.setSnapshot(r.snapshot)
    this.starter.set(null)
    return r.snapshot
  }

  async signIn(input: { email: string; password: string }) {
    const r = await this.api.login(input)
    this.saveToken(r.token)
    this.setSnapshot(r.snapshot)
    return r.snapshot
  }

  /** The JWT is stateless: logging out forgets it on this device. */
  signOut() {
    this.saveToken(null)
    this.setSnapshot(null)
    this.raceEntry.set(null)
    this.raceResult.set(null)
    this.opening.set(null)
  }

  async completeOnboarding() {
    const { snapshot, carIds } = await this.api.completeOnboarding(this.tastes())
    this.setSnapshot(snapshot)
    this.starter.set(carIds)
    return carIds
  }

  async openPack(packId: PackId) {
    const { snapshot, opening } = await this.api.openPack(packId)
    this.setSnapshot(snapshot)
    this.opening.set(opening)
    return opening
  }

  async claimFreePack() {
    const { snapshot, opening } = await this.api.claimFreePack()
    this.setSnapshot(snapshot)
    this.opening.set(opening)
    return opening
  }

  buyListing(id: string) { return this.withSnapshot(this.api.buyListing(id)) }
  listCar(carId: string, price: number) { return this.withSnapshot(this.api.listCar(carId, price)) }
  cancelListing(id: string) { return this.withSnapshot(this.api.cancelListing(id)) }
  makeOffer(id: string, price: number) { return this.withSnapshot(this.api.makeOffer(id, price)) }
  proposeSwap(input: { to: string; give: string; get: string; credits: number }) { return this.withSnapshot(this.api.proposeSwap(input)) }
  acceptSwap(id: string) { return this.withSnapshot(this.api.acceptSwap(id)) }
  declineSwap(id: string) { return this.withSnapshot(this.api.declineSwap(id)) }
  upgradeCar(carId: string) { return this.withSnapshot(this.api.upgradeCar(carId)) }
  setShowcase(carIds: string[]) { return this.withSnapshot(this.api.setShowcase(carIds)) }
  topUp(bundleId: string) { return this.withSnapshot(this.api.topUp(bundleId)) }
  saveProfile(input: { username: string; email: string; region: string; settings: Settings }) { return this.withSnapshot(this.api.saveProfile(input)) }
  addFriend(username: string) { return this.withSnapshot(this.api.addFriend(username)) }

  setRace(patch: Partial<{ eventId: RaceEventId; carId: string | null }>) {
    this.race.update(r => ({ ...r, ...patch }))
  }

  async enterRace() {
    const { eventId, carId } = this.race()
    if (!carId) throw new Error('No car selected')
    const { snapshot, entry } = await this.api.enterRace(eventId, carId)
    this.setSnapshot(snapshot)
    this.raceEntry.set(entry)
    this.raceResult.set(null)
    return entry
  }

  async finishRace(shiftSteps: number[]) {
    const entry = this.raceEntry()
    if (!entry) throw new Error('No race in progress')
    const { snapshot, result } = await this.api.finishRace(entry.raceId, shiftSteps)
    this.setSnapshot(snapshot)
    this.raceResult.set(result)
    this.raceEntry.set(null)
    return result
  }

  leaderboard(...args: Parameters<ApiService['leaderboard']>) {
    return this.api.leaderboard(...args)
  }
}
