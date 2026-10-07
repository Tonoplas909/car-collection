import { mockApi } from './mock'
import { createSupabaseApi } from './supabase'
import type { GameApi } from './types'

export * from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Supabase when configured (.env.local), otherwise the local mock backend. */
export const api: GameApi = url && key ? createSupabaseApi(url, key) : mockApi
export const backend: 'supabase' | 'mock' = url && key ? 'supabase' : 'mock'
