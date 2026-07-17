import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowUp, CornerUpLeft, Lock, MessageSquarePlus, Send, ShieldCheck, User, X } from 'lucide-react'
import { useData } from '../lib/useData'
import { repo } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import { ESC_EVENT_LABEL, ESC_STATUS_LABEL, type EscStatus, type Profile } from '../lib/types'
import { Empty, Field } from './ui'

const STATUS_HEX: Record<EscStatus, string> = {
  with_manco: '#F5B942',
  returned_to_consultant: '#EE4823',
  with_sponsor: '#7F77DD',
  returned_to_manco: '#EE4823',
  resolution_submitted: '#4C93E8',
  outcome_to_consultant: '#19A06E',
  resolved: '#9FD150',
}

export function EscStatusPill({ status }: { status: EscStatus }) {
  const hex = STATUS_HEX[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}>
      {ESC_STATUS_LABEL[status]}
    </span>
  )
}

function dt(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type FormKind =
  | null | 'note'
  | 'esc_manco' | 'manco_decline' | 'manco_sponsor' | 'reescalate_manco'
  | 'sponsor_decline' | 'sponsor_resolve' | 'manco_return' | 'manco_responsor'

export default function EscalationDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const { escalations, escalationEvents, beneficiaries, people } = useData()
  const { user } = useAuth()
  const [form, setForm] = useState<FormKind>(null)
  // generic fields for the various forms
  const [a, setA] = useState('')   // reason / action / resolution
  const [b, setB] = useState('')   // way-forward / next-steps / context / notes
  const [target, setTarget] = useState('')  // chosen manco or sponsor id

  const e = escalations.find(x => x.id === id)
  const events = useMemo(
    () => escalationEvents.filter(v => v.escalation_id === id).sort((x, y) => y.at.localeCompare(x.at)),
    [escalationEvents, id])

  if (!e) return <Empty text="Escalation not found." />

  const name = (uid?: string | null) => people.find(p => p.id === uid)?.full_name ?? (uid ? 'Unknown' : 'System')
  const role = (uid?: string | null) => {
    const p = people.find(x => x.id === uid)
    return p ? `${p.role}${p.organisation ? ' · ' + p.organisation : ''}` : ''
  }
  const isOwner = e.current_owner_id === user?.id
  const isParticipant = e.participants.includes(user?.id ?? '')
  const locked = !isOwner && e.status !== 'resolved'

  const mancos = people.filter(p => (p.role === 'manco' || p.role === 'exco') && p.status !== 'deactivated')
  // sponsor recipients limited to this beneficiary's own programme
  const benRow = beneficiaries.find(bn => bn.id === e.beneficiary_id)
  const recipientIds = benRow?.recipient_ids ?? []
  const sponsorPool: Profile[] = people.filter(p => p.role === 'external' && recipientIds.includes(p.id))

  const reset = () => { setForm(null); setA(''); setB(''); setTarget('') }

  const submit = async () => {
    if (!user) return
    switch (form) {
      case 'note': await repo.addEscalationNote(id, user.id, a); break
      case 'manco_decline': await repo.mancoDecline(id, user.id, a, b); break
      case 'manco_sponsor': await repo.mancoEscalateSponsor(id, user.id, target, a, b); break
      case 'reescalate_manco': await repo.consultantReEscalate(id, user.id, target, a); break
      case 'sponsor_decline': await repo.sponsorDecline(id, user.id, a, b); break
      case 'sponsor_resolve': await repo.sponsorResolve(id, user.id, a, b); break
      case 'manco_return': await repo.mancoReturnToConsultant(id, user.id, a, b); break
      case 'manco_responsor': await repo.mancoReEscalateSponsor(id, user.id, target, a); break
    }
    reset()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg text-white">{e.beneficiary_name}</span>
            <EscStatusPill status={e.status} />
            {locked && <span className="inline-flex items-center gap-1 text-[11px] text-flame"><Lock size={12} /> Locked — {name(e.current_owner_id)} owns this</span>}
          </div>
          <div className="mt-0.5 text-xs text-white/40">{e.intervention_title} · {e.reason}</div>
        </div>
        {onClose && <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close"><X size={18} /></button>}
      </div>

      <div className="grid gap-3 rounded-xl bg-ink-800 p-4 text-sm md:grid-cols-2">
        <Meta k="Current owner" v={name(e.current_owner_id)} sub={role(e.current_owner_id)} icon={<User size={13} />} />
        <Meta k="Status" v={ESC_STATUS_LABEL[e.status]} />
        <Meta k="Raised by" v={name(e.consultant_id)} sub={dt(e.raised_at)} />
        <Meta k="Last action" v={dt(e.last_action_at)} />
        {e.context && <Meta k="Context" v={e.context} />}
        <Meta k="Action required" v={e.status === 'resolved' ? 'None — resolved' : `${name(e.current_owner_id)} to act`} danger={e.status !== 'resolved'} />
      </div>

      {/* Owner-only actions */}
      {isOwner && e.status !== 'resolved' && (
        <div className="flex flex-wrap gap-2">
          {e.current_owner_role === 'manco' && (e.status === 'with_manco') && (
            <>
              <button className="btn-primary" onClick={() => setForm('manco_sponsor')}><ArrowUp size={15} /> Escalate to Aggregator/Sponsor</button>
              <button className="btn-ghost" onClick={() => setForm('manco_decline')}><CornerUpLeft size={15} /> Decline & return to consultant</button>
            </>
          )}
          {e.current_owner_role === 'manco' && (e.status === 'returned_to_manco' || e.status === 'resolution_submitted') && (
            <>
              <button className="btn-primary" onClick={() => setForm('manco_return')}><CornerUpLeft size={15} /> Return outcome to consultant</button>
              <button className="btn-ghost" onClick={() => setForm('manco_responsor')}><ArrowUp size={15} /> Re-escalate to Aggregator/Sponsor</button>
            </>
          )}
          {e.current_owner_role === 'external' && e.status === 'with_sponsor' && (
            <>
              <button className="btn-primary" onClick={() => setForm('sponsor_resolve')}><ShieldCheck size={15} /> Submit resolution</button>
              <button className="btn-ghost" onClick={() => setForm('sponsor_decline')}><CornerUpLeft size={15} /> Decline & return to ManCo</button>
            </>
          )}
          {e.current_owner_role === 'consultant' && (e.status === 'returned_to_consultant' || e.status === 'outcome_to_consultant') && (
            <>
              <button className="btn-primary" onClick={() => repo.consultantAcceptReturn ? (e.status === 'returned_to_consultant' ? repo.consultantAcceptReturn(id, user!.id) : repo.consultantAcceptResume(id, user!.id)) : null}>
                <ShieldCheck size={15} /> {e.status === 'returned_to_consultant' ? 'Accept return' : 'Accept & resume'}
              </button>
              <button className="btn-ghost" onClick={() => setForm('reescalate_manco')}><ArrowUp size={15} /> Re-escalate to ManCo</button>
            </>
          )}
          <button className="btn-ghost" onClick={() => setForm('note')}><MessageSquarePlus size={15} /> Add note</button>
        </div>
      )}
      {locked && (
        <div className="rounded-xl border border-flame/40 bg-flame-soft px-4 py-3 text-sm text-flame">
          <Lock size={14} className="mr-1 inline" /> This escalation is locked to you — it's currently owned by {name(e.current_owner_id)} ({role(e.current_owner_id)}). You can view everything but only the owner can act.
          {isParticipant && <button className="ml-3 text-white/60 underline" onClick={() => setForm('note')}>Add a note</button>}
        </div>
      )}

      {/* action forms */}
      {form && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
          {(form === 'manco_sponsor' || form === 'manco_responsor') && (
            <Field label="Aggregator / Sponsor recipient">
              <select className="input" value={target} onChange={ev => setTarget(ev.target.value)}>
                <option value="">Select recipient</option>
                {sponsorPool.map(p => <option key={p.id} value={p.id}>{p.full_name} · {p.organisation ?? p.discipline}</option>)}
              </select>
            </Field>
          )}
          {form === 'reescalate_manco' && (
            <Field label="ManCo recipient">
              <select className="input" value={target} onChange={ev => setTarget(ev.target.value)}>
                <option value="">Select ManCo</option>
                {mancos.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
          )}
          <Field label={
            form === 'note' ? 'Note'
            : form === 'sponsor_resolve' ? 'Action taken'
            : form === 'manco_return' ? 'Resolution / outcome for the consultant'
            : 'Reason'
          }>
            <textarea className="input h-20 resize-none" value={a} onChange={ev => setA(ev.target.value)} />
          </Field>
          {(form === 'manco_decline' || form === 'sponsor_decline') && (
            <Field label="Suggested way forward (required)"><textarea className="input h-16 resize-none" value={b} onChange={ev => setB(ev.target.value)} /></Field>
          )}
          {form === 'manco_sponsor' && (
            <Field label="Expected action / input (required)"><textarea className="input h-16 resize-none" value={b} onChange={ev => setB(ev.target.value)} /></Field>
          )}
          {form === 'sponsor_resolve' && (
            <Field label="Proposed resolution (required)"><textarea className="input h-16 resize-none" value={b} onChange={ev => setB(ev.target.value)} /></Field>
          )}
          {form === 'manco_return' && (
            <Field label="Next steps for the consultant (required)"><textarea className="input h-16 resize-none" value={b} onChange={ev => setB(ev.target.value)} /></Field>
          )}
          {form === 'manco_responsor' && (
            <Field label="Additional context required (required)"><textarea className="input h-16 resize-none" value={b} onChange={ev => setB(ev.target.value)} /></Field>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={reset}>Cancel</button>
            <button className="btn-primary" disabled={!a.trim()
              || ((form === 'manco_sponsor' || form === 'manco_responsor' || form === 'reescalate_manco') && !target)
              || ((form === 'manco_decline' || form === 'sponsor_decline' || form === 'manco_sponsor' || form === 'sponsor_resolve' || form === 'manco_return' || form === 'manco_responsor') && !b.trim())}
              onClick={submit}>Submit</button>
          </div>
        </div>
      )}

      {/* audit history */}
      <div>
        <div className="label mb-3">Update history — immutable audit trail</div>
        <div className="space-y-3">
          {events.map(v => (
            <motion.div key={v.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full"
                style={{ background: v.to_status ? STATUS_HEX[v.to_status] : '#888780' }} />
              <div className="flex-1 border-b border-ink-600/60 pb-3">
                <div className="text-sm text-white/80">{ESC_EVENT_LABEL[v.kind]}</div>
                {v.text && <div className="mt-0.5 whitespace-pre-line text-[13px] text-white/55">{v.text}</div>}
                <div className="mt-1 text-[11px] text-white/30">
                  {dt(v.at)} · {name(v.user_id)}{v.user_id ? ` (${role(v.user_id)})` : ''}
                  {v.from_status && v.to_status && ` · ${ESC_STATUS_LABEL[v.from_status]} → ${ESC_STATUS_LABEL[v.to_status]}`}
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

function Meta({ k, v, sub, danger, icon }: { k: string; v: string; sub?: string; danger?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="label flex items-center gap-1">{icon}{k}</div>
      <div className={`mt-0.5 ${danger ? 'text-flame' : 'text-white/80'}`}>{v}</div>
      {sub && <div className="text-[11px] text-white/30">{sub}</div>}
    </div>
  )
}
