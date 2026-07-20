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

    // Create the auth user WITHOUT sending a magic-link email. Onboarding uses a
    // 6-digit code (emailed below) instead of a click-link, so email security
    // that pre-fetches links (e.g. Barracuda) can't consume a one-time link
    // before the person uses it. email_confirm:true marks the address verified.
    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (cuErr || !created?.user) {
      return json({ error: cuErr?.message || 'Could not create user' }, 400)
    }
    const uid = created.user.id

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

    // Email them their first sign-in code. resetPasswordForEmail sends the
    // "Reset password" email, whose template shows {{ .Token }} (a 6-digit code)
    // through the project's configured SMTP. No link for scanners to burn.
    let codeSent = true
    try {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const pub = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error: rErr } = await pub.auth.resetPasswordForEmail(email)
      if (rErr) codeSent = false
    } catch (_e) {
      codeSent = false
    }

    await admin.from('user_events').insert([
      { target_user_id: uid, by_user_id: createdBy, kind: 'created', text: `Added as ${role}.` },
      { target_user_id: uid, by_user_id: createdBy, kind: 'invite_sent', text: codeSent ? 'Sign-in code emailed.' : 'Created — code email pending.' },
    ])

    return json({ id: uid, bootstrap, codeSent })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
