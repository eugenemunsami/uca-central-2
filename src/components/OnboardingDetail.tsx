import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUp, CornerUpLeft, FileSignature, Lock, MessageSquarePlus, Send, ShieldCheck,
  UserPlus, CalendarPlus, CheckCircle2, XCircle, MapPin, Ban, X,
} from 'lucide-react'
import { useData } from '../lib/useData'
import { repo } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import {
  ONB_STATUS_LABEL, ONB_STATUS_OWNER, ONB_OWNER_LABEL, ONB_EVENT_LABEL, ONB_TERMINAL, ONB_ESC_STATUSES, companyKey,
  type OnbStatus,
} from '../lib/types'
import { Empty, Field, fmtDate } from './ui'

const ONB_HEX: Record<OnbStatus, string> = {
  invoice_requested: '#F5B942', with_manco: '#4C93E8', ember_loading: '#7F77DD', ember_review: '#4C93E8',
  ember_revision: '#7F77DD', welcome_ready: '#4C93E8', welcome_invited: '#7F77DD', rolled_over: '#F5B942',
  attended: '#19A06E', sow_sent: '#4C93E8', red_no_show: '#EE4823', remediation: '#4C93E8',
  remediation_visit: '#7F77DD', esc_manco: '#EE4823', esc_sponsor: '#7F77DD', converted: '#9FD150', withdrawn: '#888780',
}

export function OnbStatusPill({ status }: { status: OnbStatus }) {
  const hex = ONB_HEX[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}>
      {ONB_STATUS_LABEL[status]}
    </span>
  )
}

