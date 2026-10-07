import { useSyncExternalStore } from 'react'
import type { PackId, RaceEventId, TasteId } from '@game'
import { api, type PackOpening, type RaceEntry, type RaceResult, type Settings, type Snapshot } from '../api'

export interface AppState {
  status: 'loading' | 'ready'
  snapshot: Snapshot | null
  /** Race setup choices, kept across the setup → live → results screens */
  race: { eventId: RaceEventId; carId: string | null }
  raceEntry: RaceEntry | null
  raceResult: RaceResult | null
  opening: PackOpening | null
  starter: string[] | null
  tastes: TasteId[]
}

let state: AppState = {
  status: 'loading',
  snapshot: null,
  race: { eventId: 'sprint', carId: null },
  raceEntry: null,
  raceResult: null,
  opening: null,
  starter: null,
  tastes: ['jdm', 'classics'],
}

const listeners = new Set<() => void>()

export function getState() {
  return state
}

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  if ('snapshot' in patch) applySettings(state.snapshot?.user.settings)
  listeners.forEach(l => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Subscribe to a slice of the app state. The selector must return a stable reference. */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}

/** The signed-in player's snapshot. Only use under routes that require a session. */
export function useSnapshot(): Snapshot {
  const s = useApp(st => st.snapshot)
  if (!s) throw new Error('useSnapshot used without a session')
  return s
}

function applySettings(settings: Settings | undefined) {
  const root = document.documentElement
  if (settings?.reduceMotion) root.dataset.reduceMotion = 'true'
  else delete root.dataset.reduceMotion
}

const withSnapshot = async (p: Promise<Snapshot>) => {
  const snapshot = await p
  setState({ snapshot })
  return snapshot
}

export const actions = {
  async init() {
    const snapshot = await api.load()
    setState({ status: 'ready', snapshot })
  },
  signUp: (input: { username: string; email: string; password: string }) => withSnapshot(api.signUp(input)),
  signIn: (input: { email: string; password: string }) => withSnapshot(api.signIn(input)),
  async signOut() {
    await api.signOut()
    setState({ snapshot: null, raceEntry: null, raceResult: null, opening: null })
  },
  setTastes: (tastes: TasteId[]) => setState({ tastes }),
  async completeOnboarding() {
    const { snapshot, carIds } = await api.completeOnboarding(state.tastes)
    setState({ snapshot, starter: carIds })
    return carIds
  },
  async openPack(packId: PackId) {
    const { snapshot, opening } = await api.openPack(packId)
    setState({ snapshot, opening })
    return opening
  },
  async claimFreePack() {
    const { snapshot, opening } = await api.claimFreePack()
    setState({ snapshot, opening })
    return opening
  },
  buyListing: (listingId: string) => withSnapshot(api.buyListing(listingId)),
  listCar: (carId: string, price: number) => withSnapshot(api.listCar(carId, price)),
  cancelListing: (listingId: string) => withSnapshot(api.cancelListing(listingId)),
  makeOffer: (listingId: string, price: number) => withSnapshot(api.makeOffer(listingId, price)),
  proposeSwap: (input: { to: string; give: string; get: string; credits: number }) => withSnapshot(api.proposeSwap(input)),
  acceptSwap: (offerId: string) => withSnapshot(api.acceptSwap(offerId)),
  declineSwap: (offerId: string) => withSnapshot(api.declineSwap(offerId)),
  upgradeCar: (carId: string) => withSnapshot(api.upgradeCar(carId)),
  setShowcase: (carIds: string[]) => withSnapshot(api.setShowcase(carIds)),
  setRace: (patch: Partial<AppState['race']>) => setState({ race: { ...state.race, ...patch } }),
  async enterRace() {
    const { eventId, carId } = state.race
    if (!carId) throw new Error('No car selected')
    const { snapshot, entry } = await api.enterRace(eventId, carId)
    setState({ snapshot, raceEntry: entry, raceResult: null })
    return entry
  },
  async finishRace(shiftSteps: number[]) {
    const entry = state.raceEntry
    if (!entry) throw new Error('No race in progress')
    const { snapshot, result } = await api.finishRace(entry.raceId, shiftSteps)
    setState({ snapshot, raceResult: result, raceEntry: null })
    return result
  },
  topUp: (bundleId: string) => withSnapshot(api.topUp(bundleId)),
  saveProfile: (input: { username: string; email: string; region: string; settings: Settings }) => withSnapshot(api.saveProfile(input)),
  addFriend: (username: string) => withSnapshot(api.addFriend(username)),
}
