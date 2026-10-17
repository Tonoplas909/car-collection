import type { Listing, SwapOffer } from '@api'
import { TIER_RANK, type Car } from '@game'

export type Row = Listing & { car: Car }
export type Sort = 'tier' | 'priceDesc' | 'priceAsc' | 'name'

export const SORTERS: Record<Sort, (a: Row, b: Row) => number> = {
  tier: (a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.price - a.price,
  priceDesc: (a, b) => b.price - a.price,
  priceAsc: (a, b) => a.price - b.price,
  name: (a, b) => a.car.model.localeCompare(b.car.model),
}

/** Twelve weeks of sale prices around the 30-day average (sample until weekly sales are recorded). */
export function history(l: Listing) {
  const seed = [...l.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 97
  return Array.from({ length: 12 }, (_, i) => Math.round(l.avg * (0.86 + 0.24 * Math.abs(Math.sin(seed * 3.1 + i * 0.9)))))
}
export const delta = (l: Listing) => Math.round((l.price / l.avg - 1) * 100)
export const deltaStr = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}%`

export type DialogState =
  | { kind: 'buy'; row: Row }
  | { kind: 'offer'; row: Row }
  | { kind: 'trade'; row: Row }
  | { kind: 'swap'; offer: SwapOffer }
  | { kind: 'sell'; car: Car }
  | null
