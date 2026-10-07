// Domain types shared by the web app and the Supabase Edge Functions.
// Keep this folder free of browser / Deno specific APIs.

export type Tier = 'Common' | 'Rare' | 'Epic' | 'Legendary'
export const TIERS: Tier[] = ['Common', 'Rare', 'Epic', 'Legendary']
export const TIER_RANK: Record<Tier, number> = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 }

export type PackId = 'street' | 'heritage' | 'apex'
export type TasteId = 'everyday' | 'jdm' | 'supercars' | 'classics' | 'rally' | 'concepts'

/** A car in the game catalog. */
export interface Car {
  id: string
  make: string
  model: string
  /** Generation / chassis code, e.g. "E30", "R34". Empty when the model has none. */
  gen: string
  year: number
  country: string
  /** ISO 3166 alpha-2 */
  cc: string
  tier: Tier
  hp: number
  /** Torque, Nm */
  nm: number
  /** 0–100 km/h, seconds */
  acc: number
  /** Top speed, km/h */
  top: number
  kg: number
  /** Reference market value, credits */
  value: number
  blurb: string
  pools: PackId[]
  tastes: TasteId[]
  photoUrl?: string
  /** "Author · License · Wikimedia Commons" */
  photoCredit?: string
  /** Wikipedia article title, used by the enrichment script */
  wiki?: string
  /** Specs and blurb checked by a human */
  reviewed?: boolean
}

/** A car in a player's garage. */
export interface OwnedCar {
  carId: string
  serial: number
  /** Upgrade level 0–5 */
  level: number
  acquiredAt: number
  showcase: boolean
}

export const MAX_LEVEL = 5

/** A random number source in [0, 1). Injected so rolls are testable and server-controlled. */
export type Rng = () => number
