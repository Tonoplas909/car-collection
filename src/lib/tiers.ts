import type { Tier } from '@game'

/** Rarity colours: common grey, rare blue, epic purple, legendary red (tokens in app.css). */
export const TIER_BAR: Record<Tier, string> = {
  Common: 'var(--tier-common)',
  Rare: 'var(--tier-rare)',
  Epic: 'var(--tier-epic)',
  Legendary: 'var(--tier-legendary)',
}

export const TIER_FG: Record<Tier, string> = {
  Common: 'var(--tier-common-fg)',
  Rare: 'var(--tier-rare-fg)',
  Epic: 'var(--tier-epic-fg)',
  Legendary: 'var(--tier-legendary-fg)',
}
