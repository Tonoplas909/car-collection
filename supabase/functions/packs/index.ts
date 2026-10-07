// Pack openings: rolls happen here with server randomness, then apply_pack_opening charges the
// player and writes the cars in one transaction.
import { DUPLICATE_CREDITS, PACKS_BY_ID, TASTES, rollPack, rollStarterPack, type PackId, type TasteId } from '../_shared/game/index.ts'
import { call, fail, json, rng, serve } from '../_shared/http.ts'

serve(async (body, { userId, asUser, admin }) => {
  const action = body.action

  if (action === 'starter') {
    const tastes = (Array.isArray(body.tastes) ? body.tastes : []).filter((t): t is TasteId => TASTES.some(x => x.id === t))
    const carIds = rollStarterPack(tastes, rng)
    await call(admin, 'apply_starter_pack', { p_user: userId, p_cars: carIds })
    return json({ carIds, snapshot: await call(asUser, 'get_snapshot') })
  }

  if (action !== 'open' && action !== 'free') return fail('invalid|Unknown action.')
  const free = action === 'free'
  const pack = free ? PACKS_BY_ID.street : PACKS_BY_ID[body.packId as PackId]
  if (!pack) return fail('not_found|Unknown pack.')

  const [profile, owned] = await Promise.all([
    admin.from('profiles').select('pity').eq('id', userId).single(),
    admin.from('owned_cars').select('car_id').eq('user_id', userId),
  ])
  if (profile.error) return fail(`not_found|${profile.error.message}`)
  const roll = rollPack(pack, new Set((owned.data ?? []).map(o => o.car_id as string)), profile.data.pity as number, rng)

  const applied = await call<{ pulls: unknown[]; creditsBack: number }>(admin, 'apply_pack_opening', {
    p_user: userId,
    p_label: free ? 'free Street' : pack.name,
    p_price: pack.price,
    p_free: free,
    p_pulls: roll.pulls,
    p_dup_credits: DUPLICATE_CREDITS,
  })
  return json({
    opening: { packId: free ? 'free' : pack.id, pulls: applied.pulls, creditsBack: applied.creditsBack },
    snapshot: await call(asUser, 'get_snapshot'),
  })
})
