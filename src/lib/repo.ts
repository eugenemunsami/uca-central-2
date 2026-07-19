import { LIVE, supabase } from './supabase'
import * as seed from './demo'
import { computeRag, worst } from './rag'
import type {
  Aggregator, Beneficiary, BeneficiaryEvent, BeneficiaryView, CatalogueItem, Comm, Escalation,
  EscalationEvent, EscalationView, EscStatus, EscSuggestion, Intervention, InterventionView,
  Notification, Profile, Rag, RagOverride, Role, Sponsor, UserEvent, UserStatus, WeeklyUpdate,
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

export const repo = {
  live: LIVE,

  async profiles(): Promise<Profile[]> {
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
    if (LIVE) { await supabase!.from('beneficiaries').insert(input); return }
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
    if (LIVE) { await supabase!.from('beneficiaries').insert(rows); return }
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
    const ben = db.beneficiaries.find(b => b.id === input.beneficiary_id)
    if (LIVE) { await supabase!.from('interventions').insert({ cycle: ben?.cycle ?? 1, ...input }); return }
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
    const iv = db.interventions.find(i => i.id === id)
    if (iv) {
      pushBenEvent(iv.beneficiary_id, userId, 'closeout_requested', repo._ivTitle(iv) + ' — files uploaded, close-out email sent.')
      db.profiles.filter(p => p.role === 'manco' || p.role === 'exco').forEach(p =>
        notify([p.id], 'closeout_requested', `Close-out to verify: ${repo._benName(iv.beneficiary_id)} — ${repo._ivTitle(iv)}.`, ''))
    }
  },

  // ManCo verifies the files + email and confirms -> intervention completed; client notified.
  async confirmCloseout(id: string, userId: string | null) {
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, {
      closeout_status: 'confirmed', status: 'completed',
      completed_at: new Date().toISOString(), awaiting_response_since: null,
      closeout_confirmed_by: userId, closeout_confirmed_at: new Date().toISOString(),
    })
    if (iv) {
      pushBenEvent(iv.beneficiary_id, userId, 'closeout_confirmed', repo._ivTitle(iv) + ' verified and confirmed.')
      if (iv.closeout_requested_by) notify([iv.closeout_requested_by], 'closeout_confirmed', `Your close-out was confirmed: ${repo._ivTitle(iv)}.`, '')
      const rec = repo._recipientsFor(iv.beneficiary_id)
      notify(rec, 'intervention_closed', `An intervention closed out: ${repo._benName(iv.beneficiary_id)} — ${repo._ivTitle(iv)}.`, '')
    }
  },

  // ManCo returns a close-out to the consultant with a reason.
  async returnCloseout(id: string, userId: string | null, reason: string) {
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, { closeout_status: 'none' })
    if (iv) {
      pushBenEvent(iv.beneficiary_id, userId, 'closeout_returned', `${repo._ivTitle(iv)} returned: ${reason}`)
      if (iv.closeout_requested_by) notify([iv.closeout_requested_by], 'closeout_returned', `Close-out returned on ${repo._ivTitle(iv)}: ${reason}`, '')
    }
  },

  // Consultant grants an allowable delay: pauses the red clock until the given date.
  async grantDelay(id: string, userId: string | null, until: string, note?: string) {
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, { response_extended_until: until })
    if (iv) pushBenEvent(iv.beneficiary_id, userId, 'delay_granted', `${repo._ivTitle(iv)} — allowable delay until ${until}. ${note ?? ''}`.trim())
  },

  // Soft-cancel an intervention (never hard-deleted).
  async cancelIntervention(id: string, userId: string | null) {
    const iv = db.interventions.find(i => i.id === id)
    await repo.updateIntervention(id, { cancelled: true })
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
    const b = db.beneficiaries.find(x => x.id === benId); if (!b) return
    b.lifecycle = 'closeout_sent'; b.closeout_report_url = reportUrl; b.closeout_return_notes = null
    pushBenEvent(benId, userId, 'closeout_report_sent', note || 'POE/close-out report produced and sent to the client.')
    notify(repo._recipientsFor(benId), 'beneficiary_closeout_sent', `Close-out report to review: ${b.name}.`, '')
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  // Client acknowledges -> concluded (visible for the month).
  async acknowledgeBeneficiaryCloseout(benId: string, userId: string | null) {
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
    const b = db.beneficiaries.find(x => x.id === benId); if (!b || b.lifecycle !== 'closeout_sent') return
    b.lifecycle = 'pending_closeout'; b.closeout_return_notes = notes
    pushBenEvent(benId, userId, 'returned_by_client', notes)
    if (b.project_manager_id) notify([b.project_manager_id], 'beneficiary_returned', `${b.name} close-out returned by client: ${notes}`, '')
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  // ManCo archives a concluded beneficiary (kept for records, re-onboardable).
  async archiveBeneficiary(benId: string, userId: string | null) {
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
    const b = db.beneficiaries.find(x => x.id === benId); if (!b) return
    b.lifecycle = 'active'; b.cycle = (b.cycle ?? 1) + 1
    b.sow_signed_date = sowDate; b.concluded_at = null; b.archived_at = null; b.closeout_report_url = null
    pushBenEvent(benId, userId, 'reonboarded', `Re-onboarded for cycle ${b.cycle} with a new SOW.`)
    if (LIVE) await supabase!.from('beneficiaries').update(b).eq('id', benId)
    ping()
  },

  async updateBeneficiary(benId: string, patch: Partial<Beneficiary>, userId: string | null) {
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

  async addWeeklyUpdate(u: Omit<WeeklyUpdate, 'id' | 'created_at'>) {
    if (LIVE) { await supabase!.from('weekly_updates').insert(u); return }
    db.updates.unshift({ ...u, id: uid(), created_at: new Date().toISOString() })
    ping()
  },

  async addComm(c: Omit<Comm, 'id'>) {
    if (LIVE) { await supabase!.from('comms_log').insert(c); return }
    db.comms.unshift({ ...c, id: uid() })
    const b = db.beneficiaries.findIndex(x => x.id === c.beneficiary_id)
    if (b >= 0) db.beneficiaries[b].last_engagement_at = c.occurred_at
    ping()
  },

  // ---- escalation: ownership-baton state machine (per single intervention) ----
  _esc(id: string) { return db.escalations.find(x => x.id === id) },

  _addParticipant(e: Escalation, userId: string | null) {
    if (userId && !e.participants.includes(userId)) e.participants.push(userId)
  },

  // 1) Consultant escalates an intervention to a chosen ManCo.
  async escalateToManco(input: {
    intervention_id: string; beneficiary_id: string; consultant_id: string
    manco_id: string; reason: string; context?: string | null
  }) {
    const now = new Date().toISOString()
    const e: Escalation = {
      id: uid(), intervention_id: input.intervention_id, beneficiary_id: input.beneficiary_id,
      reason: input.reason, context: input.context ?? null, status: 'with_manco',
      current_owner_id: input.manco_id, current_owner_role: 'manco',
      consultant_id: input.consultant_id, manco_id: input.manco_id, sponsor_id: null,
      participants: [input.consultant_id, input.manco_id],
      raised_by: input.consultant_id, raised_at: now, last_action_at: now, resolved_at: null,
    }
    if (LIVE) { await supabase!.from('escalations').insert(e); return }
    db.escalations.unshift(e)
    pushEscEvent(e.id, input.consultant_id, 'escalated_to_manco', {
      to_status: 'with_manco', to_owner_id: input.manco_id,
      text: input.reason + (input.context ? '\n\nContext: ' + input.context : ''),
    })
    pushBenEvent(input.beneficiary_id, input.consultant_id, 'note', 'Intervention escalated to ManCo.')
    notifyEsc(e, input.consultant_id, `Escalation to review: ${repo._benName(input.beneficiary_id)}.`, input.manco_id)
    ping()
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
    const e = repo._esc(id); if (!e || e.current_owner_id !== mancoId) return
    repo._transfer(e, mancoId, 'declined_to_consultant', 'returned_to_consultant', e.consultant_id, 'consultant',
      `Declined: ${reason}\nSuggested way forward: ${wayForward}`,
      `Escalation returned to you: ${repo._benName(e.beneficiary_id)}.`)
  },

  // 2B) ManCo escalates to a chosen Aggregator/Sponsor recipient.
  async mancoEscalateSponsor(id: string, mancoId: string, sponsorUserId: string, reason: string, expectedAction: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== mancoId) return
    e.manco_id = mancoId; e.sponsor_id = sponsorUserId
    repo._transfer(e, mancoId, 'escalated_to_sponsor', 'with_sponsor', sponsorUserId, 'external',
      `${reason}\nExpected action: ${expectedAction}`,
      `Escalation to review: ${repo._benName(e.beneficiary_id)}.`)
  },

  // Consultant accepts a returned escalation -> resolved & unlocked.
  async consultantAcceptReturn(id: string, consultantId: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== consultantId) return
    repo._transfer(e, consultantId, 'accepted', 'resolved', consultantId, 'consultant',
      'Accepted the return and resumed the case.',
      `Escalation closed: ${repo._benName(e.beneficiary_id)}.`)
  },

  // Consultant re-escalates to a chosen ManCo (from returned or outcome).
  async consultantReEscalate(id: string, consultantId: string, mancoId: string, reason: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== consultantId) return
    e.manco_id = mancoId
    repo._transfer(e, consultantId, 'reescalated', 'with_manco', mancoId, 'manco',
      `Re-escalated: ${reason}`, `Escalation to review: ${repo._benName(e.beneficiary_id)}.`)
  },

  // 3A) Sponsor declines -> back to the ManCo who sent it.
  async sponsorDecline(id: string, sponsorUserId: string, reason: string, wayForward: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== sponsorUserId) return
    repo._transfer(e, sponsorUserId, 'declined_to_manco', 'returned_to_manco', e.manco_id ?? null, 'manco',
      `Declined: ${reason}\nSuggested way forward: ${wayForward}`,
      `Escalation returned by sponsor: ${repo._benName(e.beneficiary_id)}.`)
  },

  // 3B) Sponsor submits a proposed resolution -> back to ManCo to review (not auto-closed).
  async sponsorResolve(id: string, sponsorUserId: string, action: string, resolution: string, notes?: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== sponsorUserId) return
    repo._transfer(e, sponsorUserId, 'resolution_submitted', 'resolution_submitted', e.manco_id ?? null, 'manco',
      `Action taken: ${action}\nProposed resolution: ${resolution}${notes ? '\nNotes: ' + notes : ''}`,
      `Resolution submitted for review: ${repo._benName(e.beneficiary_id)}.`)
  },

  // 4) ManCo returns the outcome to the consultant.
  async mancoReturnToConsultant(id: string, mancoId: string, resolution: string, nextSteps: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== mancoId) return
    repo._transfer(e, mancoId, 'returned_to_consultant', 'outcome_to_consultant', e.consultant_id, 'consultant',
      `Outcome: ${resolution}\nNext steps: ${nextSteps}`,
      `Escalation outcome received: ${repo._benName(e.beneficiary_id)}.`)
  },

  // 4) ManCo re-escalates back to a sponsor with additional context.
  async mancoReEscalateSponsor(id: string, mancoId: string, sponsorUserId: string, context: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== mancoId) return
    e.sponsor_id = sponsorUserId
    repo._transfer(e, mancoId, 'reescalated', 'with_sponsor', sponsorUserId, 'external',
      `Re-escalated with more context: ${context}`, `Escalation to review: ${repo._benName(e.beneficiary_id)}.`)
  },

  // Consultant accepts the outcome -> resolved & unlocked.
  async consultantAcceptResume(id: string, consultantId: string) {
    const e = repo._esc(id); if (!e || e.current_owner_id !== consultantId) return
    repo._transfer(e, consultantId, 'accepted', 'resolved', consultantId, 'consultant',
      'Accepted the outcome and resumed the case.', `Escalation closed: ${repo._benName(e.beneficiary_id)}.`)
  },

  // Any current owner or participant may add a note to the audit trail.
  async addEscalationNote(id: string, userId: string | null, text: string) {
    const e = repo._esc(id); if (!e) return
    if (LIVE) { await supabase!.from('escalation_events').insert({ escalation_id: id, user_id: userId, kind: 'note', text }); return }
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

  async saveProfile(p: Partial<Profile>) {
    if (LIVE) {
      if (p.id) await supabase!.from('profiles').update(p).eq('id', p.id)
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
    if (LIVE) { await supabase!.from('profiles').insert(profile); return { id, temp } }
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

  async resendInvite(id: string, byUserId: string | null) {
    const pr = db.profiles.find(x => x.id === id); if (!pr) return
    pr.status = 'pending'; pr.invited_at = new Date().toISOString()
    pr.invite_expires_at = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    pr.temp_password = 'UCA-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    pushUserEvent(id, byUserId, 'invite_resent', 'Invitation resent (new 72h window).')
    if (LIVE) await supabase!.from('profiles').update(pr).eq('id', id)
    ping()
  },

  // ManCo initiates a reset — sends a secure link (48h). ManCo never sees/sets the password.
  async resetUserPassword(id: string, byUserId: string | null) {
    pushUserEvent(id, byUserId, 'password_reset_sent', 'Password reset email sent (link expires in 48h).')
    ping()
  },

  async setUserStatus(id: string, status: UserStatus, byUserId: string | null) {
    const pr = db.profiles.find(x => x.id === id); if (!pr) return
    pr.status = status
    pr.active = status === 'active'
    const kind = status === 'suspended' ? 'suspended' : status === 'deactivated' ? 'deactivated' : 'reactivated'
    pushUserEvent(id, byUserId, kind as UserEvent['kind'])
    if (LIVE) await supabase!.from('profiles').update({ status, active: pr.active }).eq('id', id)
    ping()
  },

  async changeUserRole(id: string, role: Role, byUserId: string | null) {
    const pr = db.profiles.find(x => x.id === id); if (!pr) return
    const prev = pr.role; pr.role = role
    pushUserEvent(id, byUserId, 'role_changed', `Role changed from ${prev} to ${role}.`)
    if (LIVE) await supabase!.from('profiles').update({ role }).eq('id', id)
    ping()
  },
}
