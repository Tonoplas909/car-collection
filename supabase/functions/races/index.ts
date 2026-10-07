// Race results: the client only submits the steps at which it shifted. The server replays the
// fixed-step simulation, ranks the field and applies the rewards.
import { CARS_BY_ID, RACE_EVENTS_BY_ID, carLabel, scoreRace, validShiftSteps, type RaceEventId } from '../_shared/game/index.ts'
import { call, fail, json, serve } from '../_shared/http.ts'

/** Allowance for the 3 s countdown, latency and clock skew when comparing against wall time. */
const SLACK_MS = 1500

serve(async (body, { userId, asUser, admin }) => {
  const { raceId, shiftSteps } = body
  if (typeof raceId !== 'string' || !validShiftSteps(shiftSteps)) return fail('invalid|Malformed race submission.')

  const { data: race, error } = await admin.from('races').select('*').eq('id', raceId).eq('user_id', userId).is('finished_at', null).maybeSingle()
  if (error || !race) return fail('not_found|This race has already been scored.', 404)

  const car = CARS_BY_ID[race.car_id as string]
  const ev = RACE_EVENTS_BY_ID[race.event_id as RaceEventId]
  const { data: profile } = await admin.from('profiles').select('username').eq('id', userId).single()
  const scored = scoreRace(
    { hp: car.hp, kg: car.kg, top: car.top, level: race.level as number },
    ev, shiftSteps,
    { name: `You · ${profile?.username ?? 'you'}`, car: `${car.make} ${carLabel(car)}` },
  )

  // A run cannot finish faster than real time since the race was entered.
  const elapsed = Date.now() - new Date(race.created_at as string).getTime()
  if (elapsed + SLACK_MS < scored.time * 1000) return fail('invalid|Race submitted before it could have finished.')

  const result = { raceId, eventId: ev.id, carId: car.id, ...scored }
  await call(admin, 'apply_race_result', { p_user: userId, p_race: raceId, p_result: result })
  return json({ result, snapshot: await call(asUser, 'get_snapshot') })
})
