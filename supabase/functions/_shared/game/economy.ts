import { MAX_LEVEL, type Car } from './types.ts'

/** Credits to go from level `n` to `n + 1`. */
export const UPGRADE_COST = [1000, 2000, 5000, 9000, 15000]

export const upgradeCost = (level: number): number | null => (level >= MAX_LEVEL ? null : UPGRADE_COST[level])

/** Per-level stat changes shown on the upgrade screen. */
export const UPGRADE_DELTA = { hp: 4, acc: -0.1, top: 2, kg: -2 } as const

export function upgradedStats(car: Car, level: number) {
  return {
    hp: car.hp + UPGRADE_DELTA.hp * level,
    acc: Math.max(1.8, +(car.acc + UPGRADE_DELTA.acc * level).toFixed(1)),
    top: car.top + UPGRADE_DELTA.top * level,
    kg: car.kg + UPGRADE_DELTA.kg * level,
  }
}

/** Market fee taken from the seller on a sale. */
export const MARKET_FEE = 0.05
export const marketFee = (price: number) => Math.round(price * MARKET_FEE)

/** Swap offers expire after 24 hours. */
export const SWAP_TTL_MS = 24 * 60 * 60 * 1000

/** XP per player level. */
export const XP_PER_LEVEL = 10000

export interface CreditBundle {
  id: string
  name: string
  credits: number
  /** Price in euro cents, VAT excluded */
  priceCents: number
  bestValue?: boolean
}

export const CREDIT_BUNDLES: CreditBundle[] = [
  { id: 'starter', name: 'Starter', credits: 5000, priceCents: 499 },
  { id: 'garage', name: 'Garage', credits: 20000, priceCents: 1799 },
  { id: 'collector', name: 'Collector', credits: 60000, priceCents: 4499, bestValue: true },
  { id: 'dealer', name: 'Dealer', credits: 150000, priceCents: 9999 },
]

export const VAT = 0.2
