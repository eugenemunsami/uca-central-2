import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, Clock, CornerUpLeft, Download,
  FileText, FolderOpen, Link2, Mail, MapPin, Pencil, Phone, Plus, MessageSquare, ShieldCheck,
  StickyNote, Trash2, Unlink, Users,
} from 'lucide-react'
import { useData } from '../lib/useData'
import { repo } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import { RAG_HEX, RAG_LABEL } from '../lib/rag'
import { categoryTint } from '../lib/palette'
import { openEvidencePack } from '../lib/evidencePack'
import {
  BEN_EVENT_LABEL, LIFECYCLE_LABEL, STAGE_LABEL, STATUS_LABEL, companyKey,
  type Beneficiary, type BeneficiaryEvent, type BeneficiaryView, type Channel, type Director,
  type InterventionView, type IvStatus, type Profile, type Rag, type RagOverride, type WeeklyUpdate,
} from '../lib/types'
import { Empty, Field, Modal, RagPill, fmtDate, timeAgo } from '../components/ui'
import EscalationDetail, { EscStatusPill } from '../components/EscalationDetail'

const CHANNEL_ICON: Record<Channel, typeof Phone> = {
  call: Phone, email: Mail, meeting: Users, whatsapp: MessageSquare, site_visit: MapPin,
}

