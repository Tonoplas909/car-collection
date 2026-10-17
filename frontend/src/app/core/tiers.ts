import type { Tier } from '@game'

export const TIER_BAR: Record<Tier, string> = {
  Common: 'var(--color-neutral-400)',
  Rare: 'var(--color-text)',
  Epic: 'var(--color-accent-400)',
  Legendary: 'var(--color-accent)',
}

export const TIER_FG: Record<Tier, string> = {
  Common: 'var(--color-neutral-700)',
  Rare: 'var(--color-text)',
  Epic: 'var(--color-accent-700)',
  Legendary: 'var(--color-accent-700)',
}
