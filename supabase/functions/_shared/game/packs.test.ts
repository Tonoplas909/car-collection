import { describe, expect, it } from 'vitest'
import { CARS_BY_ID } from './catalog.ts'
import { DUPLICATE_CREDITS, PACKS_BY_ID, PITY_LIMIT, rollPack, rollStarterPack } from './packs.ts'
import { TIER_RANK } from './types.ts'

/** Deterministic PRNG (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('rollPack', () => {
  it('returns five cards ordered rarest last', () => {
    for (let s = 1; s < 200; s++) {
      const r = rollPack(PACKS_BY_ID.heritage, new Set(), 0, seeded(s))
      expect(r.pulls).toHaveLength(5)
      const ranks = r.pulls.map(p => TIER_RANK[p.tier])
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })

  it('honours each pack guarantee', () => {
    for (let s = 1; s < 300; s++) {
      const street = rollPack(PACKS_BY_ID.street, new Set(), 0, seeded(s))
      expect(street.pulls.filter(p => TIER_RANK[p.tier] >= TIER_RANK.Rare).length).toBeGreaterThanOrEqual(1)
      const apex = rollPack(PACKS_BY_ID.apex, new Set(), 0, seeded(s))
      expect(apex.pulls.filter(p => TIER_RANK[p.tier] >= TIER_RANK.Epic).length).toBeGreaterThanOrEqual(2)
      expect(apex.pulls.some(p => p.tier === 'Common')).toBe(false)
    }
  })

  it('pulls cars whose catalog tier matches the card tier', () => {
    const r = rollPack(PACKS_BY_ID.apex, new Set(), 0, seeded(7))
    for (const p of r.pulls) expect(CARS_BY_ID[p.carId].tier).toBe(p.tier)
  })

  it('forces a Legendary when the pity counter is due', () => {
    for (let s = 1; s < 100; s++) {
      const r = rollPack(PACKS_BY_ID.street, new Set(), PITY_LIMIT - 1, seeded(s))
      expect(r.hasLegendary).toBe(true)
      expect(r.pulls[4].tier).toBe('Legendary')
    }
  })

  it('marks owned cars and repeats within a pack as duplicates and pays credits', () => {
    const first = rollPack(PACKS_BY_ID.street, new Set(), 0, seeded(3))
    const owned = new Set(first.pulls.map(p => p.carId))
    const again = rollPack(PACKS_BY_ID.street, owned, 0, seeded(3))
    expect(again.pulls.every(p => p.duplicate)).toBe(true)
    expect(again.creditsBack).toBe(again.pulls.reduce((a, p) => a + DUPLICATE_CREDITS[p.tier], 0))
  })
})

describe('rollStarterPack', () => {
  it('gives three distinct cars with an Epic+ hero first', () => {
    for (let s = 1; s < 100; s++) {
      const ids = rollStarterPack(['jdm'], seeded(s))
      expect(new Set(ids).size).toBe(3)
      expect(TIER_RANK[CARS_BY_ID[ids[0]].tier]).toBeGreaterThanOrEqual(TIER_RANK.Epic)
    }
  })
})
