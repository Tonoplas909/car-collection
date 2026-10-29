// Opponents are real catalog cars drawn from the race id, so the client and the server get the same
// field without storing anything: three cars of the player's tier, never the player's own.
import { CATALOG } from './catalog.ts'
import type { Car, Rng } from './types.ts'

export const OPPONENT_NAMES = [
  'bayside.r', 'rallye.b', 'touge.t', 'hakone.k', 'apex.hunter', 'nurb.lap', 'redline.m', 'sunday.s',
  'pitlane.p', 'kerb.k', 'slipstream.s', 'boxer.b', 'e30.fan', 'drift.d',
]

/** Share of the ideal braking point each opponent can be off by; see `autoDrive`. */
const SKILLS = [0.04, 0.08, 0.12]

/** A driver in the field: `skill` is how far off the ideal line they drive (0 = perfect). */
export interface Rival {
  name: string
  car: Car
  skill: number
}

/** Deterministic generator from a string (xmur-style hash into mulberry32). */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `n` distinct items of `items`, picked with `rng` (partial Fisher-Yates). */
function pick<T>(items: readonly T[], n: number, rng: Rng): T[] {
  const pool = [...items]
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

export function opponentsFor(raceId: string, player: Car): Rival[] {
  const rng = seededRng(raceId)
  const cars = pick(CATALOG.filter(c => c.tier === player.tier && c.id !== player.id), 3, rng)
  const names = pick(OPPONENT_NAMES, 3, rng)
  const skills = pick(SKILLS, 3, rng)
  return cars.map((car, i) => ({ name: names[i], car, skill: skills[i] }))
}
