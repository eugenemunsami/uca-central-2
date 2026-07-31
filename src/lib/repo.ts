import { LIVE, supabase } from './supabase'
import * as seed from './demo'
import { computeRag, worst } from './rag'
import { ONB_STATUS_OWNER, ONB_ESC_STATUSES, ONB_TERMINAL, ONB_OWNER_LABEL } from './types'
import type {
  Aggregator, Beneficiary, BeneficiaryEvent, BeneficiaryView, CatalogueItem, Comm, Escalation,
  EscalationEvent, EscalationView, EscStatus, EscSuggestion, Intervention, InterventionView,
  Notification, Profile, Rag, RagOverride, Role, Sponsor, UserEvent, UserStatus, WeeklyUpdate,
  Onboarding, OnboardingEvent, OnboardingView, OnbStatus, OnbOwnerRole, OnbEventKind,
  WelcomeParty, WelcomePartyInvite,
} from './types'

const uid = () => Math.random().toString(36).slice(2, 10)

const db = {
  profiles: [...seed.profiles],
  aggregators: [...seed.aggregators],
  sponsors: [...seed.sponsors],
  catalogue: [...seed.catalogue],
  beneficiaries: [...seed.beneficiaries],
  interventions: [...seed.interventions],
  updates: [...seed.weeklyUpdates],
  comms: [...seed.comms],
  escalations: [...seed.escalations],
  events: [...seed.escalationEvents],
  benEvents: [...seed.beneficiaryEvents],
  userEvents: [...seed.userEvents],
  notifications: [...seed.notifications],
  overrides: [...seed.ragOverrides],
  onboardings: [...seed.onboardings],
  welcomeParties: [...seed.welcomeParties],
  welcomePartyInvites: [...seed.welcomePartyInvites],
  onboardingEvents: [...seed.onboardingEvents],
}

const listeners = new Set<() => void>()
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) }
const ping = () => listeners.forEach(fn => fn())

function decorateIv(i: Intervention): InterventionView {
  const { rag, reason, daysAwaiting, lastUpdateAt } = computeRag(i, db.updates, db.escalations)
  const c = db.catalogue.find(c => c.id === i.catalogue_id)
  const consultant = db.profiles.find(p => p.id === i.consultant_id)
  const ben = db.beneficiaries.find(b => b.id === i.beneficiary_id)
  return {
    ...i, rag, rag_reason: reason, days_awaiting: daysAwaiting, last_update_at: lastUpdateAt,
    title: i.kind === 'custom' ? (i.custom_name ?? 'Custom intervention') : (c?.name ?? 'Intervention'),
    category: i.kind === 'custom' ? `Custom · ${i.custom_kind ?? 'other'}` : (c?.category ?? '-'),
    consultant_name: consultant?.full_name ?? null,
    beneficiary_name: ben?.name ?? '-',
  }
}

function decorateBen(b: Beneficiary): BeneficiaryView {
  const allIvs = db.interventions.filter(i => i.beneficiary_id === b.id && !i.removed_at).map(decorateIv)
  const ivs = allIvs.filter(i => !i.cancelled && (i.cycle ?? 1) === (b.cycle ?? 1))  // current cycle only
  const sponsor = db.sponsors.find(s => s.id === b.sponsor_id)
  const aggregator = db.aggregators.find(a => a.id === sponsor?.aggregator_id)
  const esc = db.escalations.find(e => e.beneficiary_id === b.id && e.status !== 'resolved')
  const pm = db.profiles.find(p => p.id === b.project_manager_id)
  const latest = db.updates
    .filter(u => ivs.some(i => i.id === u.intervention_id))
    .sort((a, z) => z.created_at.localeCompare(a.created_at))[0]
  const rag: Rag = b.rag_override ?? (ivs.length ? worst(ivs.map(i => i.rag)) : 'green')
  const recipient_ids = db.profiles.filter(p => p.role === 'external' && (
    (b.sponsor_id && p.external_sponsor_id === b.sponsor_id) ||
    (aggregator && p.external_client_id === aggregator.id))).map(p => p.id)
  const allClosed = ivs.length > 0 && ivs.every(i => i.closeout_status === 'confirmed')
  return {
    ...b, rag,
    active_intervention_count: ivs.length,
    all_interventions_closed: allClosed,
    recipient_ids,
    // top-level grouping label = aggregator when present, else the standalone sponsor
    client_name: aggregator?.name ?? sponsor?.name ?? '-',
    client_id: aggregator?.id ?? sponsor?.id ?? '',
    sponsor_name: sponsor?.name ?? null,
    aggregator_id: aggregator?.id ?? null,
    aggregator_name: aggregator?.name ?? null,
    escalated: Boolean(esc), escalation_reason: esc?.reason ?? null,
    intervention_count: ivs.length,
    completed_count: ivs.filter(i => i.status === 'completed').length,
    pm_name: pm?.full_name ?? null,
    next_action: latest?.next_action ?? null,
    last_update_at: latest?.created_at ?? null,
  }
}

const isMancoId = (id?: string | null) => {
  const p = db.profiles.find(x => x.id === id)
  return Boolean(p && (p.role === 'manco' || p.role === 'exco'))
}

function pushEvent(escId: string, userId: string | null, kind: EscalationEvent['kind'], text?: string | null) {
  db.events.unshift({
    id: uid(), escalation_id: escId, at: new Date().toISOString(),
    user_id: userId, kind, text: text ?? null,
  })
}

function notify(userIds: string[], kind: Notification['kind'], text: string, escId: string) {
  const seen = new Set<string>()
  userIds.filter(Boolean).forEach(uidv => {
    if (seen.has(uidv)) return
    seen.add(uidv)
    db.notifications.unshift({
      id: uid(), user_id: uidv, at: new Date().toISOString(), kind, text, escalation_id: escId, read: false,
    })
  })
}

function escRole(userId: string | null): 'consultant' | 'manco' | 'external' {
  const p = db.profiles.find(x => x.id === userId)
  if (p?.role === 'manco' || p?.role === 'exco') return 'manco'
  if (p?.role === 'external') return 'external'
  return 'consultant'
}

// Push an audit event capturing the ownership/status transition.
function pushEscEvent(escId: string, userId: string | null, kind: EscalationEvent['kind'], opts: {
  from_status?: EscStatus; to_status?: EscStatus; from_owner_id?: string | null; to_owner_id?: string | null; text?: string | null
} = {}) {
  db.events.unshift({
    id: uid(), escalation_id: escId, at: new Date().toISOString(), user_id: userId, kind,
    from_status: opts.from_status ?? null, to_status: opts.to_status ?? null,
    from_owner_id: opts.from_owner_id ?? null, to_owner_id: opts.to_owner_id ?? null,
    text: opts.text ?? null,
  })
}

// Notify every participant of an escalation. action_owner gets action_required=true.
function notifyEsc(e: Escalation, actorId: string | null, text: string, actionOwnerId: string | null) {
  const seen = new Set<string>()
  e.participants.forEach(uidv => {
    if (!uidv || uidv === actorId || seen.has(uidv)) return
    seen.add(uidv)
    db.notifications.unshift({
      id: uid(), user_id: uidv, at: new Date().toISOString(), kind: 'escalation_released',
      text, escalation_id: e.id, action_required: uidv === actionOwnerId, read: false,
    })
  })
}

function decorateEsc(e: Escalation): EscalationView {
  const ben = db.beneficiaries.find(b => b.id === e.beneficiary_id)
  const benView = ben ? decorateBen(ben) : null
  const iv = db.interventions.find(i => i.id === e.intervention_id)
  const owner = db.profiles.find(p => p.id === e.current_owner_id)
  const consultant = db.profiles.find(p => p.id === e.consultant_id)
  const ttr = e.resolved_at
    ? Math.max(0, Math.round((new Date(e.resolved_at).getTime() - new Date(e.raised_at).getTime()) / 86400000))
    : null
  return {
    ...e,
    beneficiary_name: ben?.name ?? '-',
    intervention_title: iv ? repo._ivTitle(iv) : 'Intervention',
    client_id: benView?.client_id ?? '',
    owner_name: owner?.full_name ?? null,
    owner_org: owner?.organisation ?? owner?.discipline ?? null,
    consultant_name: consultant?.full_name ?? null,
    time_to_resolve_days: ttr,
  }
}

function decorateOnb(o: Onboarding): OnboardingView {
  const sponsor = db.sponsors.find(s => s.id === o.sponsor_id)
  const aggregator = db.aggregators.find(a => a.id === sponsor?.aggregator_id)
  const owner = db.profiles.find(p => p.id === o.current_owner_id)
  const manco = db.profiles.find(p => p.id === o.manco_id)
  const consultant = db.profiles.find(p => p.id === o.consultant_id)
  const party = db.welcomeParties.find(w => w.id === o.welcome_party_id)
  return {
    ...o,
    sponsor_name: sponsor?.name ?? '-',
    client_name: aggregator?.name ?? sponsor?.name ?? '-',
    client_id: aggregator?.id ?? sponsor?.id ?? '',
    owner_name: owner?.full_name ?? null,
    owner_org: owner?.organisation ?? owner?.discipline ?? null,
    manco_name: manco?.full_name ?? null,
    consultant_name: consultant?.full_name ?? null,
    welcome_party_date: party?.party_date ?? null,
    is_red: o.status === 'red_no_show' || (o.missed_welcome_parties ?? 0) >= 2,
  }
}

function pushUserEvent(targetId: string, byId: string | null, kind: UserEvent['kind'], text?: string | null) {
  db.userEvents.unshift({ id: uid(), target_user_id: targetId, at: new Date().toISOString(), by_user_id: byId, kind, text: text ?? null })
}

function sweepInviteExpiry() {
  db.profiles.forEach(pr => {
    if (pr.status === 'pending' && pr.invite_expires_at && new Date(pr.invite_expires_at) < new Date()) {
      pr.status = 'invitation_expired'
      pushUserEvent(pr.id, null, 'invite_expired', 'Invitation window elapsed.')
    }
  })
}

function pushBenEvent(benId: string, userId: string | null, kind: BeneficiaryEvent['kind'], text?: string | null) {
  db.benEvents.unshift({
    id: uid(), beneficiary_id: benId, at: new Date().toISOString(),
    user_id: userId, kind, text: text ?? null,
  })
}

// Auto-flag: when every active intervention is confirmed closed, the beneficiary moves
// into the ManCo "Close-outs to approve" queue (pending_closeout) exactly once.
function sweepBeneficiaryCloseout() {
  db.beneficiaries.forEach(b => {
    if (b.lifecycle !== 'active') return
    const ivs = db.interventions.filter(i => i.beneficiary_id === b.id && !i.cancelled && !i.removed_at && (i.cycle ?? 1) === (b.cycle ?? 1))
    if (ivs.length === 0) return
    if (!ivs.every(i => i.closeout_status === 'confirmed')) return
    b.lifecycle = 'pending_closeout'
    pushBenEvent(b.id, null, 'note', 'All interventions closed out — ready for beneficiary close-out.')
    db.profiles.filter(p => p.role === 'manco' || p.role === 'exco').forEach(p =>
      notify([p.id], 'beneficiary_closeout_ready', `${b.name} is ready for beneficiary close-out.`, ''))
  })
}

