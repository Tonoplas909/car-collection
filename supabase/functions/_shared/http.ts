import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Errors use the same 'code|message[|needed]' convention as the database functions. */
export const fail = (message: string, status = 400) => json({ error: message }, status)

/** Cryptographic randomness for rolls; the client never supplies a seed. */
export const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

export interface Ctx {
  userId: string
  /** Acts as the caller (RLS applies, auth.uid() is set) */
  asUser: SupabaseClient
  /** Service role, for the apply_* functions only */
  admin: SupabaseClient
}

/** Wraps a handler with CORS, auth and error mapping. */
export function serve(handler: (body: Record<string, unknown>, ctx: Ctx) => Promise<Response>) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return fail('invalid|Use POST.', 405)
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    })
    const { data, error } = await asUser.auth.getUser()
    if (error || !data.user) return fail('unauthenticated|Sign in to continue.', 401)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      return await handler(body, { userId: data.user.id, asUser, admin })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return fail(message.includes('|') ? message : `invalid|${message}`, 500)
    }
  })
}

/** Runs an RPC and throws its error message (already in 'code|message' form). */
export async function call<T>(client: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
