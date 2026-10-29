// Prints the numbers used to tune the circuit race model: node scripts/tune-race.ts
import { CARS_BY_ID, CATALOG } from '../supabase/functions/_shared/game/catalog.ts'
import { autoDrive, raceSpec, replayCircuit } from '../supabase/functions/_shared/game/circuit.ts'
import { opponentTraces, seededRng } from '../supabase/functions/_shared/game/index.ts'
import { TRACKS, trackLength, type TrackId } from '../supabase/functions/_shared/game/tracks.ts'
import { TIERS } from '../supabase/functions/_shared/game/types.ts'

const ids = Object.keys(TRACKS) as TrackId[]
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]
const f = (n: number) => n.toFixed(1).padStart(5)

function drive(carId: string, track: TrackId, skill = 0, seed = 's', level = 0) {
  const spec = raceSpec(CARS_BY_ID[carId], level)
  const s = replayCircuit(spec, TRACKS[track], autoDrive(spec, TRACKS[track], seededRng(seed), skill))
  return s.finishTime || s.t
}

console.log('Perfect-play time (s): min / p25 / median / p75 / max')
for (const id of ids) {
  const all = CATALOG.map(c => drive(c.id, id))
  console.log(`${id.padEnd(7)} ${String(trackLength(TRACKS[id])).padStart(5)} m  all  ${[0, 0.25, 0.5, 0.75, 0.999].map(p => f(q(all, p))).join(' ')}`)
  for (const tier of TIERS) {
    const t = CATALOG.filter(c => c.tier === tier).map(c => drive(c.id, id))
    console.log(`${''.padEnd(14)} ${tier.padEnd(9)} ${[0, 0.25, 0.5, 0.75, 0.999].map(p => f(q(t, p))).join(' ')}`)
  }
}

console.log('\nBetween cars (s):', 'chiron', 'elise', 'plaid', 'mini')
for (const id of ids) console.log(id.padEnd(7), ['bugatti-chiron', 'lotus-elise-s1', 'tesla-model-s-plaid', 'mini-cooper-s'].map(c => f(drive(c, id))).join(' '))

console.log('\nSkill cost on sprint (caterham): ', [0, 0.04, 0.08, 0.12, 0.3, 0.5].map(k => f(drive('caterham-seven-620r', 'sprint', k))).join(' '))

console.log('\nSprint win rate, median car of each tier, 40 races')
for (const skill of [0, 0.1, 0.5]) {
  const row = TIERS.map(tier => {
    const cars = CATALOG.filter(c => c.tier === tier).map(c => ({ c, t: drive(c.id, 'sprint') })).sort((a, b) => a.t - b.t), car = cars[Math.floor(cars.length / 2)].c
    let wins = 0
    for (let i = 0; i < 40; i++) {
      const raceId = `race-${i}`
      wins += drive(car.id, 'sprint', skill, raceId) < Math.min(...opponentTraces(raceId, car, 'sprint').map(o => o.finishTime)) ? 1 : 0
    }
    return `${tier} ${(wins / 40).toFixed(2)}`
  })
  console.log(`skill ${skill}:`, row.join('  '))
}