export default function BeneficiaryDetail() {
  const { id } = useParams()
  const { beneficiaries, interventions, updates, comms, escalations, overrides, benEvents, catalogue, people, loading } = useData()
  const { user, can } = useAuth()

  const b = beneficiaries.find(x => x.id === id)
  // A beneficiary can span several funding lines (one per sponsor/invoice). Consultants see the whole
  // company — every line's interventions together; ManCo/Exco see just this line, lines shown separately.
  const aggregate = !can('manage')
  const siblings = useMemo(
    () => (b ? beneficiaries.filter(x => companyKey(x) === companyKey(b)) : []),
    [beneficiaries, b])
  const siblingIds = useMemo(() => new Set(siblings.map(s => s.id)), [siblings])
  const ivs = useMemo(
    () => interventions.filter(i => aggregate ? siblingIds.has(i.beneficiary_id) : i.beneficiary_id === id),
    [interventions, id, aggregate, siblingIds])
  // Funder label per line, for tagging interventions when several lines are shown together.
  const funderOf = (benId: string) => {
    const s = siblings.find(x => x.id === benId)
    return s ? [s.invoice_number, s.sponsor_name ?? s.client_name].filter(Boolean).join(' · ') : null
  }
  const [selected, setSelected] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState('')
  const [addIv, setAddIv] = useState(false)
  const [logComm, setLogComm] = useState(false)
  const [logCommIv, setLogCommIv] = useState<string | null>(null)
  const [override, setOverride] = useState(false)
  const [escalate, setEscalate] = useState(false)
  const [editBen, setEditBen] = useState(false)
  const [escView, setEscView] = useState<string | null>(null)

  useEffect(() => { if (!selected && ivs.length) setSelected(ivs[0].id) }, [ivs, selected])

  if (loading) return <div className="text-white/40">Loading...</div>
  if (!b) return <Empty text="Beneficiary not found." />

  const iv = ivs.find(i => i.id === selected) ?? null
  const ivUpdates = updates.filter(u => u.intervention_id === selected)
    .sort((a, z) => z.created_at.localeCompare(a.created_at))
  const benComms = comms.filter(c => c.beneficiary_id === b.id)
    .sort((a, z) => z.occurred_at.localeCompare(a.occurred_at))
  const benOverrides = overrides.filter(o => o.beneficiary_id === b.id)
  const benLog = benEvents.filter(e => e.beneficiary_id === b.id)
  const mine = iv?.consultant_id === user?.id
  const ivTint = categoryTint(iv?.category)
  // A consultant may only *affect* an intervention they are assigned to; ManCo/Exco can act on anything.
  const canEditIv = can('manage') || mine
  // Beneficiary-level: a consultant may log comms only if they own at least one intervention here.
  const ownsAnyHere = ivs.some(i => i.consultant_id === user?.id)
  const canLogComms = can('manage') || ownsAnyHere
  const delayActive = Boolean(iv?.response_extended_until && new Date(iv.response_extended_until) > new Date())
  // Escalations are now per-intervention (ownership baton). Active = not yet resolved.
  const ivEsc = iv ? escalations.find(e => e.intervention_id === iv.id && e.status !== 'resolved') ?? null : null
  const ivContactCount = iv ? comms.filter(c => c.intervention_id === iv.id).length : 0

  // Merged history timeline: this intervention's weekly updates + beneficiary RAG overrides + activity log.
  type Entry =
    | { kind: 'update'; date: string; u: WeeklyUpdate }
    | { kind: 'override'; date: string; o: RagOverride }
    | { kind: 'event'; date: string; e: BeneficiaryEvent }
  const timeline: Entry[] = [
    ...ivUpdates.map(u => ({ kind: 'update' as const, date: u.created_at, u })),
    ...benOverrides.map(o => ({ kind: 'override' as const, date: o.effective_date, o })),
    ...benLog.map(e => ({ kind: 'event' as const, date: e.at, e })),
  ].sort((a, z) => z.date.localeCompare(a.date))

  return (
    <div className="space-y-6">
      <Link to="/beneficiaries" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white">
        <ArrowLeft size={15} /> Beneficiaries
      </Link>

      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl text-white">{b.name}</h1>
              <RagPill rag={b.rag} reason={b.escalation_reason ?? b.rag_override_reason} />
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/60">
                {LIFECYCLE_LABEL[b.lifecycle]}
              </span>
              {b.needs_onsite && (
                <span className="rounded-full bg-jade/15 px-2 py-1 text-[10px] uppercase tracking-wider text-jade">
                  On-site required
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-white/40">
              {b.client_name}{b.sponsor_name ? ` · ${b.sponsor_name}` : ''}
              {b.industry ? ` · ${b.industry}` : ''} · {STAGE_LABEL[b.stage]}
            </p>
          </div>
          <div className="flex gap-2">
            {canLogComms && (
              <button className="btn-ghost" onClick={() => { setLogCommIv(null); setLogComm(true) }}>
                <Phone size={15} /> Log communication
              </button>
            )}
            {can('manage') && (
              <>
                <button className="btn-ghost" onClick={() => setEditBen(true)}>
                  <Pencil size={15} /> Edit
                </button>
                <button className="btn-ghost" onClick={() => setOverride(true)}>Override RAG</button>
                <button className="btn-primary" onClick={() => setAddIv(true)}>
                  <Plus size={15} /> Add intervention
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm md:grid-cols-4">
          <div>
            <div className="label">Contact</div>
            <div className="mt-1 text-white/80">{b.contact_person ?? '-'}</div>
            {b.contact_email && (
              <a href={`mailto:${b.contact_email}`} className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white">
                <Mail size={11} /> {b.contact_email}
              </a>
            )}
            {b.contact_phone && (
              <a href={`tel:${b.contact_phone}`} className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white">
                <Phone size={11} /> {b.contact_phone}
              </a>
            )}
          </div>
          <Meta label="Industry" value={b.industry ?? '-'} sub={`SOW signed ${fmtDate(b.sow_signed_date)}`} />
          <Meta label="Last engagement" value={timeAgo(b.last_engagement_at)} sub={b.outstanding_items ?? undefined} />
          <Meta label="Expected completion" value={fmtDate(b.expected_completion)}
            sub={`${b.completed_count}/${b.intervention_count} interventions closed`} />
          <div>
            <div className="label">Google Drive</div>
            {b.drive_folder_url ? (
              <a href={b.drive_folder_url} target="_blank" rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-lime hover:text-white">
                <FolderOpen size={13} /> Open folder
              </a>
            ) : (
              <div className="mt-1 text-white/40">{can('manage') ? 'Not linked — add via Edit' : 'Not linked yet'}</div>
            )}
            <div className="mt-0.5 text-[11px] text-white/30">Shared with consultants</div>
          </div>
        </div>

        {b.directors && b.directors.length > 0 && (
          <div className="mt-5">
            <div className="label mb-2 flex items-center gap-1.5"><Users size={12} /> Directors</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {b.directors.map((d, i) => (
                <div key={i} className="rounded-lg bg-ink-800 px-3 py-2">
                  <div className="text-sm text-white/80">{d.name}</div>
                  {d.email && (
                    <a href={`mailto:${d.email}`} className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white">
                      <Mail size={10} /> {d.email}
                    </a>
                  )}
                  {d.phone && (
                    <a href={`tel:${d.phone}`} className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white">
                      <Phone size={10} /> {d.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </header>

      {(siblings.length > 1 || can('manage')) && (
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="label">Funding lines{siblings.length > 1 ? ` · ${siblings.length}` : ''}</div>
            {can('manage') && (
              <button className="btn-ghost text-xs" onClick={() => { setLinkTarget(''); setLinkOpen(true) }}>
                <Link2 size={13} /> Link to another beneficiary
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-white/35">
            Each line is one sponsor / invoice. Consultants see every line together as one beneficiary; funders see them separately.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {siblings.map(s => {
              const here = s.id === b.id
              return (
                <div key={s.id} className={`rounded-xl border p-3 ${here ? 'border-lime/40 bg-lime/5' : 'border-ink-600'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm text-white/90">{s.name}{here ? ' · this line' : ''}</div>
                      <div className="mt-0.5 text-[11px] text-white/40">
                        {[s.sponsor_name ?? s.client_name, s.invoice_number].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <RagPill rag={s.rag} reason={s.escalation_reason} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
                    {s.budget != null && <span>Budget · R{Number(s.budget).toLocaleString()}</span>}
                    <span>SOW · {s.sow_signed_date ? fmtDate(s.sow_signed_date) : '—'}</span>
                    <span>{STAGE_LABEL[s.stage]}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {!here && <Link to={`/beneficiaries/${s.id}`} className="btn-ghost px-2 py-1 text-[11px]">Open line</Link>}
                    {can('manage') && companyKey(s) !== s.id && (
                      <button className="btn-ghost px-2 py-1 text-[11px]"
                        onClick={() => repo.linkBeneficiary(s.id, null, user?.id ?? null)}>
                        <Unlink size={12} /> Split out
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Link to another beneficiary">
        <p className="mb-4 text-sm text-white/50">
          Fold <span className="text-white/80">{b.name}</span>{b.invoice_number ? ` (${b.invoice_number})` : ''} into another
          beneficiary so both become funding lines of one company. Consultants will see a single card; funders keep separate lines.
        </p>
        <Field label="Existing beneficiary">
          <select className="input" value={linkTarget} onChange={e => setLinkTarget(e.target.value)}>
            <option value="">Select a beneficiary…</option>
            {beneficiaries
              .filter(x => companyKey(x) === x.id && companyKey(x) !== companyKey(b) && x.lifecycle !== 'archived')
              .sort((a, z) => a.name.localeCompare(z.name))
              .map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.sponsor_name ? ` — ${t.sponsor_name}` : ''}{t.invoice_number ? ` (${t.invoice_number})` : ''}
                </option>
              ))}
          </select>
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setLinkOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={!linkTarget}
            onClick={() => {
              const t = beneficiaries.find(x => x.id === linkTarget)
              if (t) repo.linkBeneficiary(b.id, companyKey(t), user?.id ?? null)
              setLinkOpen(false)
            }}>Link beneficiary</button>
        </div>
      </Modal>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          <div className="label">Interventions</div>
          {ivs.map(i => {
            const tint = categoryTint(i.category)
            const isSel = selected === i.id
            return (
              <button key={i.id} onClick={() => setSelected(i.id)}
                style={{ background: isSel ? tint.bgActive : tint.bg, borderLeft: `3px solid ${tint.border}` }}
                className={`card w-full p-4 text-left transition-all ${isSel ? 'ring-2 ring-lime/40' : 'card-hover'} ${i.cancelled ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className={`text-sm text-white ${i.cancelled ? 'line-through' : ''}`}>{i.title}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: tint.text }}>
                      {i.category}{i.cancelled ? ' · cancelled' : ''}
                    </div>
                    {aggregate && siblings.length > 1 && funderOf(i.beneficiary_id) && (
                      <div className="mt-1 inline-block rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] text-white/50">
                        {funderOf(i.beneficiary_id)}
                      </div>
                    )}
                  </div>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RAG_HEX[i.rag] }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
                  <span>{i.consultant_name ?? 'Unassigned'}</span>
                  <span>{i.due_date ? `due ${fmtDate(i.due_date)}` : 'no due date'}</span>
                </div>
                {i.rag_reason && !i.cancelled && (
                  <div className="mt-2 text-[11px]" style={{ color: RAG_HEX[i.rag] }}>{i.rag_reason}</div>
                )}
              </button>
            )
          })}
          {ivs.length === 0 && <Empty text="No interventions scoped yet." />}
        </div>

        {iv ? (
          <div className="space-y-6">
            <div className="card overflow-hidden p-0" style={{ borderTop: `3px solid ${ivTint.border}` }}>
              <div className="p-6" style={{ background: ivTint.bg }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className={`text-lg text-white ${iv.cancelled ? 'line-through opacity-60' : ''}`}>{iv.title}</h2>
                    <p className="mt-1 text-sm" style={{ color: ivTint.text }}>
                      {iv.category}
                      <span className="text-white/40"> · {iv.consultant_name ?? 'unassigned'}
                        {iv.custom_budget ? ` · R${iv.custom_budget.toLocaleString('en-ZA')}` : ''}</span>
                    </p>
                  </div>
                  <RagPill rag={iv.rag} reason={iv.rag_reason} />
                </div>
              </div>

              <div className="p-6 pt-4">
              {iv.cancelled ? (
                <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-4 py-3 text-sm text-white/40">
                  <Ban size={15} /> This intervention was cancelled — kept for records only.
                </div>
              ) : (
                <>
                  {iv.days_awaiting !== null && iv.status !== 'completed' && (
                    <div className="mt-1 flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 text-xs text-white/50">
                      <Clock size={14} style={{ color: iv.days_awaiting >= 3 ? RAG_HEX.red : RAG_HEX.amber }} />
                      Response clock: {iv.days_awaiting} of 3 working days used
                      {iv.days_awaiting >= 3
                        ? ' — breached, escalate to client'
                        : ` — red in ${3 - iv.days_awaiting} day${3 - iv.days_awaiting === 1 ? '' : 's'}`}
                    </div>
                  )}

                  {delayActive && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-amberx/10 px-3 py-2 text-xs text-amberx">
                      <CalendarClock size={14} /> Allowable delay until {fmtDate(iv.response_extended_until)} — red clock paused.
                    </div>
                  )}

                  {iv.status !== 'completed' && (can('manage') || mine) && (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <Field label="Status">
                        <select className="input" value={iv.status}
                          onChange={e => {
                            const status = e.target.value as IvStatus
                            repo.updateIntervention(iv.id, {
                              status,
                              awaiting_response_since: status === 'awaiting_beneficiary'
                                ? (iv.awaiting_response_since ?? new Date().toISOString())
                                : null,
                            })
                          }}>
                          {Object.entries(STATUS_LABEL)
                            .filter(([v]) => v !== 'completed')
                            .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </Field>
                      <Field label="Consultant">
                        <select className="input" value={iv.consultant_id ?? ''}
                          disabled={!can('manage')}
                          onChange={e => repo.updateIntervention(iv.id, { consultant_id: e.target.value || null })}>
                          <option value="">Unassigned</option>
                          {people.filter(p => p.role === 'consultant' || p.role === 'manco')
                            .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                        </select>
                      </Field>
                      <Field label="Due date">
                        <input className="input" type="date" value={iv.due_date ?? ''}
                          onChange={e => repo.updateIntervention(iv.id, { due_date: e.target.value || null })} />
                      </Field>
                      {(iv.status === 'on_hold' || iv.status === 'awaiting_beneficiary') && (
                        <div className="md:col-span-3">
                          <Field label="Reason (shown to Exco and the client)">
                            <input className="input" defaultValue={iv.hold_reason ?? ''}
                              placeholder="Why is this on hold?"
                              onBlur={e => repo.updateIntervention(iv.id, { hold_reason: e.target.value })} />
                          </Field>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- Close-out approval workflow ---- */}
                  <div className="mt-4">
                    <CloseoutPanel iv={iv} userId={user?.id ?? null}
                      canManage={can('manage')} canRequest={canEditIv} people={people} />
                  </div>

                  {/* ---- Escalation (per-intervention ownership baton) ---- */}
                  <div className="mt-4">
                    {ivEsc ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-flame-soft px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <EscStatusPill status={ivEsc.status} />
                          <span className="text-white/60">owned by {ivEsc.owner_name ?? 'unassigned'}</span>
                        </div>
                        <button className="btn-ghost" onClick={() => setEscView(ivEsc.id)}>
                          <AlertTriangle size={15} /> View / act on escalation
                        </button>
                      </div>
                    ) : (canEditIv && iv.status !== 'completed' && (
                      <div className="rounded-lg bg-ink-800 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="btn-ghost" onClick={() => { setLogCommIv(iv.id); setLogComm(true) }}>
                            <Phone size={15} /> Log contact attempt
                          </button>
                          <button className="btn-danger" onClick={() => setEscalate(true)}>
                            <AlertTriangle size={15} /> Escalate
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-white/40">
                          Tip: log 2 contact attempts before escalating — {ivContactCount} logged on this intervention so far.
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {iv.poe_url && iv.status !== 'completed' && iv.closeout_status !== 'confirmed' && (
                      <a className="btn-ghost" href={iv.poe_url} target="_blank" rel="noreferrer">
                        <FileText size={15} /> POE
                      </a>
                    )}
                    {iv.status !== 'completed' && iv.closeout_status !== 'confirmed' && canEditIv && (
                      <DelayControl iv={iv} userId={user?.id ?? null} />
                    )}
                    {can('manage') && iv.status !== 'completed' && (
                      <button className="btn-ghost ml-auto text-white/40 hover:text-flame"
                        onClick={() => {
                          if (window.confirm('Cancel this intervention? It is kept for records but marked cancelled and no further actions will be offered.'))
                            repo.cancelIntervention(iv.id, user?.id ?? null)
                        }}>
                        <Ban size={15} /> Cancel intervention
                      </button>
                    )}
                  </div>
                </>
              )}
              </div>
            </div>

            <UpdatePanel interventionId={iv.id} authorId={user?.id ?? null} canWrite={canEditIv && !iv.cancelled} />

            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="label">Update &amp; activity history</div>
                <button className="btn-ghost"
                  onClick={() => openEvidencePack(b, ivs, updates, benComms, people)}>
                  <Download size={15} /> Extract evidence pack (PDF)
                </button>
              </div>
              {can('internal') && <NoteBar benId={b.id} userId={user?.id ?? null} />}
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {timeline.map(entry => {
                    if (entry.kind === 'update') return (
                      <motion.div key={`u-${entry.u.id}`} layout
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="border-l-2 border-jade pl-4">
                        <div className="mb-1 flex items-center gap-2 text-[11px] text-white/35">
                          <span>{new Date(entry.u.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
                          <span>·</span>
                          <span>{people.find(p => p.id === entry.u.author_id)?.full_name ?? 'UCA'}</span>
                        </div>
                        <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                          <Line k="Completed" v={entry.u.completed_work} />
                          <Line k="In progress" v={entry.u.in_progress} />
                          <Line k="Blocker" v={entry.u.blocker} danger />
                          <Line k="Blocker owner" v={entry.u.blocker_owner} />
                          <Line k="Next action" v={entry.u.next_action} />
                          <Line k="Next update" v={entry.u.next_update_due ? fmtDate(entry.u.next_update_due) : null} />
                        </dl>
                      </motion.div>
                    )
                    if (entry.kind === 'override') return (
                      <motion.div key={`o-${entry.o.id}`} layout
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="pl-4" style={{ borderLeft: `2px solid ${RAG_HEX[entry.o.rag]}` }}>
                        <div className="mb-1 flex items-center gap-2 text-[11px] text-white/35">
                          <span>{fmtDate(entry.o.effective_date)}</span>
                          <span>·</span>
                          <span>{people.find(p => p.id === entry.o.logged_by)?.full_name ?? 'UCA'}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-white/50">RAG override → </span>
                          <span style={{ color: RAG_HEX[entry.o.rag] }}>{RAG_LABEL[entry.o.rag]}</span>
                          <span className="text-white/70">: {entry.o.reason}</span>
                        </div>
                      </motion.div>
                    )
                    return (
                      <motion.div key={`e-${entry.e.id}`} layout
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="border-l-2 border-white/15 pl-4">
                        <div className="mb-1 flex items-center gap-2 text-[11px] text-white/35">
                          <span>{new Date(entry.e.at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
                          <span>·</span>
                          <span>{people.find(p => p.id === entry.e.user_id)?.full_name ?? 'System'}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-white/50">{BEN_EVENT_LABEL[entry.e.kind]}</span>
                          {entry.e.text && <span className="text-white/70"> — {entry.e.text}</span>}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {timeline.length === 0 && <Empty text="No updates or activity logged yet." />}
              </div>
            </div>
          </div>
        ) : <Empty text="Select an intervention." />}
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="label">Communication log — the evidence trail</div>
          {canLogComms && (
            <button className="btn-ghost" onClick={() => setLogComm(true)}><Plus size={15} /> Log</button>
          )}
        </div>
        <div className="space-y-2">
          {benComms.map(c => {
            const Icon = CHANNEL_ICON[c.channel]
            return (
              <div key={c.id} className="flex items-start gap-3 rounded-lg bg-ink-800 px-4 py-3">
                <Icon size={15} className="mt-0.5 shrink-0 text-lime" />
                <div className="flex-1">
                  <div className="text-sm text-white/80">{c.context}</div>
                  <div className="mt-1 text-[11px] text-white/30">
                    {new Date(c.occurred_at).toLocaleString('en-ZA', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                    {' · '}{people.find(p => p.id === c.author_id)?.full_name ?? 'UCA'}
                    {c.channel !== 'email' && c.followed_up_by_email && (
                      <span className="ml-2 text-jade">followed up in writing</span>
                    )}
                    {c.channel === 'call' && !c.followed_up_by_email && (
                      <span className="ml-2 text-amberx">no follow-up email logged</span>
                    )}
                  </div>
                  {c.email_text && (
                    <div className="mt-2 whitespace-pre-wrap rounded-md bg-ink-900/60 px-3 py-2 text-[11px] text-white/50">
                      <div className="mb-1 flex items-center gap-1.5 text-white/30"><Mail size={10} /> Written follow-up</div>
                      {c.email_text}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {benComms.length === 0 && <Empty text="No communications logged." />}
        </div>
      </div>

      <AddIntervention open={addIv} onClose={() => setAddIv(false)} beneficiaryId={b.id}
        catalogue={catalogue} people={people} />
      <LogComm open={logComm} onClose={() => setLogComm(false)} beneficiaryId={b.id}
        interventions={(can('manage') ? ivs : ivs.filter(i => i.consultant_id === user?.id))
          .map(i => ({ id: i.id, title: i.title }))} authorId={user?.id ?? null}
        defaultInterventionId={logCommIv} />
      <Modal open={override} onClose={() => setOverride(false)} title="Override RAG status">
        <OverrideForm beneficiaryId={b.id} current={b.rag} loggedBy={user?.id ?? null} onDone={() => setOverride(false)} />
      </Modal>
      <Modal open={editBen} onClose={() => setEditBen(false)} title="Edit beneficiary" wide>
        <EditBeneficiary b={b} people={people} userId={user?.id ?? null} onDone={() => setEditBen(false)} />
      </Modal>
      <Modal open={Boolean(escView)} onClose={() => setEscView(null)} title="Escalation" wide>
        {escView && <EscalationDetail id={escView} onClose={() => setEscView(null)} />}
      </Modal>
      <Modal open={escalate} onClose={() => setEscalate(false)} title="Escalate to ManCo">
        {iv && (
          <EscalateForm interventionId={iv.id} beneficiaryId={b.id} consultantId={user?.id ?? null}
            mancos={people.filter(p => p.role === 'manco' || p.role === 'exco')}
            onDone={() => setEscalate(false)} />
        )}
      </Modal>
    </div>
  )
}

function Meta({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 text-white/80">{value ?? '-'}</div>
      {sub && <div className="text-[11px] text-white/30">{sub}</div>}
    </div>
  )
}

function Line({ k, v, danger }: { k: string; v?: string | null; danger?: boolean }) {
  if (!v) return null
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-white/30">{k}</dt>
      <dd className={danger ? 'text-flame' : 'text-white/70'}>{v}</dd>
    </div>
  )
}

// ---- Intervention close-out: request -> ManCo verify/return -> completed ----
function CloseoutPanel({ iv, userId, canManage, canRequest, people }: {
  iv: InterventionView; userId: string | null; canManage: boolean; canRequest: boolean; people: Profile[]
}) {
  const [form, setForm] = useState(false)
  const [subUrl, setSubUrl] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailText, setEmailText] = useState('')
  const [returning, setReturning] = useState(false)
  const [returnReason, setReturnReason] = useState('')

  const completed = iv.closeout_status === 'confirmed' || iv.status === 'completed'

  if (completed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-jade/10 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-jade">
          <CheckCircle2 size={15} /> Completed
          {iv.closeout_confirmed_by && (
            <span className="text-[11px] text-white/40">
              · confirmed by {people.find(p => p.id === iv.closeout_confirmed_by)?.full_name ?? 'ManCo'} {timeAgo(iv.closeout_confirmed_at ?? iv.completed_at)}
            </span>
          )}
        </span>
        <span className="flex gap-2">
          {iv.closeout_subfolder_url && (
            <a className="btn-ghost" href={iv.closeout_subfolder_url} target="_blank" rel="noreferrer">
              <FolderOpen size={15} /> Outputs
            </a>
          )}
          {iv.poe_url && (
            <a className="btn-ghost" href={iv.poe_url} target="_blank" rel="noreferrer">
              <FileText size={15} /> POE
            </a>
          )}
        </span>
      </div>
    )
  }

  if (iv.closeout_status === 'requested') {
    return (
      <div className="space-y-3 rounded-lg bg-amberx/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-amberx">
            <Clock size={15} /> Close-out requested — awaiting ManCo verification
            <span className="text-[11px] text-white/40">
              · by {people.find(p => p.id === iv.closeout_requested_by)?.full_name ?? 'UCA'} {timeAgo(iv.closeout_requested_at)}
            </span>
          </span>
          {canManage && (
            <span className="flex gap-2">
              <button className="btn-primary" onClick={() => repo.confirmCloseout(iv.id, userId)}>
                <ShieldCheck size={15} /> Verify &amp; confirm
              </button>
              <button className="btn-ghost" onClick={() => setReturning(v => !v)}>
                <CornerUpLeft size={15} /> Return
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          {iv.closeout_subfolder_url ? (
            <a className="flex items-center gap-1.5 text-lime hover:text-white"
              href={iv.closeout_subfolder_url} target="_blank" rel="noreferrer">
              <FolderOpen size={12} /> Drive subfolder
            </a>
          ) : <span className="text-white/30">No subfolder linked</span>}
          {iv.closeout_email_sent && (
            <span className="flex items-center gap-1.5 text-jade"><Mail size={12} /> email sent ✓</span>
          )}
        </div>
        {iv.closeout_email_text && (
          <div className="whitespace-pre-wrap rounded-md bg-ink-900/60 px-3 py-2 text-[11px] text-white/50">
            <div className="mb-1 flex items-center gap-1.5 text-white/30"><Mail size={10} /> Close-out email</div>
            {iv.closeout_email_text}
          </div>
        )}
        {canManage && returning && (
          <div className="rounded-md bg-ink-800 p-3">
            <Field label="Reason for returning" hint="Sent to the consultant so they can fix and resubmit.">
              <textarea className="input h-16 resize-none" value={returnReason}
                onChange={e => setReturnReason(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setReturning(false); setReturnReason('') }}>Cancel</button>
              <button className="btn-danger" disabled={!returnReason}
                onClick={async () => {
                  await repo.returnCloseout(iv.id, userId, returnReason)
                  setReturning(false); setReturnReason('')
                }}>
                Return to consultant
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // closeout_status === 'none'
  if (!canRequest) return null
  if (!form) {
    return (
      <button className="btn-ghost" onClick={() => setForm(true)}>
        <CheckCircle2 size={15} /> Request close-out
      </button>
    )
  }
  return (
    <div className="rounded-lg bg-ink-800 p-4">
      <div className="label mb-3">Request close-out</div>
      <Field label="Drive subfolder link" hint="Where this intervention's outputs live. Required.">
        <input className="input" placeholder="https://drive.google.com/…" value={subUrl}
          onChange={e => setSubUrl(e.target.value)} />
      </Field>
      <label className="mb-3 flex items-center gap-2 text-sm text-white/60">
        <input type="checkbox" checked={emailSent} onChange={e => setEmailSent(e.target.checked)} />
        I've sent the close-out email to the beneficiary
      </label>
      <Field label="Paste the close-out email (optional)" hint="Stored as part of the evidence trail.">
        <textarea className="input h-24 resize-none" value={emailText}
          onChange={e => setEmailText(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => setForm(false)}>Cancel</button>
        <button className="btn-primary" disabled={!subUrl || !emailSent}
          onClick={async () => {
            await repo.requestCloseout(iv.id, userId, {
              subfolder_url: subUrl, email_sent: emailSent, email_text: emailText || null,
            })
            setForm(false); setSubUrl(''); setEmailSent(false); setEmailText('')
          }}>
          Submit for verification
        </button>
      </div>
    </div>
  )
}

// ---- Allowable delay: pause the red clock until a date ----
function DelayControl({ iv, userId }: { iv: InterventionView; userId: string | null }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  if (!open) {
    return (
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <CalendarClock size={15} /> Grant delay
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <button className="btn-primary" disabled={!date}
        onClick={async () => { await repo.grantDelay(iv.id, userId, date); setOpen(false); setDate('') }}>
        Grant
      </button>
      <button className="btn-ghost" onClick={() => { setOpen(false); setDate('') }}>Cancel</button>
    </div>
  )
}

// ---- Add an internal note to the beneficiary activity log ----
function NoteBar({ benId, userId }: { benId: string; userId: string | null }) {
  const [text, setText] = useState('')
  return (
    <div className="mb-4 flex gap-2">
      <input className="input flex-1" placeholder="Add an internal note to the activity log…"
        value={text} onChange={e => setText(e.target.value)} />
      <button className="btn-ghost" disabled={!text.trim()}
        onClick={async () => { await repo.addBenNote(benId, userId, text.trim()); setText('') }}>
        <StickyNote size={15} /> Add note
      </button>
    </div>
  )
}

function UpdatePanel({ interventionId, authorId, canWrite }: {
  interventionId: string; authorId: string | null; canWrite: boolean
}) {
  const blank = {
    completed_work: '', in_progress: '', blocker: '', blocker_owner: '',
    next_action: '', next_update_due: '',
  }
  const [f, setF] = useState(blank)
  if (!canWrite) return (
    <div className="card p-6 text-sm text-white/40">
      Only the assigned consultant or a ManCo can post updates on this intervention.
    </div>
  )

  return (
    <div className="card p-6">
      <div className="label mb-4">Log this week's update — the six Huddle questions</div>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Field label="What did you complete?">
          <textarea className="input h-20 resize-none" value={f.completed_work}
            onChange={e => setF({ ...f, completed_work: e.target.value })} />
        </Field>
        <Field label="What is happening now?">
          <textarea className="input h-20 resize-none" value={f.in_progress}
            onChange={e => setF({ ...f, in_progress: e.target.value })} />
        </Field>
        <Field label="What is blocking progress?">
          <input className="input" value={f.blocker} onChange={e => setF({ ...f, blocker: e.target.value })} />
        </Field>
        <Field label="Who owns the blocker?">
          <select className="input" value={f.blocker_owner} onChange={e => setF({ ...f, blocker_owner: e.target.value })}>
            <option value="">No blocker</option>
            <option>Beneficiary</option>
            <option>UCA</option>
            <option>Client</option>
            <option>Third party</option>
          </select>
        </Field>
        <Field label="Next action">
          <input className="input" value={f.next_action} onChange={e => setF({ ...f, next_action: e.target.value })} />
        </Field>
        <Field label="When is the next update?">
          <input className="input" type="date" value={f.next_update_due}
            onChange={e => setF({ ...f, next_update_due: e.target.value })} />
        </Field>
      </div>
      <button className="btn-primary" disabled={!f.completed_work && !f.in_progress}
        onClick={async () => {
          await repo.addWeeklyUpdate({
            intervention_id: interventionId, author_id: authorId,
            completed_work: f.completed_work || null, in_progress: f.in_progress || null,
            blocker: f.blocker || null, blocker_owner: f.blocker_owner || null,
            next_action: f.next_action || null, next_update_due: f.next_update_due || null,
          })
          setF(blank)
        }}>
        Post update
      </button>
    </div>
  )
}

type DirectorRow = { name: string; email: string; phone: string }

function EditBeneficiary({ b, people, userId, onDone }: {
  b: BeneficiaryView; people: Profile[]; userId: string | null; onDone: () => void
}) {
  const [f, setF] = useState({
    contact_person: b.contact_person ?? '',
    contact_email: b.contact_email ?? '',
    contact_phone: b.contact_phone ?? '',
    industry: b.industry ?? '',
    project_manager_id: b.project_manager_id ?? '',
    expected_completion: b.expected_completion ?? '',
    needs_onsite: b.needs_onsite,
    drive_folder_url: b.drive_folder_url ?? '',
  })
  const [directors, setDirectors] = useState<DirectorRow[]>(
    b.directors.length
      ? b.directors.map(d => ({ name: d.name, email: d.email ?? '', phone: d.phone ?? '' }))
      : [{ name: '', email: '', phone: '' }])

  return (
    <>
      <div className="grid gap-x-4 md:grid-cols-3">
        <Field label="Contact person">
          <input className="input" value={f.contact_person}
            onChange={e => setF({ ...f, contact_person: e.target.value })} />
        </Field>
        <Field label="Contact email">
          <input className="input" value={f.contact_email}
            onChange={e => setF({ ...f, contact_email: e.target.value })} />
        </Field>
        <Field label="Contact phone">
          <input className="input" value={f.contact_phone}
            onChange={e => setF({ ...f, contact_phone: e.target.value })} />
        </Field>
      </div>

      <Field label="Industry">
        <input className="input" value={f.industry}
          onChange={e => setF({ ...f, industry: e.target.value })} />
      </Field>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">Directors</span>
          <button className="btn-ghost text-xs" onClick={() => setDirectors([...directors, { name: '', email: '', phone: '' }])}>
            <Plus size={13} /> Add director
          </button>
        </div>
        <div className="space-y-2">
          {directors.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" placeholder="Name" value={d.name}
                onChange={e => setDirectors(directors.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <input className="input flex-1" placeholder="Email" value={d.email}
                onChange={e => setDirectors(directors.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
              <input className="input flex-1" placeholder="Phone" value={d.phone}
                onChange={e => setDirectors(directors.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
              <button className="btn-ghost px-2" aria-label="Remove director"
                disabled={directors.length === 1}
                onClick={() => setDirectors(directors.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-x-4 md:grid-cols-2">
        <Field label="Project manager">
          <select className="input" value={f.project_manager_id}
            onChange={e => setF({ ...f, project_manager_id: e.target.value })}>
            <option value="">Unassigned</option>
            {people.filter(p => p.role === 'manco' || p.role === 'exco')
              .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Expected completion">
          <input className="input" type="date" value={f.expected_completion}
            onChange={e => setF({ ...f, expected_completion: e.target.value })} />
        </Field>
      </div>

      <Field label="Google Drive folder link" hint="Shared with the consultants working this beneficiary.">
        <input className="input" placeholder="https://drive.google.com/…" value={f.drive_folder_url}
          onChange={e => setF({ ...f, drive_folder_url: e.target.value })} />
      </Field>

      <label className="mb-5 flex items-center gap-2 text-sm text-white/60">
        <input type="checkbox" checked={f.needs_onsite}
          onChange={e => setF({ ...f, needs_onsite: e.target.checked })} />
        Local or non-tech-savvy — flag for on-site visits
      </label>

      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary"
          onClick={async () => {
            const cleanDirectors: Director[] = directors
              .filter(d => d.name.trim())
              .map(d => ({ name: d.name.trim(), email: d.email.trim() || null, phone: d.phone.trim() || null }))
            const patch: Partial<Beneficiary> = {
              contact_person: f.contact_person || null,
              contact_email: f.contact_email || null,
              contact_phone: f.contact_phone || null,
              industry: f.industry || null,
              directors: cleanDirectors,
              project_manager_id: f.project_manager_id || null,
              expected_completion: f.expected_completion || null,
              needs_onsite: f.needs_onsite,
              drive_folder_url: f.drive_folder_url || null,
            }
            await repo.updateBeneficiary(b.id, patch, userId)
            onDone()
          }}>
          Save changes
        </button>
      </div>
    </>
  )
}

function AddIntervention({ open, onClose, beneficiaryId, catalogue, people }: {
  open: boolean; onClose: () => void; beneficiaryId: string
  catalogue: { id: string; name: string; category: string; default_owner_id?: string | null; active: boolean }[]
  people: { id: string; full_name: string; role: string }[]
}) {
  const [tab, setTab] = useState<'standard' | 'custom'>('standard')
  const [catId, setCatId] = useState('')
  const [consultant, setConsultant] = useState('')
  const [due, setDue] = useState('')
  const [custom, setCustom] = useState({ name: '', kind: 'capex', budget: '', motivation: '' })

  const grouped = useMemo(() => {
    const m = new Map<string, typeof catalogue>()
    catalogue.filter(c => c.active).forEach(c => {
      m.set(c.category, [...(m.get(c.category) ?? []), c])
    })
    return Array.from(m.entries())
  }, [catalogue])

  useEffect(() => {
    const item = catalogue.find(c => c.id === catId)
    if (item?.default_owner_id) setConsultant(item.default_owner_id)
  }, [catId, catalogue])

  return (
    <Modal open={open} onClose={onClose} title="Add an intervention" wide>
      <div className="mb-5 flex gap-1 rounded-lg bg-ink-800 p-1">
        {(['standard', 'custom'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
              tab === t ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
            {t === 'standard' ? 'Standard catalogue' : 'Custom intervention'}
          </button>
        ))}
      </div>

      {tab === 'standard' ? (
        <Field label="Service">
          <select className="input" value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">Select a service</option>
            {grouped.map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label="What is it?" hint="Used when a sponsor allocates budget outside the standard scope of works.">
            <input className="input" placeholder="e.g. POS hardware + till system"
              value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} />
          </Field>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Field label="Type">
              <select className="input" value={custom.kind} onChange={e => setCustom({ ...custom, kind: e.target.value })}>
                <option value="capex">Capex</option>
                <option value="opex">Opex</option>
                <option value="other">Other solution</option>
              </select>
            </Field>
            <Field label="Budget (ZAR)">
              <input className="input" type="number" value={custom.budget}
                onChange={e => setCustom({ ...custom, budget: e.target.value })} />
            </Field>
          </div>
          <Field label="Motivation">
            <textarea className="input h-20 resize-none" value={custom.motivation}
              onChange={e => setCustom({ ...custom, motivation: e.target.value })} />
          </Field>
        </>
      )}

      <div className="grid gap-x-4 md:grid-cols-2">
        <Field label="Consultant" hint="Pre-filled from the catalogue's default owner.">
          <select className="input" value={consultant} onChange={e => setConsultant(e.target.value)}>
            <option value="">Unassigned</option>
            {people.filter(p => p.role === 'consultant' || p.role === 'manco')
              .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary"
          disabled={tab === 'standard' ? !catId : !custom.name}
          onClick={async () => {
            await repo.addIntervention({
              beneficiary_id: beneficiaryId,
              kind: tab,
              catalogue_id: tab === 'standard' ? catId : null,
              custom_name: tab === 'custom' ? custom.name : null,
              custom_kind: tab === 'custom' ? (custom.kind as never) : null,
              custom_budget: tab === 'custom' && custom.budget ? Number(custom.budget) : null,
              custom_motivation: tab === 'custom' ? custom.motivation : null,
              consultant_id: consultant || null,
              due_date: due || null,
              status: 'not_started',
              start_date: new Date().toISOString().slice(0, 10),
            })
            onClose()
            setCatId(''); setDue(''); setCustom({ name: '', kind: 'capex', budget: '', motivation: '' })
          }}>
          Add to scope
        </button>
      </div>
    </Modal>
  )
}

function LogComm({ open, onClose, beneficiaryId, interventions, authorId, defaultInterventionId }: {
  open: boolean; onClose: () => void; beneficiaryId: string
  interventions: { id: string; title: string }[]; authorId: string | null
  defaultInterventionId?: string | null
}) {
  const [f, setF] = useState({
    channel: 'call' as Channel, intervention_id: '', context: '',
    occurred_at: new Date().toISOString().slice(0, 16), followed_up_by_email: false, email_text: '',
  })
  // When opened from a specific intervention (e.g. "Log contact attempt"), pre-select it.
  useEffect(() => {
    if (open) setF(prev => ({ ...prev, intervention_id: defaultInterventionId ?? '' }))
  }, [open, defaultInterventionId])
  const showFollowUp = f.channel !== 'email'
  return (
    <Modal open={open} onClose={onClose} title="Log a communication">
      <div className="grid gap-x-4 md:grid-cols-2">
        <Field label="Channel">
          <select className="input" value={f.channel}
            onChange={e => {
              const channel = e.target.value as Channel
              setF({ ...f, channel, ...(channel === 'email' ? { followed_up_by_email: false, email_text: '' } : {}) })
            }}>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="site_visit">Site visit</option>
          </select>
        </Field>
        <Field label="Date and time">
          <input className="input" type="datetime-local" value={f.occurred_at}
            onChange={e => setF({ ...f, occurred_at: e.target.value })} />
        </Field>
      </div>
      <Field label="Intervention (optional)">
        <select className="input" value={f.intervention_id}
          onChange={e => setF({ ...f, intervention_id: e.target.value })}>
          <option value="">Beneficiary-level</option>
          {interventions.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </Field>
      <Field label="Context" hint="Playbook: every call is logged with date, time and context — and followed by an email.">
        <textarea className="input h-24 resize-none" value={f.context}
          onChange={e => setF({ ...f, context: e.target.value })} />
      </Field>
      {showFollowUp && (
        <>
          <label className="mb-3 flex items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={f.followed_up_by_email}
              onChange={e => setF({ ...f, followed_up_by_email: e.target.checked, email_text: e.target.checked ? f.email_text : '' })} />
            Followed up in writing
          </label>
          {f.followed_up_by_email && (
            <Field label="Paste the sent email" hint="Stored as part of the evidence trail.">
              <textarea className="input h-28 resize-none" value={f.email_text}
                placeholder="Paste the email you sent as the written follow-up…"
                onChange={e => setF({ ...f, email_text: e.target.value })} />
            </Field>
          )}
        </>
      )}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.context}
          onClick={async () => {
            const followed = showFollowUp && f.followed_up_by_email
            await repo.addComm({
              beneficiary_id: beneficiaryId,
              intervention_id: f.intervention_id || null,
              author_id: authorId,
              channel: f.channel,
              occurred_at: new Date(f.occurred_at).toISOString(),
              context: f.context,
              followed_up_by_email: followed,
              email_text: followed && f.email_text ? f.email_text : null,
            })
            onClose()
            setF({ ...f, context: '', followed_up_by_email: false, email_text: '' })
          }}>
          Log it
        </button>
      </div>
    </Modal>
  )
}

function EscalateForm({ interventionId, beneficiaryId, consultantId, mancos, onDone }: {
  interventionId: string; beneficiaryId: string; consultantId: string | null
  mancos: Profile[]; onDone: () => void
}) {
  const [mancoId, setMancoId] = useState('')
  const [reason, setReason] = useState('')
  const [context, setContext] = useState('')
  return (
    <>
      <Field label="Escalate to (ManCo)" hint="Required. This person takes ownership of the escalation next.">
        <select className="input" value={mancoId} onChange={e => setMancoId(e.target.value)}>
          <option value="">Select ManCo</option>
          {mancos.map(p => (
            <option key={p.id} value={p.id}>
              {p.full_name}{p.organisation ? ` · ${p.organisation}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reason" hint="Required. What is being escalated and why.">
        <textarea className="input h-24 resize-none" value={reason} onChange={e => setReason(e.target.value)} />
      </Field>
      <Field label="Context" hint="Optional. Supporting information for the ManCo.">
        <textarea className="input h-20 resize-none" value={context} onChange={e => setContext(e.target.value)} />
      </Field>
      <div className="rounded-lg bg-ink-800 px-3 py-2 text-[11px] text-white/40">
        Ownership passes to the chosen ManCo. Only the current owner can act — you keep full visibility and the audit trail.
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-danger" disabled={!reason.trim() || !mancoId || !consultantId}
          onClick={async () => {
            if (!consultantId) return
            await repo.escalateToManco({
              intervention_id: interventionId,
              beneficiary_id: beneficiaryId,
              consultant_id: consultantId,
              manco_id: mancoId,
              reason: reason.trim(),
              context: context.trim() || null,
            })
            onDone()
          }}>
          <AlertTriangle size={15} /> Escalate
        </button>
      </div>
    </>
  )
}

function OverrideForm({ beneficiaryId, current, loggedBy, onDone }: {
  beneficiaryId: string; current: Rag; loggedBy: string | null; onDone: () => void
}) {
  const [rag, setRag] = useState<Rag>(current)
  const [reason, setReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  return (
    <>
      <Field label="Status">
        <div className="flex gap-2">
          {(['green', 'amber', 'red'] as Rag[]).map(r => (
            <button key={r} onClick={() => setRag(r)}
              className={`btn flex-1 justify-center border ${rag === r ? '' : 'opacity-40'}`}
              style={{ background: `${RAG_HEX[r]}1f`, color: RAG_HEX[r], borderColor: RAG_HEX[r] }}>
              {r}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Reason" hint="Required. This is what Exco and the client see.">
        <textarea className="input h-20 resize-none" value={reason} onChange={e => setReason(e.target.value)} />
      </Field>
      <Field label="Effective date">
        <input className="input" type="date" value={effectiveDate}
          onChange={e => setEffectiveDate(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={!reason}
          onClick={async () => {
            await repo.saveBeneficiaryOverride(beneficiaryId, rag, reason, effectiveDate, loggedBy)
            onDone()
          }}>
          Save override
        </button>
      </div>
    </>
  )
}