function dt(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type FormKind =
  | null | 'note' | 'invoice' | 'assign_ember' | 'ember_done' | 'ember_reject' | 'ember_revised'
  | 'add_party' | 'send_sow' | 'sow_signed' | 'withdraw' | 'request_visit' | 'assign_visit'
  | 'back_on_track' | 'escalate' | 'esc_approve' | 'esc_decline' | 'esc_return'
  | 'raise_sponsor' | 'resolve_esc'

export default function OnboardingDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const { onboardings, onboardingEvents, welcomeParties, people, beneficiaries } = useData()
  const { user } = useAuth()
  const [form, setForm] = useState<FormKind>(null)
  const [a, setA] = useState('')       // primary text
  const [b, setB] = useState('')       // secondary text
  const [num, setNum] = useState('')   // budget
  const [target, setTarget] = useState('')  // selected person / party id
  const [flag, setFlag] = useState(false)   // needs_onsite

  const o = onboardings.find(x => x.id === id)
  const events = useMemo(
    () => onboardingEvents.filter(v => v.onboarding_id === id).sort((x, y) => y.at.localeCompare(x.at)),
    [onboardingEvents, id])

  if (!o) return <Empty text="Onboarding not found." />

  const name = (uid?: string | null) => people.find(p => p.id === uid)?.full_name ?? (uid ? 'Unknown' : 'System')
  const mancos = people.filter(p => (p.role === 'manco' || p.role === 'exco') && p.status !== 'deactivated' && !p.removed_at)
  const consultants = people.filter(p => p.role === 'consultant' && p.status !== 'deactivated' && !p.removed_at)
  const futureParties = [...welcomeParties].sort((x, y) => x.party_date.localeCompare(y.party_date))

  const ownerRole = ONB_STATUS_OWNER[o.status]
  const isTerminal = ONB_TERMINAL.includes(o.status)
  const internal = user?.role === 'manco' || user?.role === 'exco'
  // An aggregator/sponsor user attached to THIS ticket's programme can act at the stages the model
  // already hands to the sponsor (red no-show — remove / request a visit, and a sponsor escalation).
  const externalMine = user?.role === 'external' && !!(
    (user.external_sponsor_id && user.external_sponsor_id === o.sponsor_id) ||
    (user.external_client_id && user.external_client_id === o.client_id))
  const EXTERNAL_ACT: OnbStatus[] = ['red_no_show', 'esc_sponsor']
  const canAct = !isTerminal && (
    ownerRole === 'consultant' ? user?.id === o.consultant_id
    : ownerRole === 'external' ? (internal || (externalMine && EXTERNAL_ACT.includes(o.status)))
    : internal)
  const locked = !canAct && !isTerminal

  const reset = () => { setForm(null); setA(''); setB(''); setNum(''); setTarget(''); setFlag(false) }

  const submit = async () => {
    if (!user) return
    switch (form) {
      case 'note': await repo.addOnbNote(id, user.id, a); break
      case 'invoice': await repo.excoSendInvoice(id, user.id, a, num ? Number(num) : null, target); break
      case 'assign_ember': await repo.mancoAssignEmber(id, user.id, target, flag); break
      case 'ember_done': await repo.consultantEmberDone(id, user.id, a || null, b || null); break
      case 'ember_reject': await repo.mancoEmberReject(id, user.id, a); break
      case 'ember_revised': await repo.consultantEmberRevised(id, user.id, a); break
      case 'add_party': await repo.mancoAddToWelcomeParty(id, user.id, target); break
      case 'send_sow': await repo.mancoSendSow(id, user.id, a || null); break
      case 'sow_signed': await repo.onbSowSigned(id, user.id, a || undefined, target || null); break
      case 'withdraw': await repo.onbWithdraw(id, user.id, a); break
      case 'request_visit': await repo.onbRequestVisit(id, user.id, a); break
      case 'assign_visit': await repo.onbAssignVisit(id, user.id, target); break
      case 'back_on_track': await repo.onbBackOnTrack(id, user.id, a); break
      case 'escalate': await repo.onbEscalate(id, user.id, target, a); break
      case 'esc_approve': await repo.onbEscApprove(id, user.id, a); break
      case 'esc_decline': await repo.onbEscDecline(id, user.id, a); break
      case 'esc_return': await repo.onbEscReturn(id, user.id, a); break
      case 'raise_sponsor': await repo.onbRaiseToSponsor(id, user.id, a); break
      case 'resolve_esc': await repo.onbResolveEscalation(id, user.id, a); break
    }
    reset()
  }

  // Direct (no-form) actions.
  const act = async (fn: () => Promise<void>) => { await fn(); }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg text-white">{o.name}</span>
            <OnbStatusPill status={o.status} />
            {o.needs_onsite && <span className="rounded-full bg-amberx/15 px-2 py-0.5 text-[11px] text-amberx">Site visit flag</span>}
            {locked && <span className="inline-flex items-center gap-1 text-[11px] text-flame"><Lock size={12} /> {ONB_OWNER_LABEL[ownerRole]} owns this</span>}
          </div>
          <div className="mt-0.5 text-xs text-white/40">
            {o.client_name}{o.sponsor_name !== o.client_name ? ` · ${o.sponsor_name}` : ''}
            {o.invoice_number ? ` · Invoice ${o.invoice_number}` : ''}
            {o.budget != null ? ` · R${Number(o.budget).toLocaleString('en-ZA')}` : ''}
          </div>
        </div>
        {onClose && <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close"><X size={18} /></button>}
      </div>

      <div className="grid gap-3 rounded-xl bg-ink-800 p-4 text-sm md:grid-cols-2">
        <Meta k="Current owner" v={ONB_OWNER_LABEL[ownerRole]} sub={o.current_owner_id ? name(o.current_owner_id) : (ownerRole === 'external' ? o.sponsor_name : undefined)} />
        <Meta k="Status" v={ONB_STATUS_LABEL[o.status]} />
        <Meta k="ManCo" v={o.manco_name ?? 'unassigned'} />
        <Meta k="Consultant" v={o.consultant_name ?? 'unassigned'} />
        {o.welcome_party_date && <Meta k="Welcome party" v={fmtDate(o.welcome_party_date)} sub={o.missed_welcome_parties ? `${o.missed_welcome_parties} missed` : undefined} />}
        <Meta k="Last action" v={dt(o.last_action_at)} />
        {o.ember360_report_url && <Meta k="Ember360 report" v="Uploaded" />}
        {o.converted_beneficiary_id && <Meta k="Converted" v="Now a beneficiary in Central" />}
        {o.withdrawn_reason && <Meta k="Withdrawn" v={o.withdrawn_reason} danger />}
      </div>

      {/* Owner actions */}
      {canAct && (
        <div className="flex flex-wrap gap-2">
          {o.status === 'invoice_requested' && (
            <button className="btn-primary" onClick={() => setForm('invoice')}><Send size={15} /> Send invoice &amp; assign ManCo</button>
          )}
          {o.status === 'with_manco' && (
            <>
              <button className="btn-primary" onClick={() => setForm('assign_ember')}><UserPlus size={15} /> Assign consultant (Ember360)</button>
              <button className="btn-ghost" onClick={() => act(() => repo.mancoSkipEmber(id, user!.id))}>Ember360 not applicable</button>
            </>
          )}
          {o.status === 'ember_loading' && (
            <button className="btn-primary" onClick={() => setForm('ember_done')}><Send size={15} /> Upload report &amp; hand back</button>
          )}
          {o.status === 'ember_review' && (
            <>
              <button className="btn-primary" onClick={() => act(() => repo.mancoEmberApprove(id, user!.id))}><ShieldCheck size={15} /> Approve report</button>
              <button className="btn-ghost" onClick={() => setForm('ember_reject')}><CornerUpLeft size={15} /> Return for revision</button>
            </>
          )}
          {o.status === 'ember_revision' && (
            <button className="btn-primary" onClick={() => setForm('ember_revised')}><Send size={15} /> Re-submit revised report</button>
          )}
          {(o.status === 'welcome_ready' || o.status === 'rolled_over') && (
            <button className="btn-primary" onClick={() => setForm('add_party')}><CalendarPlus size={15} /> Add to welcome party</button>
          )}
          {o.status === 'welcome_invited' && (
            <>
              <button className="btn-primary" onClick={() => act(() => repo.recordAttendance(id, user!.id, true))}><CheckCircle2 size={15} /> Attended</button>
              <button className="btn-ghost" onClick={() => act(() => repo.recordAttendance(id, user!.id, false))}><XCircle size={15} /> No-show</button>
              <button className="btn-ghost" onClick={() => act(() => repo.onbCommsSent(id, user!.id))}>Record: comms sent</button>
            </>
          )}
          {o.status === 'attended' && (
            <button className="btn-primary" onClick={() => setForm('send_sow')}><FileSignature size={15} /> Send Scope of Works</button>
          )}
          {o.status === 'sow_sent' && (
            <button className="btn-primary" onClick={() => setForm('sow_signed')}><CheckCircle2 size={15} /> SOW signed → convert</button>
          )}
          {o.status === 'red_no_show' && (
            <>
              <button className="btn-primary" onClick={() => setForm('request_visit')}><MapPin size={15} /> Request site visit / call</button>
              <button className="btn-ghost" onClick={() => setForm('withdraw')}><Ban size={15} /> Remove (withdraw)</button>
            </>
          )}
          {o.status === 'remediation' && (
            <button className="btn-primary" onClick={() => setForm('assign_visit')}><UserPlus size={15} /> Assign consultant for visit</button>
          )}
          {o.status === 'remediation_visit' && (
            <>
              <button className="btn-primary" onClick={() => setForm('back_on_track')}><CheckCircle2 size={15} /> Back on track → welcome party</button>
              <button className="btn-ghost" onClick={() => setForm('escalate')}><ArrowUp size={15} /> Escalate to ManCo</button>
            </>
          )}
          {o.status === 'esc_manco' && (
            <>
              <button className="btn-primary" onClick={() => setForm('esc_approve')}><ArrowUp size={15} /> Approve → Aggregator/Sponsor</button>
              <button className="btn-ghost" onClick={() => setForm('esc_decline')}><CornerUpLeft size={15} /> Decline → consultant</button>
            </>
          )}
          {o.status === 'esc_sponsor' && (
            <button className="btn-primary" onClick={() => setForm('resolve_esc')}><CornerUpLeft size={15} /> Resolve escalation → return</button>
          )}
          {internal && !ONB_ESC_STATUSES.includes(o.status) && (
            <button className="btn-ghost" onClick={() => setForm('raise_sponsor')}><ArrowUp size={15} /> Escalate to Sponsor</button>
          )}
          {internal && (
            <button className="btn-ghost" onClick={() => setForm('note')}><MessageSquarePlus size={15} /> Add note</button>
          )}
        </div>
      )}
      {locked && (
        <div className="rounded-xl border border-flame/40 bg-flame-soft px-4 py-3 text-sm text-flame">
          <Lock size={14} className="mr-1 inline" /> This ticket sits with {ONB_OWNER_LABEL[ownerRole]}
          {o.current_owner_id ? ` (${name(o.current_owner_id)})` : ''}. You can view everything; only the owner acts.
          {internal && <button className="ml-3 text-white/60 underline" onClick={() => setForm('note')}>Add a note</button>}
        </div>
      )}

      {/* action forms */}
      {form && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          {form === 'invoice' && (
            <>
              <Field label="Invoice number (required)"><input className="input" value={a} onChange={e => setA(e.target.value)} /></Field>
              <Field label="Budget (R)"><input className="input" type="number" value={num} onChange={e => setNum(e.target.value)} /></Field>
              <Field label="Assign to ManCo (required)">
                <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                  <option value="">Select ManCo</option>
                  {mancos.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </Field>
            </>
          )}
          {form === 'assign_ember' && (
            <>
              <Field label="Consultant (required)">
                <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                  <option value="">Select consultant</option>
                  {consultants.map(p => <option key={p.id} value={p.id}>{p.full_name}{p.discipline ? ` · ${p.discipline}` : ''}</option>)}
                </select>
              </Field>
              <label className="mb-2 flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={flag} onChange={e => setFlag(e.target.checked)} />
                Non-tech-savvy — may need a site visit
              </label>
            </>
          )}
          {form === 'ember_done' && (
            <>
              <Field label="Drive folder URL"><input className="input" value={a} onChange={e => setA(e.target.value)} placeholder="https://drive.google.com/…" /></Field>
              <Field label="Ember360 report URL"><input className="input" value={b} onChange={e => setB(e.target.value)} placeholder="https://drive.google.com/…" /></Field>
            </>
          )}
          {form === 'add_party' && (
            <Field label="Welcome party (required)">
              <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="">Select a welcome party</option>
                {futureParties.map(w => <option key={w.id} value={w.id}>{fmtDate(w.party_date)}{w.title ? ` · ${w.title}` : ''}</option>)}
              </select>
            </Field>
          )}
          {form === 'assign_visit' && (
            <Field label="Consultant for the visit / call (required)">
              <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="">Select consultant</option>
                {consultants.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
          )}
          {form === 'escalate' && (
            <Field label="Escalate to ManCo (required)">
              <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="">Select ManCo</option>
                {mancos.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
          )}
          {form === 'send_sow' && (
            <Field label="Signed SOW / document URL (optional)"><input className="input" value={a} onChange={e => setA(e.target.value)} placeholder="https://…" /></Field>
          )}
          {form === 'sow_signed' && (
            <>
              <Field label="Date signed (optional — defaults to today)"><input className="input" type="date" value={a} onChange={e => setA(e.target.value)} /></Field>
              <Field label="Beneficiary" hint="Attach this invoice to an existing beneficiary if it's the same business funded by another sponsor/invoice; otherwise it becomes a new one.">
                <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
                  <option value="">Create a new beneficiary</option>
                  {beneficiaries
                    .filter(x => companyKey(x) === x.id && x.lifecycle !== 'archived')
                    .sort((p, q) =>
                      (p.sponsor_id === o.sponsor_id ? 0 : 1) - (q.sponsor_id === o.sponsor_id ? 0 : 1) ||
                      p.name.localeCompare(q.name))
                    .map(x => (
                      <option key={x.id} value={x.id}>
                        Attach to: {x.name}{x.sponsor_name ? ` — ${x.sponsor_name}` : ''}{x.invoice_number ? ` (${x.invoice_number})` : ''}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
          {(form === 'note' || form === 'ember_reject' || form === 'ember_revised' || form === 'withdraw'
            || form === 'request_visit' || form === 'back_on_track' || form === 'escalate'
            || form === 'esc_approve' || form === 'esc_decline' || form === 'esc_return'
            || form === 'raise_sponsor' || form === 'resolve_esc') && (
            <Field label={
              form === 'note' ? 'Note'
              : form === 'ember_reject' ? 'What needs fixing (required)'
              : form === 'withdraw' ? 'Reason for removal (required)'
              : form === 'request_visit' ? 'Context for the visit / call'
              : form === 'escalate' || form === 'esc_decline' ? 'Reason (required)'
              : form === 'raise_sponsor' ? 'Reason for escalation (required)'
              : form === 'resolve_esc' ? 'Resolution note (recorded on behalf of the Aggregator/Sponsor)'
              : 'Note'
            }>
              <textarea className="input h-20 resize-none" value={a} onChange={e => setA(e.target.value)} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={reset}>Cancel</button>
            <button className="btn-primary"
              disabled={
                (form === 'invoice' && (!a.trim() || !target))
                || (form === 'assign_ember' && !target)
                || (form === 'add_party' && !target)
                || (form === 'assign_visit' && !target)
                || (form === 'escalate' && (!target || !a.trim()))
                || (['note', 'ember_reject', 'ember_revised', 'withdraw', 'request_visit', 'back_on_track', 'esc_approve', 'esc_decline', 'esc_return', 'raise_sponsor'].includes(form) && !a.trim())
              }
              onClick={submit}>Submit</button>
          </div>
        </div>
      )}

      {/* audit history */}
      <div>
        <div className="label mb-3">History — immutable audit trail</div>
        <div className="space-y-3">
          {events.map(v => (
            <motion.div key={v.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full"
                style={{ background: v.to_status ? ONB_HEX[v.to_status] : '#888780' }} />
              <div className="flex-1 border-b border-ink-600/60 pb-3">
                <div className="text-sm text-white/80">{ONB_EVENT_LABEL[v.kind] ?? v.kind}</div>
                {v.text && <div className="mt-0.5 whitespace-pre-line text-[13px] text-white/55">{v.text}</div>}
                <div className="mt-1 text-[11px] text-white/30">
                  {dt(v.at)} · {name(v.user_id)}
                  {v.from_status && v.to_status && ` · ${ONB_STATUS_LABEL[v.from_status]} → ${ONB_STATUS_LABEL[v.to_status]}`}
                </div>
              </div>
            </motion.div>
          ))}
          {events.length === 0 && <Empty text="No activity yet." />}
        </div>
      </div>
    </div>
  )
}

function Meta({ k, v, sub, danger }: { k: string; v: string; sub?: string; danger?: boolean }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className={`mt-0.5 ${danger ? 'text-flame' : 'text-white/80'}`}>{v}</div>
      {sub && <div className="text-[11px] text-white/30">{sub}</div>}
    </div>
  )
}
