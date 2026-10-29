import { createClient, FunctionsHttpError } from '@supabase/supabase-js'
import { GameError, type GameApi, type Leaderboard, type PackOpening, type RaceEntry, type RaceResult, type Snapshot } from './types'

/**
 * GameApi on Supabase: reads and mutations are Postgres functions (see supabase/migrations),
 * pack rolls and race scoring are Edge Functions (supabase/functions/packs, races).
 */
export function createSupabaseApi(url: string, key: string): GameApi {
  const sb = createClient(url, key)

  /** Database and function errors are 'code|message[|needed]'. */
  function toGameError(message: string): GameError {
    const [code, text, needed] = message.split('|')
    const known = ['insufficient_credits', 'not_found', 'invalid', 'unauthenticated', 'not_configured'] as const
    const c = known.find(k => k === code)
    return c ? new GameError(c, text ?? message, needed ? Number(needed) : undefined) : new GameError('invalid', message)
  }

  /** A Discord account may share no email: the server then sends null where the app expects a string. */
  function withEmail<T>(value: T): T {
    const candidates = [value, (value as { snapshot?: unknown } | null)?.snapshot] as ({ user?: { email: string | null } } | null | undefined)[]
    for (const s of candidates) if (s?.user && s.user.email == null) s.user.email = ''
    return value
  }

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw toGameError(error.message)
    return withEmail(data as T)
  }

  async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.functions.invoke(fn, { body })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const payload = await error.context.json().catch(() => null)
        if (payload?.error) throw toGameError(payload.error)
      }
      throw new GameError('invalid', error.message)
    }
    return withEmail(data as T)
  }

  const snapshot = () => rpc<Snapshot>('get_snapshot')

  /** Where Discord sends the player back: the app's own callback route (the URL must be allowed in Supabase Auth). */
  const callbackUrl = (next?: string) =>
    `${location.origin}${import.meta.env.BASE_URL}auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`

  return {
    async load() {
      const { data } = await sb.auth.getSession()
      return data.session ? snapshot() : null
    },

    async signUp({ username, email, password }) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } })
      if (error) throw new GameError('invalid', error.message)
      if (!data.session) throw new GameError('invalid', 'Check your inbox to confirm your email, then log in.')
      return snapshot()
    },

    async signIn({ email, password }) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new GameError('unauthenticated', error.message)
      return snapshot()
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async signInWithDiscord() {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: callbackUrl(), scopes: 'identify email' } })
      if (error) throw new GameError('invalid', error.message)
      return null
    },

    async discord() {
      const { data } = await sb.auth.getUserIdentities()
      const identities = data?.identities ?? []
      const found = identities.find(i => i.provider === 'discord')
      if (!found) return null
      const meta = found.identity_data ?? {}
      return { name: String(meta.full_name ?? meta.user_name ?? meta.name ?? 'Discord'), canUnlink: identities.length > 1 }
    },

    async linkDiscord() {
      const { error } = await sb.auth.linkIdentity({ provider: 'discord', options: { redirectTo: callbackUrl('/settings'), scopes: 'identify email' } })
      if (error) throw new GameError('invalid', error.message)
      return null
    },

    async unlinkDiscord() {
      const { data } = await sb.auth.getUserIdentities()
      const found = data?.identities.find(i => i.provider === 'discord')
      if (!found) return
      const { error } = await sb.auth.unlinkIdentity(found)
      if (error) throw new GameError('invalid', error.message)
    },

    async completeOnboarding(tastes) {
      return invoke<{ snapshot: Snapshot; carIds: string[] }>('packs', { action: 'starter', tastes })
    },
    openPack: packId => invoke<{ snapshot: Snapshot; opening: PackOpening }>('packs', { action: 'open', packId }),
    claimFreePack: () => invoke<{ snapshot: Snapshot; opening: PackOpening }>('packs', { action: 'free' }),

    buyListing: id => rpc('buy_listing', { p_listing: id }),
    listCar: (carId, price) => rpc('list_car', { p_car: carId, p_price: Math.round(price) }),
    cancelListing: id => rpc('cancel_listing', { p_listing: id }),
    makeOffer: (id, price) => rpc('make_offer', { p_listing: id, p_price: Math.round(price) }),
    proposeSwap: ({ to, give, get, credits }) => rpc('propose_swap', { p_to: to, p_give: give, p_get: get, p_credits: Math.round(credits) }),
    acceptSwap: id => rpc('accept_swap', { p_offer: id }),
    declineSwap: id => rpc('decline_swap', { p_offer: id }),

    upgradeCar: carId => rpc('upgrade_car', { p_car: carId }),
    setShowcase: carIds => rpc('set_showcase', { p_cars: carIds }),

    enterRace: (eventId, carId) => rpc<{ snapshot: Snapshot; entry: RaceEntry }>('enter_race', { p_event: eventId, p_car: carId }),
    finishRace: (raceId, shiftSteps) => invoke<{ snapshot: Snapshot; result: RaceResult }>('races', { raceId, shiftSteps }),

    async topUp() {
      // Credit purchases need a payment provider (checkout + webhook that credits the account).
      throw new GameError('not_configured', 'Payments are not connected yet.')
    },

    async saveProfile({ username, email, region, settings }) {
      const { data } = await sb.auth.getUser()
      if (data.user && email.trim() && email.trim() !== data.user.email) {
        const { error } = await sb.auth.updateUser({ email: email.trim() })
        if (error) throw new GameError('invalid', error.message)
      }
      return rpc('save_profile', { p_username: username, p_region: region, p_settings: settings })
    },

    addFriend: username => rpc('add_friend', { p_username: username }),

    leaderboard: (metric, scope) => rpc<Leaderboard>('get_leaderboard', { p_metric: metric, p_scope: scope }),
  }
}