// Early warning: when an intervention first goes red on a breach and there is no active
// escalation, alert the consultant + owner internally (once) before it escalates to a client.
function sweepEarlyWarning() {
  db.interventions.forEach(i => {
    if (i.cancelled || i.removed_at || i.status === 'completed' || i.closeout_status === 'requested') return
    const { rag } = computeRag(i, db.updates, db.escalations)
    if (rag !== 'red') return
    if (db.escalations.some(e => e.intervention_id === i.id && e.status !== 'resolved')) return
    const key = 'sla:' + i.id
    if (db.notifications.some(n => n.escalation_id === key)) return
    const b = db.beneficiaries.find(x => x.id === i.beneficiary_id)
    const targets = [i.consultant_id, b?.project_manager_id].filter(Boolean) as string[]
    if (targets.length === 0) return
    db.notifications.unshift({
      id: uid(), user_id: targets[0], at: new Date().toISOString(),
      kind: 'sla_breach_internal', text: `SLA breach on ${b?.name ?? 'a beneficiary'} — act before it escalates.`,
      escalation_id: key, read: false,
    })
    targets.slice(1).forEach(t => db.notifications.unshift({
      id: uid(), user_id: t, at: new Date().toISOString(),
      kind: 'sla_breach_internal', text: `SLA breach on ${b?.name ?? 'a beneficiary'} — act before it escalates.`,
      escalation_id: key, read: false,
    }))
  })
}

async function sb<T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await fn()
  if (error) throw error
  return (data ?? []) as T
}

// Pull the human-readable message out of a Supabase Edge Function error response.
async function readFnError(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
    }
  } catch { /* fall through */ }
  return (error as { message?: string })?.message ?? 'Invite failed'
}

