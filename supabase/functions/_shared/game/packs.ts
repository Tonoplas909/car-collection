import { CATALOG } from './catalog.ts'
import { TIERS, TIER_RANK, type Car, type PackId, type Rng, type TasteId, type Tier } from './types.ts'

export interface PackDef {
  id: PackId
  name: string
  kicker: string
  desc: string
  price: number
  /** Probability per card for Common, Rare, Epic, Legendary (sums to 1). */
  odds: [number, number, number, number]
  /** At least `count` cards of `tier` or better. */
  guarantee: { count: number; tier: Tier }
}

export const CARDS_PER_PACK = 5
/** A Legendary is guaranteed in the pack that would otherwise be the 20th without one. */
export const PITY_LIMIT = 20

export const PACKS: PackDef[] = [
  { id: 'street', name: 'Street', kicker: 'Everyday', desc: 'Hot hatches, tuner cars and daily drivers.', price: 2000,
    odds: [0.72, 0.22, 0.05, 0.01], guarantee: { count: 1, tier: 'Rare' } },
  { id: 'heritage', name: 'Heritage', kicker: 'Classics', desc: 'Pre-1980 icons from Europe and Japan.', price: 8000,
    odds: [0.48, 0.34, 0.14, 0.04], guarantee: { count: 1, tier: 'Epic' } },
  { id: 'apex', name: 'Apex', kicker: 'Supercars', desc: 'Homologation specials and flagship supercars.', price: 25000,
    odds: [0, 0.45, 0.43, 0.12], guarantee: { count: 2, tier: 'Epic' } },
]

export const PACKS_BY_ID = Object.fromEntries(PACKS.map(p => [p.id, p])) as Record<PackId, PackDef>

/** Credits paid out when a pulled car is already in the garage. */
export const DUPLICATE_CREDITS: Record<Tier, number> = { Common: 300, Rare: 1200, Epic: 4000, Legendary: 15000 }

export interface Pull {
  carId: string
  tier: Tier
  duplicate: boolean
  credits: number
}

export interface PackRoll {
  pulls: Pull[]
  hasLegendary: boolean
  creditsBack: number
}

function pickTier(odds: number[], rng: Rng, minRank = 0): Tier {
  const weights = odds.map((w, i) => (i >= minRank ? w : 0))
  const total = weights.reduce((a, b) => a + b, 0)
  // A pack with no weight at or above the floor (should not happen with sane odds) falls back to the floor.
  if (total <= 0) return TIERS[minRank]
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return TIERS[i]
  }
  return TIERS[weights.length - 1]
}

function poolFor(tier: Tier, filter: (c: Car) => boolean): Car[] {
  const pool = CATALOG.filter(c => c.tier === tier && filter(c))
  return pool.length ? pool : CATALOG.filter(c => c.tier === tier)
}

function pickCar(pool: Car[], rng: Rng): Car {
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
}

/**
 * Roll the five cards of a pack.
 * - Each card's tier follows the published odds.
 * - The pack guarantee lifts the weakest cards up to the guaranteed tier.
 * - `packsSinceLegendary` drives the pity rule.
 * - Cards are ordered so the rarest comes last.
 */
export function rollPack(pack: PackDef, owned: ReadonlySet<string>, packsSinceLegendary: number, rng: Rng): PackRoll {
  const tiers: Tier[] = Array.from({ length: CARDS_PER_PACK }, () => pickTier(pack.odds, rng))

  const minRank = TIER_RANK[pack.guarantee.tier]
  tiers.sort((a, b) => TIER_RANK[a] - TIER_RANK[b])
  let meeting = tiers.filter(t => TIER_RANK[t] >= minRank).length
  for (let i = 0; meeting < pack.guarantee.count && i < tiers.length; i++) {
    if (TIER_RANK[tiers[i]] < minRank) {
      tiers[i] = pickTier(pack.odds, rng, minRank)
      meeting++
    }
  }

  if (packsSinceLegendary >= PITY_LIMIT - 1 && !tiers.includes('Legendary')) {
    tiers.sort((a, b) => TIER_RANK[a] - TIER_RANK[b])
    tiers[0] = 'Legendary'
  }
  tiers.sort((a, b) => TIER_RANK[a] - TIER_RANK[b])

  const seen = new Set(owned)
  const pulled = new Set<string>()
  let creditsBack = 0
  const pulls = tiers.map(tier => {
    // Avoid repeating a car inside one pack while the pool has alternatives.
    const pool = poolFor(tier, c => c.pools.includes(pack.id))
    const fresh = pool.filter(c => !pulled.has(c.id))
    const car = pickCar(fresh.length ? fresh : pool, rng)
    pulled.add(car.id)
    const duplicate = seen.has(car.id)
    seen.add(car.id)
    const credits = duplicate ? DUPLICATE_CREDITS[tier] : 0
    creditsBack += credits
    return { carId: car.id, tier, duplicate, credits }
  })
  return { pulls, hasLegendary: tiers.includes('Legendary'), creditsBack }
}

export interface Taste {
  id: TasteId
  name: string
  examples: string
}

export const TASTES: Taste[] = [
  { id: 'everyday', name: 'Everyday heroes', examples: 'Golf GTI, Mini Cooper, Civic Type R' },
  { id: 'jdm', name: 'JDM', examples: 'Skyline, Supra, RX-7, NSX' },
  { id: 'supercars', name: 'Supercars', examples: 'F40, Countach, McLaren F1' },
  { id: 'classics', name: 'Classics', examples: '300 SL, 240Z, 911 RS' },
  { id: 'rally', name: 'Rally', examples: 'Delta Integrale, Escort Cosworth' },
  { id: 'concepts', name: 'Concepts', examples: 'One-offs that never reached production' },
]

export const STARTER_PACK_SIZE = 3

/**
 * The free onboarding pack: three cars leaning toward the chosen tastes.
 * The first card is the hero (Epic or better), returned first so the reveal can lead with it.
 */
export function rollStarterPack(tastes: TasteId[], rng: Rng): string[] {
  const likes = (c: Car) => tastes.length === 0 || c.tastes.some(t => tastes.includes(t))
  const heroTier: Tier = rng() < 0.35 ? 'Legendary' : 'Epic'
  const ids: string[] = [pickCar(poolFor(heroTier, likes), rng).id]
  while (ids.length < STARTER_PACK_SIZE) {
    const tier: Tier = rng() < 0.6 ? 'Common' : 'Rare'
    const pool = poolFor(tier, c => likes(c) && !ids.includes(c.id))
    const car = pickCar(pool, rng)
    if (!ids.includes(car.id)) ids.push(car.id)
  }
  return ids
}
