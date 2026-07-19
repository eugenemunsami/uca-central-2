// Supabase Edge Function: invite-user
// Creates an auth user + sends the invite email (needs the service-role key, so it
// must run server-side), then inserts the matching profile row. Called by the Admin
// screen's "Add user". The very first admin is bootstrapped when no profiles exist.
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
    const email: string = (body.email ?? '').trim()
    const full_name: string = (body.full_name ?? '').trim()
    const organisation: string | null = body.organisation ?? null
    const job_title: string | null = body.job_title ?? null
    const external_client_id: string | null = body.external_client_id ?? null
    const external_sponsor_id: string | null = body.external_sponsor_id ?? null
    const redirect_to: string | undefined = body.redirect_to || undefined
    let role: string = body.role ?? 'consultant'

    if (!email || !full_name) return json({ error: 'email and full_name are required' }, 400)

    // Bootstrap: if there are no profiles yet, allow creating the first admin
    // (ManCo) with no authenticated caller. Afterwards, require a ManCo/Exco caller.
    const { count, error: cErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
    if (cErr) return json({ error: 'Could not read profiles: ' + cErr.message }, 500)
    const bootstrap = (count ?? 0) === 0

    let createdBy: string | null = null
    let isAdmin = false

    if (bootstrap) {
      role = 'manco'
      isAdmin = true
    } else {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      const { data: userData, error: uErr } = await admin.auth.getUser(token)
      const caller = userData?.user
      if (uErr || !caller) return json({ error: 'Not authenticated' }, 401)
      const { data: prof } = await admin.from('profiles').select('role').eq('id', caller.id).single()
      if (!prof || (prof.role !== 'manco' && prof.role !== 'exco')) {
        return json({ error: 'Only ManCo or Exco can invite users' }, 403)
      }
      createdBy = caller.id
    }

    // Create the auth user and send the invite email.
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect_to,
      data: { full_name },
    })
    if (invErr || !invited?.user) {
      return json({ error: invErr?.message || 'Invite failed' }, 400)
    }
    const uid = invited.user.id

    const { error: pErr } = await admin.from('profiles').insert({
      id: uid,
      full_name,
      email,
      role,
      organisation,
      job_title,
      discipline: job_title,
      is_admin: isAdmin,
      active: false,
      status: 'pending',
      external_client_id,
      external_sponsor_id,
      invited_at: new Date().toISOString(),
      created_by: createdBy,
    })
    if (pErr) {
      // Roll back the auth user so a retry can succeed.
      await admin.auth.admin.deleteUser(uid)
      return json({ error: 'Profile insert failed: ' + pErr.message }, 400)
    }

    await admin.from('user_events').insert([
      { target_user_id: uid, by_user_id: createdBy, kind: 'created', text: `Invited as ${role}.` },
      { target_user_id: uid, by_user_id: createdBy, kind: 'invite_sent', text: 'Onboarding email sent.' },
    ])

    return json({ id: uid, bootstrap })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
