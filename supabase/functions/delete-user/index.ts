// Supabase Edge Function: delete-user
// Permanently deletes a user. Uses the service-role key (server-side only) to
// remove the auth user, which cascades the matching profile row plus that user's
// events and notifications. References from other rows (intervention.consultant_id,
// beneficiary.project_manager_id, created_by, escalation owners, ...) are ON DELETE
// SET NULL, so nothing else breaks. Only ManCo / Exco may call this.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const body = await req.json().catch(() => ({}))
    const id: string = (body.id ?? '').trim()
    if (!id) return json({ error: 'id is required' }, 400)

    // Require an authenticated ManCo / Exco caller.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: userData, error: uErr } = await admin.auth.getUser(token)
    const caller = userData?.user
    if (uErr || !caller) return json({ error: 'Not authenticated' }, 401)
    const { data: prof } = await admin.from('profiles').select('role').eq('id', caller.id).single()
    if (!prof || (prof.role !== 'manco' && prof.role !== 'exco')) {
      return json({ error: 'Only ManCo or Exco can delete users' }, 403)
    }
    if (caller.id === id) return json({ error: 'You cannot delete your own account.' }, 400)

    // Delete the auth user. profiles.id references auth.users(id) ON DELETE CASCADE,
    // so the profile (and its cascaded events / notifications) go with it.
    const { error: dErr } = await admin.auth.admin.deleteUser(id)
    if (dErr) {
      // If there is no auth user (e.g. a profile created directly), remove the profile row.
      const { error: pErr } = await admin.from('profiles').delete().eq('id', id)
      if (pErr) return json({ error: dErr.message }, 400)
    }

    return json({ ok: true, id })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
