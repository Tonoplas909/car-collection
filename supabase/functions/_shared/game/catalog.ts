import type { Car } from './types.ts'
import cars from './cars.json' with { type: 'json' }

// The catalog lives in cars.json (edit it there; `npm run cars:enrich` fills in photos and checks
// facts against Wikidata). Names, specs and values are drafts until `reviewed` is true. Values are
// game credits, not market prices. Real car names and imagery need licensing before a public launch.
export const CATALOG = cars as unknown as Car[]

export const CARS_BY_ID: Record<string, Car> = Object.fromEntries(CATALOG.map(c => [c.id, c]))

export function getCar(id: string): Car {
  const c = CARS_BY_ID[id]
  if (!c) throw new Error(`Unknown car: ${id}`)
  return c
}

/** "Skyline GT-R V-Spec R34" style label. */
export const carLabel = (c: Car) => (c.gen ? `${c.model} ${c.gen}` : c.model)
/** "Nissan · R34" or "Ferrari". */
export const makeGen = (c: Car) => (c.gen ? `${c.make} · ${c.gen}` : c.make)
