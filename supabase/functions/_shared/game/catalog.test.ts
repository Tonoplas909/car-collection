import { describe, expect, it } from 'vitest'
import { CATALOG } from './catalog.ts'
import { PACKS } from './packs.ts'
import { TIERS } from './types.ts'

describe('catalog', () => {
  it('has 200+ cars with unique ids', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(200)
    expect(new Set(CATALOG.map(c => c.id)).size).toBe(CATALOG.length)
  })

  it('has sane specs', () => {
    for (const c of CATALOG) {
      expect(c.hp, c.id).toBeGreaterThan(0)
      expect(c.kg, c.id).toBeGreaterThan(300)
      expect(c.top, c.id).toBeGreaterThan(50)
      expect(c.value, c.id).toBeGreaterThan(0)
      expect(c.blurb.length, c.id).toBeGreaterThan(20)
      expect(c.pools.length, c.id).toBeGreaterThan(0)
      expect(c.tastes.length, c.id).toBeGreaterThan(0)
    }
  })

  it('gives every card a pack can roll at least 3 candidates in its pool', () => {
    for (const pack of PACKS) {
      pack.odds.forEach((p, i) => {
        if (p === 0) return
        const n = CATALOG.filter(c => c.tier === TIERS[i] && c.pools.includes(pack.id)).length
        // Street has no Legendary pool by design: rare 1% pulls fall back to the whole tier.
        if (pack.id === 'street' && TIERS[i] === 'Legendary') return
        expect(n, `${pack.id} ${TIERS[i]}`).toBeGreaterThanOrEqual(3)
      })
    }
  })

  it('only uses attributed free-license photos from Wikimedia Commons', () => {
    for (const c of CATALOG.filter(c => c.photoUrl)) {
      expect(c.photoUrl, c.id).toContain('commons.wikimedia.org')
      expect(c.photoCredit, c.id).toMatch(/Wikimedia Commons$/)
    }
  })
})