export const repo = {
  live: LIVE,

  async profiles(): Promise<Profile[]> {
    if (!LIVE) { sweepInviteExpiry(); return db.profiles.filter(p => !p.removed_at) }
    const rows = await sb<Profile[]>(() => supabase!.from('profiles').select('*').order('full_name') as never)
    // Admin-hidden users are kept in the DB but must not appear anywhere in the app.
    // Fails soft (nothing hidden) if the removed_at column isn't there yet.
    return rows.filter(p => !p.removed_at)
  },

  // Admin-only: EVERY user including admin-hidden ones (so they can be restored / deleted).
  async profilesAdmin(): Promise<Profile[]> {
    if (!LIVE) { sweepInviteExpiry(); return [...db.profiles] }
    return sb<Profile[]>(() => supabase!.from('profiles').select('*').order('full_name') as never)
  },

  async orgs(): Promise<{ aggregators: Aggregator[]; sponsors: Sponsor[] }> {
    if (!LIVE) return { aggregators: [...db.aggregators], sponsors: [...db.sponsors] }
    const [aggregators, sponsors] = await Promise.all([
      sb<Aggregator[]>(() => supabase!.from('aggregators').select('*').order('name') as never),
      sb<Sponsor[]>(() => supabase!.from('sponsors').select('*').order('name') as never),
    ])
    return { aggregators, sponsors }
  },

  async addAggregator(name: string) {
    if (LIVE) { await supabase!.from('aggregators').insert({ name }); return }
    db.aggregators.push({ id: uid(), name })
    ping()
  },

  async addSponsor(name: string, aggregatorId: string | null) {
    if (LIVE) { await supabase!.from('sponsors').insert({ name, aggregator_id: aggregatorId }); return }
    db.sponsors.push({ id: uid(), name, aggregator_id: aggregatorId })
    ping()
  },

  async catalogue(): Promise<CatalogueItem[]> {
    if (!LIVE) return [...db.catalogue]
    return sb<CatalogueItem[]>(() =>
      supabase!.from('intervention_catalogue').select('*').order('category').order('name') as never)
  },

  // LIVE: the admin soft-hide flag is read from the BASE table, not the RAG view.
  // The v_*_rag views select b.*/i.*, which Postgres freezes at view-creation, so a
  // newly-added removed_at column may not surface there. Reading the base table keeps
  // this correct without forcing a view rebuild. Fails soft (nothing hidden) if the
  // column isn't there yet (code deployed before the migration ran).
  async _removedMap(table: 'beneficiaries' | 'interventions'): Promise<Map<string, string>> {
    if (!LIVE) return new Map()
    try {
      const rows = await sb<{ id: string; removed_at: string | null }[]>(() =>
        supabase!.from(table).select('id, removed_at').not('removed_at', 'is', null) as never)
      return new Map(rows.filter(r => r.removed_at).map(r => [r.id, r.removed_at as string]))
    } catch { return new Map() }
  },

  async beneficiaries(): Promise<BeneficiaryView[]> {
    if (!LIVE) { sweepBeneficiaryCloseout(); sweepEarlyWarning(); return db.beneficiaries.filter(b => !b.removed_at).map(decorateBen) }
    const [rows, hidden] = await Promise.all([
      sb<BeneficiaryView[]>(() => supabase!.from('v_beneficiary_rag').select('*').order('name') as never),
      repo._removedMap('beneficiaries'),
    ])
    return rows.filter(b => !hidden.has(b.id))
  },

  // Admin-only: EVERY beneficiary including admin-hidden ones (so they can be restored / purged).
  async beneficiariesAdmin(): Promise<BeneficiaryView[]> {
    if (!LIVE) { sweepBeneficiaryCloseout(); sweepEarlyWarning(); return db.beneficiaries.map(decorateBen) }
    const [rows, hidden] = await Promise.all([
      sb<BeneficiaryView[]>(() => supabase!.from('v_beneficiary_rag').select('*').order('name') as never),
      repo._removedMap('beneficiaries'),
    ])
    return rows.map(b => ({ ...b, removed_at: hidden.get(b.id) ?? null }))
  },

  async interventions(): Promise<InterventionView[]> {
    if (!LIVE) return db.interventions.filter(i => !i.removed_at).map(decorateIv)
    const [rows, hidden] = await Promise.all([
      sb<InterventionView[]>(() => supabase!.from('v_intervention_rag').select('*') as never),
      repo._removedMap('interventions'),
    ])
    return rows.filter(i => !hidden.has(i.id))
  },

  // Admin-only: EVERY intervention including admin-hidden ones.
  async interventionsAdmin(): Promise<InterventionView[]> {
    if (!LIVE) return db.interventions.map(decorateIv)
    const [rows, hidden] = await Promise.all([
      sb<InterventionView[]>(() => supabase!.from('v_intervention_rag').select('*') as never),
      repo._removedMap('interventions'),
    ])
    return rows.map(i => ({ ...i, removed_at: hidden.get(i.id) ?? null }))
  },

  async updates(): Promise<WeeklyUpdate[]> {
    if (!LIVE) return [...db.updates]
    return sb<WeeklyUpdate[]>(() => supabase!.from('weekly_updates').select('*').order('created_at', { ascending: false }) as never)
  },

  async comms(): Promise<Comm[]> {
    if (!LIVE) return [...db.comms]
    return sb<Comm[]>(() => supabase!.from('comms_log').select('*').order('occurred_at', { ascending: false }) as never)
  },

  async escalations(): Promise<EscalationView[]> {
    if (!LIVE) return db.escalations.map(decorateEsc)
    return sb<EscalationView[]>(() => supabase!.from('v_escalation').select('*').order('raised_at', { ascending: false }) as never)
  },

  async escalationEvents(): Promise<EscalationEvent[]> {
    if (!LIVE) return [...db.events]
    return sb<EscalationEvent[]>(() => supabase!.from('escalation_events').select('*').order('at', { ascending: false }) as never)
  },

  async benEvents(): Promise<BeneficiaryEvent[]> {
    if (!LIVE) return [...db.benEvents]
    return sb<BeneficiaryEvent[]>(() => supabase!.from('beneficiary_events').select('*').order('at', { ascending: false }) as never)
  },

  async userEvents(): Promise<UserEvent[]> {
    if (!LIVE) return [...db.userEvents]
    return sb<UserEvent[]>(() => supabase!.from('user_events').select('*').order('at', { ascending: false }) as never)
  },

  async notifications(): Promise<Notification[]> {
    if (!LIVE) return [...db.notifications]
    return sb<Notification[]>(() => supabase!.from('notifications').select('*').order('at', { ascending: false }) as never)
  },

  // breaches not yet escalated -> the "Suggested escalations" queue (computed, never stored)
  async suggestedEscalations(): Promise<EscSuggestion[]> {
    const ivs = await repo.interventions()
    const active = new Set(db.escalations.filter(e => e.status !== 'resolved' && e.intervention_id).map(e => e.intervention_id))
    return ivs
      .filter(i => i.status !== 'completed' && i.closeout_status !== 'requested')
      .filter(i => i.rag === 'red' && (i.days_awaiting !== null || (i.due_date && new Date(i.due_date) < new Date())))
      .filter(i => !active.has(i.id))
      .map(i => ({
        key: `sg-${i.id}`,
        beneficiary_id: i.beneficiary_id,
        beneficiary_name: i.beneficiary_name,
        intervention_id: i.id,
        intervention_title: i.title,
        trigger: (i.days_awaiting !== null && i.days_awaiting >= 3) ? 'no_response_3_days' : 'overdue',
        reason: i.rag_reason ?? 'SLA breach',
      }))
  },

  async overrides(): Promise<RagOverride[]> {
    if (!LIVE) return [...db.overrides]
    return sb<RagOverride[]>(() => supabase!.from('rag_overrides').select('*').order('created_at', { ascending: false }) as never)
  },

  // ---------------- writes ----------------
  async addBeneficiary(input: Partial<Beneficiary> & { name: string; sponsor_id: string }) {
    if (LIVE) {
      const rows = await sb<{ id: string }[]>(() => supabase!.from('beneficiaries').insert(input).select('id') as never)
      const nid = rows[0]?.id
      if (nid) { try { await supabase!.from('beneficiary_events').insert({ beneficiary_id: nid, user_id: input.project_manager_id ?? null, kind: 'loaded', text: null }) } catch { /* audit best-effort */ } }
      ping(); return
    }
    const nb = {
      id: uid(), stage: 'implementation', missed_welcome_parties: 0, needs_onsite: false,
      directors: [], lifecycle: 'active', cycle: 1, created_at: new Date().toISOString(), ...input,
    } as Beneficiary
    db.beneficiaries.push(nb)
    pushBenEvent(nb.id, nb.project_manager_id ?? null, 'loaded', null)
    ping()
  },

  // Bulk load a whole cohort at once (used by the Excel importer).
  async addBeneficiaries(rows: (Partial<Beneficiary> & { name: string; sponsor_id: string })[]) {
    if (LIVE) {
      const created = await sb<{ id: string; project_manager_id: string | null }[]>(() => supabase!.from('beneficiaries').insert(rows).select('id, project_manager_id') as never)
      if (created.length) { try { await supabase!.from('beneficiary_events').insert(created.map(b => ({ beneficiary_id: b.id, user_id: b.project_manager_id ?? null, kind: 'loaded', text: null }))) } catch { /* audit best-effort */ } }
      ping(); return
    }
    rows.forEach(input => {
      const nb = {
        id: uid(), stage: 'implementation', missed_welcome_parties: 0, needs_onsite: false,
        directors: [], lifecycle: 'active', cycle: 1, created_at: new Date().toISOString(), ...input,
      } as Beneficiary
      db.beneficiaries.push(nb)
      pushBenEvent(nb.id, nb.project_manager_id ?? null, 'loaded', null)
    })
    ping()
  },

  async addIntervention(input: Partial<Intervention> & { beneficiary_id: string }) {
    if (LIVE) {
      const meta = await repo._benMeta(input.beneficiary_id)
      const rows = await sb<{ id: string }[]>(() => supabase!.from('interventions').insert({ cycle: meta?.cycle ?? 1, ...input }).select('id') as never)
      const nid = rows[0]?.id
      if (nid) {
        const info = await repo._ivInfo(nid)
        try {
          if (info) await supabase!.rpc('app_log_ben_event', { p_ben: input.beneficiary_id, p_user: null, p_kind: 'intervention_added', p_text: info.title })
          if (input.consultant_id && info) await supabase!.rpc('app_notify', { recipient_ids: [input.consultant_id], p_kind: 'assigned', p_text: `New intervention assigned: ${info.beneficiary_name} — ${info.title}.` })
        } catch { /* side-effects best-effort */ }
      }
      ping(); return
    }
    const ben = db.beneficiaries.find(b => b.id === input.beneficiary_id)
    db.interventions.push({
      id: uid(), kind: 'standard', status: 'not_started', closeout_status: 'none',
      assigned_at: new Date().toISOString(), acknowledged: false, acknowledged_at: null,
      cycle: ben?.cycle ?? 1, created_at: new Date().toISOString(), ...input,
    } as Intervention)
    const iv = db.interventions[db.interventions.length - 1]
    if (input.consultant_id) notify([input.consultant_id], 'assigned', `New intervention assigned: ${repo._benName(input.beneficiary_id)} — ${repo._ivTitle(iv)}.`, '')
    pushBenEvent(input.beneficiary_id, null, 'intervention_added', repo._ivTitle(iv))
    ping()
  },

  async updateIntervention(id: string, patch: Partial<Intervention>) {
    // A change of consultant is a fresh assignment: reset acknowledgement.
    const p: Partial<Intervention> = ('consultant_id' in patch && patch.acknowledged === undefined)
      ? { ...patch, assigned_at: new Date().toISOString(), acknowledged: false, acknowledged_at: null }
      : patch
    if (LIVE) { await supabase!.from('interventions').update(p).eq('id', id); return }
    const i = db.interventions.findIndex(x => x.id === id)
    if (i >= 0) db.interventions[i] = { ...db.interventions[i], ...p }
    ping()
  },

  async acknowledgeIntervention(id: string) {
    await repo.updateIntervention(id, { acknowledged: true, acknowledged_at: new Date().toISOString() })
  },

  // Consultant requests close-out; work is done pending ManCo review.
  // Consultant requests close-out: uploads outputs to the Drive subfolder + confirms the
  // close-out email went to the beneficiary, then notifies ManCo.
  async requestCloseout(id: string, userId: string | null, opts?: {
    subfolder_url?: string | null; email_sent?: boolean; email_text?: string | null
  }) {
    await repo.updateIntervention(id, {
      closeout_status: 'requested', closeout_requested_by: userId, closeout_requested_at: new Date().toISOString(),
      closeout_subfolder_url: opts?.subfolder_url ?? null,
      closeout_email_sent: opts?.email_sent ?? false,
      closeout_email_text: opts?.email_text ?? null,
    })
    if (LIVE) {
      const info = await repo._ivInfo(id)
      if (info) try {
        await supabase!.rpc('app_log_ben_event', { p_ben: info.beneficiary_id, p_user: userId, p_kind: 'closeout_requested', p_text: info.title + ' — files uploaded, close-out email sent.' })
        await supabase!.rpc('app_notify_manco', { p_kind: 'closeout_requested', p_text: `Close-out to verify: ${info.beneficiary_name} — ${info.title}.`, p_action: true })
      } catch { /* side-effects best-effort */ }
      // Record the close-out email in the Communication Log (and, via the timeline, Activity History).
      if (info && (opts?.email_sent || opts?.email_text)) {
        await repo.addComm({
          beneficiary_id: info.beneficiary_id, intervention_id: id, author_id: userId,
          channel: 'email', occurred_at: new Date().toISOString(),
          context: `Close-out email sent — ${info.title}`, followed_up_by_email: false,
          email_text: opts?.email_text ?? null,
        })
      }
      ping(); return
    }
    const iv = db.interventions.find(i => i.id === id)
    if (iv) {
      pushBenEvent(iv.beneficiary_id, userId, 'closeout_requested', repo._ivTitle(iv) + ' — files uploaded, close-out email sent.')
      db.profiles.filter(p => p.role === 'manco' || p.role === 'exco').forEach(p =>
        notify([p.id], 'closeout_requested', `Close-out to verify: ${repo._benName(iv.beneficiary_id)} — ${repo._ivTitle(iv)}.`, ''))
      if (opts?.email_sent || opts?.email_text) {
        await repo.addComm({
          beneficiary_id: iv.beneficiary_id, intervention_id: id, author_id: userId,
          channel: 'email', occurred_at: new Date().toISOString(),
          context: `Close-out email sent — ${repo._ivTitle(iv)}`, followed_up_by_email: false,
          email_text: opts?.email_text ?? null,
        })
      }
    }
  },

  // ManCo verifies the files + email and confirms -> intervention completed; client notified.
  async confirmCloseout(id: string, userId: string | null) {
    const info = LIVE ? await repo._ivInfo(id) : null
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, {
      closeout_status: 'confirmed', status: 'completed',
      completed_at: new Date().toISOString(), awaiting_response_since: null,
      closeout_confirmed_by: userId, closeout_confirmed_at: new Date().toISOString(),
    })
    if (LIVE) {
      if (info) try {
        await supabase!.rpc('app_log_ben_event', { p_ben: info.beneficiary_id, p_user: userId, p_kind: 'closeout_confirmed', p_text: info.title + ' verified and confirmed.' })
        if (info.closeout_requested_by) await supabase!.rpc('app_notify', { recipient_ids: [info.closeout_requested_by], p_kind: 'closeout_confirmed', p_text: `Your close-out was confirmed: ${info.title}.` })
        await supabase!.rpc('app_notify_client', { p_ben: info.beneficiary_id, p_kind: 'intervention_closed', p_text: `An intervention closed out: ${info.beneficiary_name} — ${info.title}.` })
      } catch { /* side-effects best-effort */ }
      ping(); return
    }
    if (iv) {
      pushBenEvent(iv.beneficiary_id, userId, 'closeout_confirmed', repo._ivTitle(iv) + ' verified and confirmed.')
      if (iv.closeout_requested_by) notify([iv.closeout_requested_by], 'closeout_confirmed', `Your close-out was confirmed: ${repo._ivTitle(iv)}.`, '')
      const rec = repo._recipientsFor(iv.beneficiary_id)
      notify(rec, 'intervention_closed', `An intervention closed out: ${repo._benName(iv.beneficiary_id)} — ${repo._ivTitle(iv)}.`, '')
    }
  },

  // ManCo returns a close-out to the consultant with a reason.
  async returnCloseout(id: string, userId: string | null, reason: string) {
    const info = LIVE ? await repo._ivInfo(id) : null
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, { closeout_status: 'none' })
    if (LIVE) {
      if (info) try {
        await supabase!.rpc('app_log_ben_event', { p_ben: info.beneficiary_id, p_user: userId, p_kind: 'closeout_returned', p_text: `${info.title} returned: ${reason}` })
        if (info.closeout_requested_by) await supabase!.rpc('app_notify', { recipient_ids: [info.closeout_requested_by], p_kind: 'closeout_returned', p_text: `Close-out returned on ${info.title}: ${reason}`, p_action_owner: info.closeout_requested_by })
      } catch { /* side-effects best-effort */ }
      ping(); return
    }
    if (iv) {
      pushBenEvent(iv.beneficiary_id, userId, 'closeout_returned', `${repo._ivTitle(iv)} returned: ${reason}`)
      if (iv.closeout_requested_by) notify([iv.closeout_requested_by], 'closeout_returned', `Close-out returned on ${repo._ivTitle(iv)}: ${reason}`, '')
    }
  },

  // Consultant grants an allowable delay: pauses the red clock until the given date.
  async grantDelay(id: string, userId: string | null, until: string, note?: string) {
    const info = LIVE ? await repo._ivInfo(id) : null
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, { response_extended_until: until })
    if (LIVE) {
      if (info) try { await supabase!.rpc('app_log_ben_event', { p_ben: info.beneficiary_id, p_user: userId, p_kind: 'delay_granted', p_text: `${info.title} — allowable delay until ${until}. ${note ?? ''}`.trim() }) } catch { /* best-effort */ }
      ping(); return
    }
    if (iv) pushBenEvent(iv.beneficiary_id, userId, 'delay_granted', `${repo._ivTitle(iv)} — allowable delay until ${until}. ${note ?? ''}`.trim())
  },

  // Soft-cancel an intervention (never hard-deleted).
  async cancelIntervention(id: string, userId: string | null) {
    const info = LIVE ? await repo._ivInfo(id) : null
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, { cancelled: true })
    if (LIVE) {
      if (info) try { await supabase!.rpc('app_log_ben_event', { p_ben: info.beneficiary_id, p_user: userId, p_kind: 'intervention_cancelled', p_text: info.title }) } catch { /* best-effort */ }
      ping(); return
    }
    if (iv) pushBenEvent(iv.beneficiary_id, userId, 'intervention_cancelled', repo._ivTitle(iv))
  },

  // ---- admin: hide / restore / permanently delete an assigned intervention ----
  // Admin soft-hide: the intervention disappears from every screen (and stops
  // affecting the beneficiary's RAG) but stays in the database and can be restored.
  async setInterventionRemoved(id: string, removed: boolean, userId: string | null) {
    const iv = db.interventions.find(i => i.id === id)
    const title = iv ? repo._ivTitle(iv) : 'Intervention'
    const patch = { removed_at: removed ? new Date().toISOString() : null, removed_by: removed ? userId : null }
    const i = db.interventions.findIndex(x => x.id === id)
    if (i >= 0) db.interventions[i] = { ...db.interventions[i], ...patch }
    if (iv) pushBenEvent(iv.beneficiary_id, userId, removed ? 'intervention_removed' : 'intervention_restored', title)
    if (LIVE) {
      await supabase!.from('interventions').update(patch).eq('id', id)
      if (iv) await supabase!.from('beneficiary_events').insert({
        beneficiary_id: iv.beneficiary_id, user_id: userId,
        kind: removed ? 'intervention_removed' : 'intervention_restored', text: title,
      })
    }
    ping()
  },

  // Admin hard-delete: permanently removes the intervention and everything that
  // hangs off it (weekly updates, comms rows, escalations). Mirrors the Postgres
  // ON DELETE CASCADE so demo and live behave the same.
  async deleteIntervention(id: string, userId: string | null) {
    const iv = db.interventions.find(i => i.id === id)
    const title = iv ? repo._ivTitle(iv) : 'Intervention'
    if (iv) pushBenEvent(iv.beneficiary_id, userId, 'intervention_deleted', title)
    if (LIVE) {
      if (iv) await supabase!.from('beneficiary_events').insert({
        beneficiary_id: iv.beneficiary_id, user_id: userId, kind: 'intervention_deleted', text: title,
      })
      await supabase!.from('interventions').delete().eq('id', id)
      ping()
      return
    }
    const escIds = db.escalations.filter(e => e.intervention_id === id).map(e => e.id)
    db.updates = db.updates.filter(u => u.intervention_id !== id)
    db.comms = db.comms.filter(c => c.intervention_id !== id)
    db.escalations = db.escalations.filter(e => e.intervention_id !== id)
    db.events = db.events.filter(ev => !escIds.includes(ev.escalation_id))
    db.interventions = db.interventions.filter(x => x.id !== id)
    ping()
  },

  // ---- beneficiary-level close-out chain ----
  _benName(id: string) { return db.beneficiaries.find(b => b.id === id)?.name ?? 'beneficiary' },
  _ivTitle(iv: Intervention) {
    if (iv.kind === 'custom') return iv.custom_name ?? 'Custom intervention'
    return db.catalogue.find(c => c.id === iv.catalogue_id)?.name ?? 'Intervention'
  },
  _recipientsFor(benId: string): string[] {
    const b = db.beneficiaries.find(x => x.id === benId); if (!b) return []
    const sponsor = db.sponsors.find(s => s.id === b.sponsor_id)
    const aggId = sponsor?.aggregator_id
    return db.profiles.filter(p => p.role === 'external' && (
      p.external_sponsor_id === b.sponsor_id || (aggId && p.external_client_id === aggId))).map(p => p.id)
  },

  // ManCo produces the POE/close-out report, drops it in the Drive folder, sends to client.
  async submitBeneficiaryCloseout(benId: string, userId: string | null, reportUrl: string, note?: string) {
    if (LIVE) {
      const meta = await repo._benMeta(benId); if (!meta) return
      await supabase!.from('beneficiaries').update({ lifecycle: 'closeout_sent', closeout_report_url: reportUrl, closeout_return_notes: null }).eq('id', benId)
      try {
        await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'closeout_report_sent', p_text: note || 'POE/close-out report produced and sent to the client.' })
        await supabase!.rpc('app_notify_client', { p_ben: benId, p_kind: 'beneficiary_closeout_sent', p_text: `Close-out report to review: ${meta.name}.` })
      } catch { /* side-effects best-effort */ }
      ping(); return
    }
    const b = db.beneficiaries.find(x => x.id === benId); if (!b) return
    b.lifecycle = 'closeout_sent'; b.closeout_report_url = reportUrl; b.closeout_return_notes = null
    pushBenEvent(benId, userId, 'closeout_report_sent', note || 'POE/close-out report produced and sent to the client.')
    notify(repo._recipientsFor(benId), 'beneficiary_closeout_sent', `Close-out report to review: ${b.name}.`, '')
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  // Client acknowledges -> concluded (visible for the month).
  async acknowledgeBeneficiaryCloseout(benId: string, userId: string | null) {
    if (LIVE) {
      const meta = await repo._benMeta(benId); if (!meta || meta.lifecycle !== 'closeout_sent') return
      await supabase!.from('beneficiaries').update({ lifecycle: 'concluded', concluded_at: new Date().toISOString() }).eq('id', benId)
      try {
        await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'concluded', p_text: 'Client acknowledged the close-out.' })
        await supabase!.rpc('app_notify_manco', { p_kind: 'beneficiary_concluded', p_text: `${meta.name} concluded — client acknowledged.` })
      } catch { /* side-effects best-effort */ }
      ping(); return
    }
    const b = db.beneficiaries.find(x => x.id === benId); if (!b || b.lifecycle !== 'closeout_sent') return
    b.lifecycle = 'concluded'; b.concluded_at = new Date().toISOString()
    pushBenEvent(benId, userId, 'concluded', 'Client acknowledged the close-out.')
    db.profiles.filter(p => p.role === 'manco' || p.role === 'exco').forEach(p =>
      notify([p.id], 'beneficiary_concluded', `${b.name} concluded — client acknowledged.`, ''))
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  // Client returns the close-out with items to resolve -> back to ManCo queue.
  async returnBeneficiaryCloseout(benId: string, userId: string | null, notes: string) {
    if (LIVE) {
      const meta = await repo._benMeta(benId); if (!meta || meta.lifecycle !== 'closeout_sent') return
      await supabase!.from('beneficiaries').update({ lifecycle: 'pending_closeout', closeout_return_notes: notes }).eq('id', benId)
      try {
        await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'returned_by_client', p_text: notes })
        if (meta.project_manager_id) await supabase!.rpc('app_notify', { recipient_ids: [meta.project_manager_id], p_kind: 'beneficiary_returned', p_text: `${meta.name} close-out returned by client: ${notes}`, p_action_owner: meta.project_manager_id })
      } catch { /* side-effects best-effort */ }
      ping(); return
    }
    const b = db.beneficiaries.find(x => x.id === benId); if (!b || b.lifecycle !== 'closeout_sent') return
    b.lifecycle = 'pending_closeout'; b.closeout_return_notes = notes
    pushBenEvent(benId, userId, 'returned_by_client', notes)
    if (b.project_manager_id) notify([b.project_manager_id], 'beneficiary_returned', `${b.name} close-out returned by client: ${notes}`, '')
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  // ManCo archives a concluded beneficiary (kept for records, re-onboardable).
  async archiveBeneficiary(benId: string, userId: string | null) {
    if (LIVE) {
      const meta = await repo._benMeta(benId); if (!meta || meta.lifecycle !== 'concluded') return
      await supabase!.from('beneficiaries').update({ lifecycle: 'archived', archived_at: new Date().toISOString() }).eq('id', benId)
      try { await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'archived', p_text: 'Archived after month-end extract.' }) } catch { /* best-effort */ }
      ping(); return
    }
    const b = db.beneficiaries.find(x => x.id === benId); if (!b || b.lifecycle !== 'concluded') return
    b.lifecycle = 'archived'; b.archived_at = new Date().toISOString()
    pushBenEvent(benId, userId, 'archived', 'Archived after month-end extract.')
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  // ---- admin: hide / restore / permanently delete a beneficiary ----
  // Admin soft-hide: the beneficiary (and its interventions) disappear from every
  // screen but stay in the database and can be restored.
  async setBeneficiaryRemoved(benId: string, removed: boolean, userId: string | null) {
    const patch = { removed_at: removed ? new Date().toISOString() : null, removed_by: removed ? userId : null }
    const i = db.beneficiaries.findIndex(x => x.id === benId)
    if (i >= 0) db.beneficiaries[i] = { ...db.beneficiaries[i], ...patch }
    pushBenEvent(benId, userId, removed ? 'removed' : 'restored',
      removed ? 'Beneficiary hidden from the app by an admin.' : 'Beneficiary restored by an admin.')
    if (LIVE) {
      await supabase!.from('beneficiaries').update(patch).eq('id', benId)
      await supabase!.from('beneficiary_events').insert({
        beneficiary_id: benId, user_id: userId, kind: removed ? 'removed' : 'restored',
        text: removed ? 'Beneficiary hidden from the app by an admin.' : 'Beneficiary restored by an admin.',
      })
    }
    ping()
  },

  // Admin hard-delete: permanently removes the beneficiary and everything under it
  // (interventions, weekly updates, comms, escalations, overrides, activity log).
  // Mirrors the Postgres ON DELETE CASCADE so demo and live behave the same.
  async deleteBeneficiary(benId: string, _userId: string | null) {
    if (LIVE) { await supabase!.from('beneficiaries').delete().eq('id', benId); ping(); return }
    const ivIds = db.interventions.filter(i => i.beneficiary_id === benId).map(i => i.id)
    const escIds = db.escalations.filter(e => e.beneficiary_id === benId).map(e => e.id)
    db.updates = db.updates.filter(u => !ivIds.includes(u.intervention_id))
    db.comms = db.comms.filter(c => c.beneficiary_id !== benId)
    db.escalations = db.escalations.filter(e => e.beneficiary_id !== benId)
    db.events = db.events.filter(ev => !escIds.includes(ev.escalation_id))
    db.overrides = db.overrides.filter(o => o.beneficiary_id !== benId)
    db.benEvents = db.benEvents.filter(be => be.beneficiary_id !== benId)
    db.interventions = db.interventions.filter(i => i.beneficiary_id !== benId)
    db.beneficiaries = db.beneficiaries.filter(b => b.id !== benId)
    ping()
  },

  // Re-onboard a repeat beneficiary: same record, new cycle + new SOW; history carries over.
  async reonboardBeneficiary(benId: string, userId: string | null, sowDate: string) {
    if (LIVE) {
      const meta = await repo._benMeta(benId); if (!meta) return
      const nextCycle = (meta.cycle ?? 1) + 1
      await supabase!.from('beneficiaries').update({ lifecycle: 'active', cycle: nextCycle, sow_signed_date: sowDate, concluded_at: null, archived_at: null, closeout_report_url: null }).eq('id', benId)
      try { await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'reonboarded', p_text: `Re-onboarded for cycle ${nextCycle} with a new SOW.` }) } catch { /* best-effort */ }
      ping(); return
    }
    const b = db.beneficiaries.find(x => x.id === benId); if (!b) return
    b.lifecycle = 'active'; b.cycle = (b.cycle ?? 1) + 1
    b.sow_signed_date = sowDate; b.concluded_at = null; b.archived_at = null; b.closeout_report_url = null
    pushBenEvent(benId, userId, 'reonboarded', `Re-onboarded for cycle ${b.cycle} with a new SOW.`)
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  async updateBeneficiary(benId: string, patch: Partial<Beneficiary>, userId: string | null) {
    if (LIVE) {
      await supabase!.from('beneficiaries').update(patch).eq('id', benId)
      try { await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'edited', p_text: 'Beneficiary details updated.' }) } catch { /* best-effort */ }
      ping(); return
    }
    const i = db.beneficiaries.findIndex(x => x.id === benId); if (i < 0) return
    db.beneficiaries[i] = { ...db.beneficiaries[i], ...patch }
    pushBenEvent(benId, userId, 'edited', 'Beneficiary details updated.')
    if (LIVE) await supabase!.from('beneficiaries').update(patch).eq('id', benId)
    ping()
  },

  async addBenNote(benId: string, userId: string | null, text: string) {
    pushBenEvent(benId, userId, 'note', text)
    if (LIVE) await supabase!.from('beneficiary_events').insert({ beneficiary_id: benId, user_id: userId, kind: 'note', text })
    ping()
  },

  // Manually link a funding line into an existing beneficiary's company (companyKey = the target's
  // effective company key), or split it back out (companyKey = null). Any rows already grouped under
  // benId are re-pointed too, so a company always stays a flat group rather than a chain.
  async linkBeneficiary(benId: string, companyKey: string | null, userId: string | null) {
    const note = companyKey
      ? 'Linked as another funding line of the same beneficiary.'
      : 'Split out into its own beneficiary.'
    if (LIVE) {
      await supabase!.from('beneficiaries').update({ company_id: companyKey }).eq('id', benId)
      if (companyKey) await supabase!.from('beneficiaries').update({ company_id: companyKey }).eq('company_id', benId)
      try { await supabase!.rpc('app_log_ben_event', { p_ben: benId, p_user: userId, p_kind: 'edited', p_text: note }) } catch { /* best-effort */ }
      ping(); return
    }
    db.beneficiaries.forEach((x, i) => {
      if (x.id === benId) db.beneficiaries[i] = { ...x, company_id: companyKey }
      else if (companyKey && x.company_id === benId) db.beneficiaries[i] = { ...x, company_id: companyKey }
    })
    pushBenEvent(benId, userId, 'edited', note)
    ping()
  },

  async addWeeklyUpdate(u: Omit<WeeklyUpdate, 'id' | 'created_at'>) {
    if (LIVE) { await supabase!.from('weekly_updates').insert(u); return }
    db.updates.unshift({ ...u, id: uid(), created_at: new Date().toISOString() })
    ping()
  },

  async addComm(c: Omit<Comm, 'id'>) {
    if (LIVE) {
      await supabase!.from('comms_log').insert(c)
      try { await supabase!.from('beneficiaries').update({ last_engagement_at: c.occurred_at }).eq('id', c.beneficiary_id) } catch { /* best-effort */ }
      ping(); return
    }
    db.comms.unshift({ ...c, id: uid() })
    const b = db.beneficiaries.findIndex(x => x.id === c.beneficiary_id)
    if (b >= 0) db.beneficiaries[b].last_engagement_at = c.occurred_at
    ping()
  },

  // ---- escalation: ownership-baton state machine (per single intervention) ----
  // Works in demo (in-memory) AND live (Supabase): every hand-off updates the
  // escalation row, writes an audit event, and notifies the participants.
  _esc(id: string) { return db.escalations.find(x => x.id === id) },

  // Single fetch — live reads the row from Supabase; demo uses the in-memory seed.
  async _getEsc(id: string): Promise<Escalation | undefined> {
    if (!LIVE) return db.escalations.find(x => x.id === id)
    const rows = await sb<Escalation[]>(() => supabase!.from('escalations').select('*').eq('id', id).limit(1) as never)
    return rows[0]
  },

  // Beneficiary name for notification/label text (live reads the row).
  async _benLabel(id: string): Promise<string> {
    if (!LIVE) return repo._benName(id)
    const rows = await sb<{ name: string }[]>(() => supabase!.from('beneficiaries').select('name').eq('id', id).limit(1) as never)
    return rows[0]?.name ?? 'a beneficiary'
  },

  // Beneficiary lifecycle + label (live reads the row; demo uses the seed).
  async _benMeta(id: string): Promise<{ name: string; lifecycle: string; cycle: number; project_manager_id: string | null } | null> {
    if (!LIVE) {
      const b = db.beneficiaries.find(x => x.id === id)
      return b ? { name: b.name, lifecycle: b.lifecycle, cycle: b.cycle ?? 1, project_manager_id: b.project_manager_id ?? null } : null
    }
    const rows = await sb<{ name: string; lifecycle: string; cycle: number; project_manager_id: string | null }[]>(
      () => supabase!.from('beneficiaries').select('name, lifecycle, cycle, project_manager_id').eq('id', id).limit(1) as never)
    return rows[0] ?? null
  },

  // Intervention title + beneficiary label. Live reads the RAG view, which
  // already resolves the catalogue name + beneficiary name in a single row.
  async _ivInfo(id: string): Promise<{ beneficiary_id: string; title: string; beneficiary_name: string; consultant_id: string | null; closeout_requested_by: string | null } | null> {
    if (!LIVE) {
      const iv = db.interventions.find(x => x.id === id)
      if (!iv) return null
      return { beneficiary_id: iv.beneficiary_id, title: repo._ivTitle(iv), beneficiary_name: repo._benName(iv.beneficiary_id), consultant_id: iv.consultant_id ?? null, closeout_requested_by: iv.closeout_requested_by ?? null }
    }
    const rows = await sb<{ beneficiary_id: string; title: string; beneficiary_name: string; consultant_id: string | null; closeout_requested_by: string | null }[]>(
      () => supabase!.from('v_intervention_rag').select('beneficiary_id, title, beneficiary_name, consultant_id, closeout_requested_by').eq('id', id).limit(1) as never)
    return rows[0] ?? null
  },

  _addParticipant(e: Escalation, userId: string | null) {
    if (userId && !e.participants.includes(userId)) e.participants.push(userId)
  },

  // 1) Consultant escalates an intervention to a chosen ManCo.
  async escalateToManco(input: {
    intervention_id: string; beneficiary_id: string; consultant_id: string
    manco_id: string; reason: string; context?: string | null
  }) {
    if (LIVE) {
      const ins = await sb<{ id: string }[]>(() => supabase!.from('escalations').insert({
        intervention_id: input.intervention_id, beneficiary_id: input.beneficiary_id,
        reason: input.reason, context: input.context ?? null, status: 'with_manco',
        current_owner_id: input.manco_id, current_owner_role: 'manco',
        consultant_id: input.consultant_id, manco_id: input.manco_id, sponsor_id: null,
        participants: [input.consultant_id, input.manco_id],
        raised_by: input.consultant_id,
      }).select('id') as never)
      const newId = ins[0]?.id
      if (newId) {
        await supabase!.from('escalation_events').insert({
          escalation_id: newId, user_id: input.consultant_id, kind: 'escalated_to_manco',
          to_status: 'with_manco', to_owner_id: input.manco_id,
          text: input.reason + (input.context ? '\n\nContext: ' + input.context : ''),
        })
        await supabase!.from('beneficiary_events').insert({
          beneficiary_id: input.beneficiary_id, user_id: input.consultant_id,
          kind: 'note', text: 'Intervention escalated to ManCo.',
        })
        try {
          await supabase!.from('notifications').insert({
            user_id: input.manco_id, kind: 'escalation_released',
            text: `Escalation to review: ${await repo._benLabel(input.beneficiary_id)}.`,
            escalation_id: newId, action_required: true,
          })
        } catch { /* notification is best-effort */ }
      }
      ping()
      return
    }
    const now = new Date().toISOString()
    const e: Escalation = {
      id: uid(), intervention_id: input.intervention_id, beneficiary_id: input.beneficiary_id,
      reason: input.reason, context: input.context ?? null, status: 'with_manco',
      current_owner_id: input.manco_id, current_owner_role: 'manco',
      consultant_id: input.consultant_id, manco_id: input.manco_id, sponsor_id: null,
      participants: [input.consultant_id, input.manco_id],
      raised_by: input.consultant_id, raised_at: now, last_action_at: now, resolved_at: null,
    }
    db.escalations.unshift(e)
    pushEscEvent(e.id, input.consultant_id, 'escalated_to_manco', {
      to_status: 'with_manco', to_owner_id: input.manco_id,
      text: input.reason + (input.context ? '\n\nContext: ' + input.context : ''),
    })
    pushBenEvent(input.beneficiary_id, input.consultant_id, 'note', 'Intervention escalated to ManCo.')
    notifyEsc(e, input.consultant_id, `Escalation to review: ${repo._benName(input.beneficiary_id)}.`, input.manco_id)
    ping()
  },

  // Apply a baton hand-off. Live: patch the escalation, log the event, notify the
  // participants (best-effort). Demo: mutate the in-memory row via _transfer.
  async _applyTransfer(e: Escalation, actorId: string, kind: EscalationEvent['kind'], toStatus: EscStatus,
    toOwnerId: string | null, ownerRole: Escalation['current_owner_role'], text: string, notice: string,
    extra: Partial<Escalation> = {}) {
    if (LIVE) {
      const from_status = e.status, from_owner = e.current_owner_id
      const now = new Date().toISOString()
      const participants = Array.from(new Set([...(e.participants ?? []), actorId, toOwnerId].filter(Boolean))) as string[]
      const patch: Record<string, unknown> = {
        status: toStatus, current_owner_id: toOwnerId, current_owner_role: ownerRole,
        last_action_at: now, participants, ...extra,
      }
      if (toStatus === 'resolved') patch.resolved_at = now
      await supabase!.from('escalations').update(patch).eq('id', e.id)
      await supabase!.from('escalation_events').insert({
        escalation_id: e.id, user_id: actorId, kind,
        from_status, to_status: toStatus, from_owner_id: from_owner, to_owner_id: toOwnerId, text,
      })
      const recips = participants.filter(u => u && u !== actorId)
      if (recips.length) {
        try {
          await supabase!.from('notifications').insert(recips.map(u => ({
            user_id: u, kind: 'escalation_released', text: notice,
            escalation_id: e.id, action_required: u === toOwnerId,
          })))
        } catch { /* notifications are best-effort */ }
      }
      ping()
      return
    }
    if (extra.manco_id !== undefined) e.manco_id = extra.manco_id
    if (extra.sponsor_id !== undefined) e.sponsor_id = extra.sponsor_id
    repo._transfer(e, actorId, kind, toStatus, toOwnerId, ownerRole, text, notice)
  },

  _transfer(e: Escalation, actorId: string, kind: EscalationEvent['kind'], toStatus: EscStatus,
            toOwnerId: string | null, ownerRole: Escalation['current_owner_role'], text: string, notice: string) {
    const from_status = e.status, from_owner = e.current_owner_id
    e.status = toStatus; e.current_owner_id = toOwnerId; e.current_owner_role = ownerRole
    e.last_action_at = new Date().toISOString()
    if (toStatus === 'resolved') e.resolved_at = e.last_action_at
    this._addParticipant(e, actorId); this._addParticipant(e, toOwnerId)
    pushEscEvent(e.id, actorId, kind, { from_status, to_status: toStatus, from_owner_id: from_owner, to_owner_id: toOwnerId, text })
    notifyEsc(e, actorId, notice, toOwnerId)
    ping()
  },

  // 2A) ManCo declines -> back to consultant (reason + suggested way forward).
  async mancoDecline(id: string, mancoId: string, reason: string, wayForward: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== mancoId) return
    await repo._applyTransfer(e, mancoId, 'declined_to_consultant', 'returned_to_consultant', e.consultant_id, 'consultant',
      `Declined: ${reason}\nSuggested way forward: ${wayForward}`,
      `Escalation returned to you: ${await repo._benLabel(e.beneficiary_id)}.`)
  },

  // 2B) ManCo escalates to a chosen Aggregator/Sponsor recipient.
  async mancoEscalateSponsor(id: string, mancoId: string, sponsorUserId: string, reason: string, expectedAction: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== mancoId) return
    await repo._applyTransfer(e, mancoId, 'escalated_to_sponsor', 'with_sponsor', sponsorUserId, 'external',
      `${reason}\nExpected action: ${expectedAction}`,
      `Escalation to review: ${await repo._benLabel(e.beneficiary_id)}.`,
      { manco_id: mancoId, sponsor_id: sponsorUserId })
  },

  // Consultant accepts a returned escalation -> resolved & unlocked.
  async consultantAcceptReturn(id: string, consultantId: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== consultantId) return
    await repo._applyTransfer(e, consultantId, 'accepted', 'resolved', consultantId, 'consultant',
      'Accepted the return and resumed the case.',
      `Escalation closed: ${await repo._benLabel(e.beneficiary_id)}.`)
  },

  // Consultant re-escalates to a chosen ManCo (from returned or outcome).
  async consultantReEscalate(id: string, consultantId: string, mancoId: string, reason: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== consultantId) return
    await repo._applyTransfer(e, consultantId, 'reescalated', 'with_manco', mancoId, 'manco',
      `Re-escalated: ${reason}`, `Escalation to review: ${await repo._benLabel(e.beneficiary_id)}.`,
      { manco_id: mancoId })
  },

  // 3A) Sponsor declines -> back to the ManCo who sent it.
  async sponsorDecline(id: string, sponsorUserId: string, reason: string, wayForward: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== sponsorUserId) return
    await repo._applyTransfer(e, sponsorUserId, 'declined_to_manco', 'returned_to_manco', e.manco_id ?? null, 'manco',
      `Declined: ${reason}\nSuggested way forward: ${wayForward}`,
      `Escalation returned by sponsor: ${await repo._benLabel(e.beneficiary_id)}.`)
  },

  // 3B) Sponsor submits a proposed resolution -> back to ManCo to review (not auto-closed).
  async sponsorResolve(id: string, sponsorUserId: string, action: string, resolution: string, notes?: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== sponsorUserId) return
    await repo._applyTransfer(e, sponsorUserId, 'resolution_submitted', 'resolution_submitted', e.manco_id ?? null, 'manco',
      `Action taken: ${action}\nProposed resolution: ${resolution}${notes ? '\nNotes: ' + notes : ''}`,
      `Resolution submitted for review: ${await repo._benLabel(e.beneficiary_id)}.`)
  },

  // 4) ManCo returns the outcome to the consultant.
  async mancoReturnToConsultant(id: string, mancoId: string, resolution: string, nextSteps: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== mancoId) return
    await repo._applyTransfer(e, mancoId, 'returned_to_consultant', 'outcome_to_consultant', e.consultant_id, 'consultant',
      `Outcome: ${resolution}\nNext steps: ${nextSteps}`,
      `Escalation outcome received: ${await repo._benLabel(e.beneficiary_id)}.`)
  },

  // 4) ManCo re-escalates back to a sponsor with additional context.
  async mancoReEscalateSponsor(id: string, mancoId: string, sponsorUserId: string, context: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== mancoId) return
    await repo._applyTransfer(e, mancoId, 'reescalated', 'with_sponsor', sponsorUserId, 'external',
      `Re-escalated with more context: ${context}`, `Escalation to review: ${await repo._benLabel(e.beneficiary_id)}.`,
      { sponsor_id: sponsorUserId })
  },

  // Consultant accepts the outcome -> resolved & unlocked.
  async consultantAcceptResume(id: string, consultantId: string) {
    const e = await repo._getEsc(id); if (!e || e.current_owner_id !== consultantId) return
    await repo._applyTransfer(e, consultantId, 'accepted', 'resolved', consultantId, 'consultant',
      'Accepted the outcome and resumed the case.', `Escalation closed: ${await repo._benLabel(e.beneficiary_id)}.`)
  },

  // Any current owner or participant may add a note to the audit trail.
  async addEscalationNote(id: string, userId: string | null, text: string) {
    if (LIVE) {
      await supabase!.from('escalation_events').insert({ escalation_id: id, user_id: userId, kind: 'note', text })
      const e = await repo._getEsc(id)
      if (e) {
        const recips = (e.participants ?? []).filter(u => u && u !== userId)
        if (recips.length) {
          const label = await repo._benLabel(e.beneficiary_id)
          try {
            await supabase!.from('notifications').insert(recips.map(u => ({
              user_id: u, kind: 'escalation_released',
              text: `New note on the escalation for ${label}.`,
              escalation_id: id, action_required: false,
            })))
          } catch { /* best-effort */ }
        }
      }
      ping()
      return
    }
    const e = repo._esc(id); if (!e) return
    pushEscEvent(id, userId, 'note', { text })
    notifyEsc(e, userId, `Note added on ${repo._benName(e.beneficiary_id)}.`, null)
    ping()
  },

  async markNotificationRead(id: string) {
    if (LIVE) { await supabase!.from('notifications').update({ read: true }).eq('id', id); return }
    const n = db.notifications.find(x => x.id === id); if (n) n.read = true
    ping()
  },

  async markAllNotificationsRead(userId: string) {
    if (LIVE) { await supabase!.from('notifications').update({ read: true }).eq('user_id', userId); return }
    db.notifications.forEach(n => { if (n.user_id === userId) n.read = true })
    ping()
  },

  // Override a beneficiary's RAG; logs an entry that shows in the update history.
  async saveBeneficiaryOverride(
    id: string, rag: Rag, reason: string, effectiveDate: string, loggedBy: string | null,
  ) {
    const patch = { rag_override: rag, rag_override_reason: reason }
    const entry: RagOverride = {
      id: uid(), beneficiary_id: id, rag, reason,
      effective_date: effectiveDate, logged_by: loggedBy, created_at: new Date().toISOString(),
    }
    if (LIVE) {
      await supabase!.from('beneficiaries').update(patch).eq('id', id)
      await supabase!.from('rag_overrides').insert({
        beneficiary_id: id, rag, reason, effective_date: effectiveDate, logged_by: loggedBy,
      })
      return
    }
    const i = db.beneficiaries.findIndex(b => b.id === id)
    if (i >= 0) db.beneficiaries[i] = { ...db.beneficiaries[i], ...patch }
    db.overrides.unshift(entry)
    ping()
  },

  async saveCatalogueItem(item: Partial<CatalogueItem>) {
    if (LIVE) {
      if (item.id) await supabase!.from('intervention_catalogue').update(item).eq('id', item.id)
      else await supabase!.from('intervention_catalogue').insert(item)
      ping()
      return
    }
    if (item.id) {
      const i = db.catalogue.findIndex(c => c.id === item.id)
      if (i >= 0) db.catalogue[i] = { ...db.catalogue[i], ...item }
    } else {
      db.catalogue.push({ id: uid(), active: true, category: 'Custom', name: 'New intervention', ...item } as CatalogueItem)
    }
    ping()
  },

  // Permanently remove a catalogue (intervention type). Blocked while it's still
  // assigned to any beneficiary — deactivate it instead in that case.
  async deleteCatalogueItem(id: string) {
    if (LIVE) {
      const inUse = await sb<{ id: string }[]>(() =>
        supabase!.from('interventions').select('id').eq('catalogue_id', id).limit(1) as never)
      if (inUse.length) throw new Error('This intervention type is assigned to a beneficiary — deactivate it instead of deleting.')
      await supabase!.from('intervention_catalogue').delete().eq('id', id)
      ping()
      return
    }
    if (db.interventions.some(iv => iv.catalogue_id === id)) {
      throw new Error('This intervention type is assigned to a beneficiary — deactivate it instead of deleting.')
    }
    db.catalogue = db.catalogue.filter(c => c.id !== id)
    ping()
  },

  async saveProfile(p: Partial<Profile>) {
    if (LIVE) {
      if (p.id) await supabase!.from('profiles').update(p).eq('id', p.id)
      ping()
      return
    }
    if (p.id) {
      const i = db.profiles.findIndex(x => x.id === p.id)
      if (i >= 0) db.profiles[i] = { ...db.profiles[i], ...p }
    } else {
      db.profiles.push({ id: uid(), role: 'consultant', is_admin: false, active: true, full_name: '', email: '', ...p } as Profile)
    }
    ping()
  },

  // ---- user lifecycle (ManCo-controlled; real auth + emails wired at go-live) ----
  // Create + invite a user. Generates a simulated temp password + 72h invite window.
  async createUser(input: {
    full_name: string; email: string; organisation: string; job_title: string; role: Role
    external_client_id?: string | null; external_sponsor_id?: string | null
  }, byUserId: string | null) {
    // Live: the invite-user edge function creates the auth user (privileged), sends the
    // invite email, and inserts the profile. The person sets their password from the email.
    if (LIVE) {
      const { data, error } = await supabase!.functions.invoke('invite-user', {
        body: {
          email: input.email, full_name: input.full_name, organisation: input.organisation,
          job_title: input.job_title, role: input.role,
          external_client_id: input.external_client_id ?? null,
          external_sponsor_id: input.external_sponsor_id ?? null,
          redirect_to: `${window.location.origin}/set-password`,
        },
      })
      if (error) throw new Error(await readFnError(error))
      if (data?.error) throw new Error(String(data.error))
      return { id: (data?.id as string) ?? '', temp: '' }
    }
    const id = uid()
    const temp = 'UCA-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    const now = new Date()
    const expires = new Date(now.getTime() + 72 * 3600 * 1000).toISOString()
    const profile = {
      id, full_name: input.full_name, email: input.email, role: input.role,
      organisation: input.organisation, job_title: input.job_title, discipline: input.job_title,
      is_admin: false, active: false, status: 'pending' as UserStatus,
      external_client_id: input.external_client_id ?? null, external_sponsor_id: input.external_sponsor_id ?? null,
      invited_at: now.toISOString(), invite_expires_at: expires, created_by: byUserId, temp_password: temp,
    } as Profile
    db.profiles.push(profile)
    pushUserEvent(id, byUserId, 'created', `Invited as ${input.role}.`)
    pushUserEvent(id, byUserId, 'invite_sent', 'Onboarding email sent (expires in 72h).')
    ping()
    return { id, temp }              // returned so the demo can show the placeholder link/password
  },

  // Simulated first-login activation: user sets their own password + accepts terms.
  async activateUser(id: string, _newPassword: string) {
    const pr = db.profiles.find(x => x.id === id); if (!pr) return
    pr.status = 'active'; pr.active = true; pr.temp_password = null
    pr.activated_at = new Date().toISOString(); pr.terms_accepted_at = pr.activated_at
    if (LIVE) await supabase!.from('profiles').update(pr).eq('id', id)
    pushUserEvent(id, null, 'activated', 'Account activated by the user.')
    // Notify the ManCo who created the account.
    if (pr.created_by) db.notifications.unshift({
      id: uid(), user_id: pr.created_by, at: new Date().toISOString(), kind: 'assigned',
      text: `${pr.full_name} (${pr.organisation ?? ''}) activated their ${pr.role} account.`,
      escalation_id: null, action_required: false, read: false,
    })
    ping()
  },

  async resendInvite(id: string, byUserId: string | null, email?: string) {
    if (LIVE) {
      // Re-send a link that lets a still-pending user set their password and sign in.
      if (email) await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      })
      if (email) await supabase!.from('user_events').insert({
        target_user_id: id, by_user_id: byUserId, kind: 'invite_resent', text: 'Invitation re-sent.',
      })
      return
    }
    const pr = db.profiles.find(x => x.id === id); if (!pr) return
    pr.status = 'pending'; pr.invited_at = new Date().toISOString()
    pr.invite_expires_at = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    pr.temp_password = 'UCA-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    pushUserEvent(id, byUserId, 'invite_resent', 'Invitation resent (new 72h window).')
    ping()
  },

  // ManCo initiates a reset — Supabase emails the user a secure link. ManCo never sees/sets the password.
  async resetUserPassword(id: string, byUserId: string | null, email?: string) {
    if (LIVE) {
      if (email) await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      })
      if (email) await supabase!.from('user_events').insert({
        target_user_id: id, by_user_id: byUserId, kind: 'password_reset_sent', text: 'Password reset email sent.',
      })
      return
    }
    pushUserEvent(id, byUserId, 'password_reset_sent', 'Password reset email sent (link expires in 48h).')
    ping()
  },

  // Suspend / deactivate / reactivate. Works in live mode regardless of whether the
  // user happens to be in the in-memory demo list (they aren't, live), so the change
  // actually persists and the UI reflects it.
  async setUserStatus(id: string, status: UserStatus, byUserId: string | null) {
    const active = status === 'active'
    const kind = status === 'suspended' ? 'suspended' : status === 'deactivated' ? 'deactivated' : 'reactivated'
    const i = db.profiles.findIndex(x => x.id === id)
    if (i >= 0) db.profiles[i] = { ...db.profiles[i], status, active }
    if (LIVE) {
      await supabase!.from('profiles').update({ status, active }).eq('id', id)
      await supabase!.from('user_events').insert({ target_user_id: id, by_user_id: byUserId, kind })
    } else {
      pushUserEvent(id, byUserId, kind as UserEvent['kind'])
    }
    ping()
  },

  // ---- admin: hide / restore / permanently delete a user profile ----
  // Admin soft-hide: the user disappears everywhere in the app (login, assignment
  // dropdowns, lists) but stays in the database and can be restored.
  async setUserRemoved(id: string, removed: boolean, byUserId: string | null) {
    const patch = { removed_at: removed ? new Date().toISOString() : null, removed_by: removed ? byUserId : null }
    const i = db.profiles.findIndex(x => x.id === id)
    if (i >= 0) db.profiles[i] = { ...db.profiles[i], ...patch }
    if (LIVE) {
      await supabase!.from('profiles').update(patch).eq('id', id)
      await supabase!.from('user_events').insert({ target_user_id: id, by_user_id: byUserId, kind: removed ? 'removed' : 'restored' })
    } else {
      pushUserEvent(id, byUserId, removed ? 'removed' : 'restored')
    }
    ping()
  },

  // Admin hard-delete: permanently removes the user's login + profile everywhere.
  // Live: a privileged edge function deletes the auth user (which cascades the
  // profile, their events and notifications); references elsewhere are set null.
  async deleteUser(id: string, _byUserId: string | null) {
    if (LIVE) {
      const { data, error } = await supabase!.functions.invoke('delete-user', { body: { id } })
      if (error) throw new Error(await readFnError(error))
      if (data?.error) throw new Error(String(data.error))
      ping()
      return
    }
    db.interventions.forEach(iv => { if (iv.consultant_id === id) iv.consultant_id = null })
    db.beneficiaries.forEach(b => { if (b.project_manager_id === id) b.project_manager_id = null })
    db.userEvents = db.userEvents.filter(e => e.target_user_id !== id)
    db.notifications = db.notifications.filter(n => n.user_id !== id)
    db.profiles = db.profiles.filter(p => p.id !== id)
    ping()
  },

  async changeUserRole(id: string, role: Role, byUserId: string | null) {
    const i = db.profiles.findIndex(x => x.id === id)
    const prev = i >= 0 ? db.profiles[i].role : null
    if (i >= 0) db.profiles[i] = { ...db.profiles[i], role }
    if (LIVE) {
      await supabase!.from('profiles').update({ role }).eq('id', id)
      await supabase!.from('user_events').insert({ target_user_id: id, by_user_id: byUserId, kind: 'role_changed', text: `Role changed to ${role}.` })
    } else {
      pushUserEvent(id, byUserId, 'role_changed', `Role changed from ${prev} to ${role}.`)
    }
    ping()
  },

  // ================= Onboarding (pre-SOW pipeline) =================
  async onboardings(): Promise<OnboardingView[]> {
    if (!LIVE) return db.onboardings.map(decorateOnb)
    return sb<OnboardingView[]>(() => supabase!.from('v_onboarding').select('*').order('last_action_at', { ascending: false }) as never)
  },

  async welcomeParties(): Promise<WelcomeParty[]> {
    if (!LIVE) return [...db.welcomeParties]
    return sb<WelcomeParty[]>(() => supabase!.from('welcome_parties').select('*').order('party_date', { ascending: false }) as never)
  },

  async welcomePartyInvites(): Promise<WelcomePartyInvite[]> {
    if (!LIVE) return [...db.welcomePartyInvites]
    return sb<WelcomePartyInvite[]>(() => supabase!.from('welcome_party_invites').select('*') as never)
  },

  async onboardingEvents(): Promise<OnboardingEvent[]> {
    if (!LIVE) return [...db.onboardingEvents]
    return sb<OnboardingEvent[]>(() => supabase!.from('onboarding_events').select('*').order('at', { ascending: false }) as never)
  },

  // The person accountable for a given owner-role on this ticket.
  _onbOwnerId(o: Onboarding, role: OnbOwnerRole): string | null {
    if (role === 'exco') return o.exco_id ?? null
    if (role === 'manco') return o.manco_id ?? null
    if (role === 'consultant') return o.consultant_id ?? null
    return null   // external: the sponsor organisation, no specific user
  },

  async _getOnb(id: string): Promise<Onboarding | undefined> {
    if (!LIVE) return db.onboardings.find(x => x.id === id)
    const rows = await sb<Onboarding[]>(() => supabase!.from('onboardings').select('*').eq('id', id).limit(1) as never)
    return rows[0]
  },

  // A hand-off: set the new status + owner, log the audit event, notify the next
  // internal actor. Notifications for sponsor-owned stages go to the owning ManCo,
  // since sponsor actions are recorded internally.
  async _onbApply(o: Onboarding, actorId: string | null, kind: OnbEventKind, toStatus: OnbStatus,
    patch: Partial<Onboarding> = {}, text: string | null = null, notice: string | null = null) {
    const fromStatus = o.status, fromOwner = o.current_owner_id ?? null
    const role = ONB_STATUS_OWNER[toStatus]
    const merged = { ...o, ...patch }
    const ownerId = repo._onbOwnerId(merged, role)
    const now = new Date().toISOString()
    const participants = Array.from(new Set([...(o.participants ?? []), actorId, ownerId].filter(Boolean))) as string[]
    const notifyTarget = ownerId ?? merged.manco_id ?? null
    if (LIVE) {
      await supabase!.from('onboardings').update({
        ...patch, status: toStatus, current_owner_role: role, current_owner_id: ownerId,
        participants, last_action_at: now,
      }).eq('id', o.id)
      await supabase!.from('onboarding_events').insert({
        onboarding_id: o.id, user_id: actorId, kind,
        from_status: fromStatus, to_status: toStatus, from_owner_id: fromOwner, to_owner_id: ownerId, text,
      })
      // Notify everyone attached to the ticket (not just the new owner); the owner gets action_required.
      if (notice) {
        const recips = participants.filter(u => u && u !== actorId)
        if (recips.length) try { await supabase!.rpc('app_notify', { recipient_ids: recips, p_kind: 'onboarding', p_text: notice, p_action_owner: notifyTarget }) } catch { /* best-effort */ }
      }
      ping(); return
    }
    const i = db.onboardings.findIndex(x => x.id === o.id)
    if (i >= 0) db.onboardings[i] = { ...merged, status: toStatus, current_owner_role: role, current_owner_id: ownerId, participants, last_action_at: now }
    db.onboardingEvents.unshift({ id: uid(), onboarding_id: o.id, at: now, user_id: actorId, kind, from_status: fromStatus, to_status: toStatus, from_owner_id: fromOwner, to_owner_id: ownerId, text: text ?? null })
    if (notice) participants.filter(u => u && u !== actorId).forEach(u =>
      db.notifications.unshift({ id: uid(), user_id: u, at: now, kind: 'onboarding', text: notice, escalation_id: null, action_required: u === notifyTarget, read: false }))
    ping()
  },

  // A log-only event (no status change): comms sent, notes.
  async _logOnb(id: string, actorId: string | null, kind: OnbEventKind, text: string | null) {
    const now = new Date().toISOString()
    if (LIVE) {
      await supabase!.from('onboarding_events').insert({ onboarding_id: id, user_id: actorId, kind, text })
      await supabase!.from('onboardings').update({ last_action_at: now }).eq('id', id)
      ping(); return
    }
    db.onboardingEvents.unshift({ id: uid(), onboarding_id: id, at: now, user_id: actorId, kind, text: text ?? null })
    const i = db.onboardings.findIndex(x => x.id === id); if (i >= 0) db.onboardings[i].last_action_at = now
    ping()
  },

  // 1) Exco opens the ticket from the sponsor's invoice request.
  async createOnboarding(input: {
    name: string; sponsor_id: string; budget?: number | null; industry?: string | null
    contact_person?: string | null; contact_email?: string | null; contact_phone?: string | null
  }, excoId: string | null) {
    const base = {
      name: input.name, sponsor_id: input.sponsor_id, budget: input.budget ?? null,
      industry: input.industry ?? null, contact_person: input.contact_person ?? null,
      contact_email: input.contact_email ?? null, contact_phone: input.contact_phone ?? null,
      status: 'invoice_requested' as OnbStatus, current_owner_role: 'exco' as OnbOwnerRole,
      current_owner_id: excoId, exco_id: excoId, created_by: excoId,
      participants: excoId ? [excoId] : [],
    }
    if (LIVE) {
      const rows = await sb<{ id: string }[]>(() => supabase!.from('onboardings').insert(base).select('id') as never)
      const nid = rows[0]?.id
      if (nid) { try { await supabase!.from('onboarding_events').insert({ onboarding_id: nid, user_id: excoId, kind: 'created', to_status: 'invoice_requested', text: `Onboarding opened for ${input.name}.` }) } catch { /* best-effort */ } }
      ping(); return
    }
    const now = new Date().toISOString()
    const o = { id: uid(), ...base, needs_onsite: false, ember_applicable: true, missed_welcome_parties: 0, created_at: now, last_action_at: now } as Onboarding
    db.onboardings.unshift(o)
    db.onboardingEvents.unshift({ id: uid(), onboarding_id: o.id, at: now, user_id: excoId, kind: 'created', to_status: 'invoice_requested', text: `Onboarding opened for ${input.name}.` })
    ping()
  },

  // 2) Exco records the invoice + budget and assigns a ManCo.
  async excoSendInvoice(id: string, actorId: string | null, invoiceNumber: string, budget: number | null, mancoId: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'invoice_sent', 'with_manco',
      { invoice_number: invoiceNumber, budget, manco_id: mancoId },
      `Invoice ${invoiceNumber} sent to the sponsor. Budget recorded.`,
      `New beneficiary to onboard: ${o.name} (invoice ${invoiceNumber}).`)
  },

  // 3) ManCo assigns a consultant to load Ember360 (+ optional site-visit flag).
  async mancoAssignEmber(id: string, actorId: string | null, consultantId: string, needsOnsite: boolean) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'assigned_ember', 'ember_loading',
      { consultant_id: consultantId, needs_onsite: needsOnsite, ember_applicable: true },
      needsOnsite ? 'Flagged as possibly non-tech-savvy; may need a site visit.' : null,
      `Load ${o.name} onto Ember360 and support their diagnostic.`)
  },

  // 3') ManCo marks Ember360 not applicable -> straight to welcome-party readiness.
  async mancoSkipEmber(id: string, actorId: string | null) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'ember_skipped', 'welcome_ready',
      { ember_applicable: false }, 'Ember360 not applicable for this beneficiary.', null)
  },

  // 4) Consultant uploads the Ember360 report + Drive folder, hands back to ManCo.
  async consultantEmberDone(id: string, actorId: string | null, driveUrl: string | null, reportUrl: string | null) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'ember_uploaded', 'ember_review',
      { drive_folder_url: driveUrl, ember360_report_url: reportUrl },
      'Drive folder created; Ember360 report uploaded.',
      `Ember360 report ready to review: ${o.name}.`)
  },

  // 5) ManCo reviews the report.
  async mancoEmberApprove(id: string, actorId: string | null) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'ember_approved', 'welcome_ready', {}, 'Ember360 report approved.', null)
  },
  async mancoEmberReject(id: string, actorId: string | null, reason: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'ember_rejected', 'ember_revision', {}, `Report returned: ${reason}`, `Ember360 report needs revision: ${o.name}. ${reason}`)
  },
  async consultantEmberRevised(id: string, actorId: string | null, note: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'ember_revised', 'ember_review', {}, note || 'Report revised.', `Revised Ember360 report ready to review: ${o.name}.`)
  },

  // 5) ManCo adds the beneficiary to a welcome party -> Aggregator/Sponsor owns it.
  async mancoAddToWelcomeParty(id: string, actorId: string | null, partyId: string) {
    const o = await repo._getOnb(id); if (!o) return
    if (LIVE) { try { await supabase!.from('welcome_party_invites').insert({ welcome_party_id: partyId, onboarding_id: id, status: 'invited' }) } catch { /* best-effort */ } }
    else { db.welcomePartyInvites.push({ id: uid(), welcome_party_id: partyId, onboarding_id: id, status: 'invited', created_at: new Date().toISOString() }) }
    await repo._onbApply(o, actorId, 'added_to_party', 'welcome_invited', { welcome_party_id: partyId }, 'Added to the welcome party list.', `${o.name} is on the welcome party list — the sponsor must send the comms.`)
  },

  // 6) Record that the sponsor sent the welcome-party comms (no status change).
  async onbCommsSent(id: string, actorId: string | null) {
    await repo._logOnb(id, actorId, 'comms_sent', 'Welcome-party comms + registration link sent to the beneficiary.')
  },

  // 7) Internal records welcome-party attendance -> moves or rolls the ticket.
  async recordAttendance(id: string, actorId: string | null, present: boolean) {
    const o = await repo._getOnb(id); if (!o) return
    if (o.welcome_party_id) {
      const at = new Date().toISOString(), st = present ? 'attended' : 'no_show'
      if (LIVE) { try { await supabase!.from('welcome_party_invites').update({ status: st, recorded_by: actorId, recorded_at: at }).eq('welcome_party_id', o.welcome_party_id).eq('onboarding_id', id) } catch { /* best-effort */ } }
      else { const inv = db.welcomePartyInvites.find(w => w.welcome_party_id === o.welcome_party_id && w.onboarding_id === id); if (inv) { inv.status = st as WelcomePartyInvite['status']; inv.recorded_by = actorId; inv.recorded_at = at } }
    }
    if (present) {
      await repo._onbApply(o, actorId, 'attended', 'attended', { missed_welcome_parties: 0 }, 'Attended the welcome party.', `${o.name} attended — generate and send the SOW.`)
    } else {
      const missed = (o.missed_welcome_parties ?? 0) + 1
      if (missed >= 2) await repo._onbApply(o, actorId, 'no_show', 'red_no_show', { missed_welcome_parties: missed }, 'Second consecutive no-show — now red.', `${o.name} missed two welcome parties — remove or request a site visit.`)
      else await repo._onbApply(o, actorId, 'rolled_over', 'rolled_over', { missed_welcome_parties: missed, welcome_party_id: null }, 'Did not attend — rolled to next week.', `${o.name} was a no-show — re-add them to next week's party.`)
    }
  },

  // 8a) ManCo sends the SOW; ticket waits on the beneficiary's signature.
  async mancoSendSow(id: string, actorId: string | null, sowUrl: string | null) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'sow_sent', 'sow_sent', { sow_url: sowUrl ?? null, sow_sent_at: new Date().toISOString() }, 'Scope of Works sent to the beneficiary.', `SOW sent to ${o.name} — awaiting signature.`)
  },

  // 9a) SOW signed -> convert the ticket into a live beneficiary in Central.
  // attachTo: an existing company key to fold this new funding line into (so a company funded by
  // several sponsors/invoices stays a single card for the consultant). Null = its own beneficiary.
  async onbSowSigned(id: string, actorId: string | null, signedDate?: string, attachTo?: string | null) {
    const o = await repo._getOnb(id); if (!o) return
    const signed = signedDate ?? new Date().toISOString().slice(0, 10)
    if (LIVE) {
      await supabase!.from('onboardings').update({ sow_signed_date: signed }).eq('id', id)
      await supabase!.from('onboarding_events').insert({ onboarding_id: id, user_id: actorId, kind: 'sow_signed', text: 'Scope of Works signed.' })
      const { data: newBenId } = await supabase!.rpc('app_convert_onboarding', { p_onboarding: id })
      if (attachTo && newBenId) {
        await supabase!.from('beneficiaries').update({ company_id: attachTo }).eq('id', newBenId as string)
        try { await supabase!.rpc('app_log_ben_event', { p_ben: newBenId, p_user: actorId, p_kind: 'edited', p_text: 'Linked as another funding line of an existing beneficiary.' }) } catch { /* best-effort */ }
      }
      ping(); return
    }
    const benId = uid(), now = new Date().toISOString()
    db.beneficiaries.push({
      id: benId, name: o.name, sponsor_id: o.sponsor_id, budget: o.budget ?? null,
      invoice_number: o.invoice_number ?? null, company_id: attachTo ?? null, industry: o.industry ?? null,
      contact_person: o.contact_person ?? null, directors: [], stage: 'implementation', project_manager_id: o.manco_id ?? null,
      ember360_report_url: o.ember360_report_url ?? null, missed_welcome_parties: o.missed_welcome_parties ?? 0,
      sow_signed_date: signed, sow_url: o.sow_url ?? null, needs_onsite: o.needs_onsite ?? false,
      drive_folder_url: o.drive_folder_url ?? null, lifecycle: 'active', cycle: 1, created_at: now,
    } as Beneficiary)
    db.benEvents.unshift({ id: uid(), beneficiary_id: benId, at: now, user_id: actorId, kind: 'loaded', text: 'Onboarded from the onboarding pipeline (SOW signed).' })
    const i = db.onboardings.findIndex(x => x.id === id)
    if (i >= 0) db.onboardings[i] = { ...db.onboardings[i], status: 'converted', converted_beneficiary_id: benId, sow_signed_date: signed, current_owner_id: null, last_action_at: now }
    db.onboardingEvents.unshift({ id: uid(), onboarding_id: id, at: now, user_id: actorId, kind: 'sow_signed', text: 'Scope of Works signed.' })
    db.onboardingEvents.unshift({ id: uid(), onboarding_id: id, at: now, user_id: actorId, kind: 'converted', to_status: 'converted', text: 'SOW signed — beneficiary created in Central.' })
    ping()
  },

  // 8b) Sponsor decisions after two missed parties.
  async onbWithdraw(id: string, actorId: string | null, reason: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'withdrawn', 'withdrawn', { withdrawn_reason: reason ?? null }, reason ? `Withdrawn: ${reason}` : 'Withdrawn.', null)
  },
  async onbRequestVisit(id: string, actorId: string | null, note: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'visit_requested', 'remediation', {}, note || 'Sponsor requested a site visit / follow-up call.', `${o.name}: sponsor requested a site visit — assign a consultant.`)
  },
  async onbAssignVisit(id: string, actorId: string | null, consultantId: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'visit_assigned', 'remediation_visit', { consultant_id: consultantId }, 'Assigned for a site visit / follow-up call.', `Site visit / call needed for ${o.name}.`)
  },
  async onbBackOnTrack(id: string, actorId: string | null, note: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'back_on_track', 'welcome_ready', { missed_welcome_parties: 0 }, note || 'Beneficiary re-engaged — ready for a welcome party.', `${o.name} is back on track — add them to a welcome party.`)
  },

  // 9b) Onboarding escalation (surfaces in the ManCo Escalations view).
  async onbEscalate(id: string, actorId: string | null, mancoId: string, reason: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'escalated_manco', 'esc_manco', { manco_id: mancoId }, `Escalated: ${reason}`, `Onboarding escalation to review: ${o.name}.`)
  },
  async onbEscApprove(id: string, actorId: string | null, note: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'esc_approved', 'esc_sponsor', {}, note || 'Escalation approved — sent to the Aggregator/Sponsor.', `${o.name}: onboarding escalation now with the Aggregator/Sponsor.`)
  },
  async onbEscDecline(id: string, actorId: string | null, reason: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'esc_declined', 'remediation_visit', {}, `Declined: ${reason}`, `Escalation declined — keep working ${o.name}.`)
  },
  async onbEscReturn(id: string, actorId: string | null, note: string) {
    const o = await repo._getOnb(id); if (!o) return
    await repo._onbApply(o, actorId, 'esc_returned', 'remediation_visit', {}, note || 'Returned by the Aggregator/Sponsor with guidance.', `${o.name}: escalation returned — continue the site-visit effort.`)
  },

  // Direct escalation from ANY active stage straight to the Aggregator/Sponsor (no ManCo approval).
  // Remembers the stage so resolution returns the ticket to exactly where it left off.
  async onbRaiseToSponsor(id: string, actorId: string | null, reason: string) {
    const o = await repo._getOnb(id); if (!o) return
    if (ONB_ESC_STATUSES.includes(o.status) || ONB_TERMINAL.includes(o.status)) return
    await repo._onbApply(o, actorId, 'escalated_sponsor', 'esc_sponsor',
      { esc_return_status: o.status }, `Escalated to the Aggregator/Sponsor: ${reason}`,
      `Onboarding escalation — ${o.name} is with the Aggregator/Sponsor.`)
  },
  // Aggregator/Sponsor resolves the escalation -> ticket returns directly to the originating stage.
  async onbResolveEscalation(id: string, actorId: string | null, note: string) {
    const o = await repo._getOnb(id); if (!o) return
    if (o.status !== 'esc_sponsor') return
    const back = (o.esc_return_status ?? 'remediation_visit') as OnbStatus
    await repo._onbApply(o, actorId, 'esc_resolved', back,
      { esc_return_status: null }, note || 'Resolved by the Aggregator/Sponsor.',
      `${o.name}: escalation resolved — back with ${ONB_OWNER_LABEL[ONB_STATUS_OWNER[back]]}.`)
  },

  async addOnbNote(id: string, actorId: string | null, text: string) {
    await repo._logOnb(id, actorId, 'note', text)
  },

  // Welcome party events.
  async createWelcomeParty(input: { party_date: string; title?: string | null; notes?: string | null; teams_url?: string | null }, actorId: string | null) {
    if (LIVE) { await supabase!.from('welcome_parties').insert({ party_date: input.party_date, title: input.title ?? null, notes: input.notes ?? null, teams_url: input.teams_url ?? null, created_by: actorId }); ping(); return }
    db.welcomeParties.unshift({ id: uid(), party_date: input.party_date, title: input.title ?? null, notes: input.notes ?? null, teams_url: input.teams_url ?? null, created_by: actorId, created_at: new Date().toISOString() })
    ping()
  },

  // ManCo-only: edit a welcome party's date / title / Teams link.
  async updateWelcomeParty(id: string, patch: { party_date?: string; title?: string | null; teams_url?: string | null }, _actorId: string | null) {
    if (LIVE) { await supabase!.from('welcome_parties').update(patch).eq('id', id); ping(); return }
    const i = db.welcomeParties.findIndex(w => w.id === id); if (i < 0) return
    db.welcomeParties[i] = { ...db.welcomeParties[i], ...patch }
    ping()
  },

  // ManCo-only: delete a welcome party. Detaches any tickets still pointing at it and clears its invites first.
  async deleteWelcomeParty(id: string, _actorId: string | null) {
    if (LIVE) {
      await supabase!.from('onboardings').update({ welcome_party_id: null }).eq('welcome_party_id', id)
      await supabase!.from('welcome_party_invites').delete().eq('welcome_party_id', id)
      await supabase!.from('welcome_parties').delete().eq('id', id)
      ping(); return
    }
    db.onboardings.forEach((o, i) => { if (o.welcome_party_id === id) db.onboardings[i] = { ...o, welcome_party_id: null } })
    db.welcomePartyInvites = db.welcomePartyInvites.filter(v => v.welcome_party_id !== id)
    db.welcomeParties = db.welcomeParties.filter(w => w.id !== id)
    ping()
  },
}
