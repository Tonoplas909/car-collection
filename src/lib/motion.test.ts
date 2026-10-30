import { afterEach, describe, expect, it, vi } from 'vitest'
import { reduced, systemPrefersReducedMotion } from './motion'

/** A page whose system asks for reduced motion (or not) and whose Settings toggle is on (or not). */
function page(system: boolean, setting: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: system && q.includes('prefers-reduced-motion') }))
  vi.stubGlobal('document', { documentElement: { dataset: setting ? { reduceMotion: 'true' } : {} } })
}

afterEach(() => vi.unstubAllGlobals())

describe('reduced motion', () => {
  it('plays the animations when the system asks for reduced motion but the Settings toggle is off', () => {
    // Windows reports "reduce" on many PCs whose owner never touched an animation setting
    page(true, false)
    expect(reduced()).toBe(false)
  })

  it('skips the animations when the Settings toggle is on, whatever the system says', () => {
    page(false, true)
    expect(reduced()).toBe(true)
    page(true, true)
    expect(reduced()).toBe(true)
  })

  it('plays the animations by default', () => {
    page(false, false)
    expect(reduced()).toBe(false)
  })

  it('still tells whether the system asks for reduced motion, so Settings can say so', () => {
    page(true, false)
    expect(systemPrefersReducedMotion()).toBe(true)
    page(false, false)
    expect(systemPrefersReducedMotion()).toBe(false)
  })
})
