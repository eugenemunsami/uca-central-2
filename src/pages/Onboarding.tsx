import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, CalendarDays, Rocket, CheckCircle2, Ban, Search, Pencil, Trash2, Video } from 'lucide-react'
import { useData } from '../lib/useData'
import { repo } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import {
  ONB_ACTIVE_ORDER, ONB_STATUS_LABEL, ONB_OWNER_LABEL, ONB_STATUS_OWNER, type OnbStatus, type WelcomeParty,
} from '../lib/types'
import { Empty, Modal, Field, timeAgo, fmtDate } from '../components/ui'
import OnboardingDetail, { OnbStatusPill } from '../components/OnboardingDetail'

export default function Onboarding() {
  const { onboardings, welcomeParties, welcomePartyInvites, sponsors, aggregators, loading } = useData()
  const { user } = useAuth()
  const [viewId, setViewId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [partyOpen, setPartyOpen] = useState(false)
  const [editParty, setEditParty] = useState<WelcomeParty | null>(null)
  const [q, setQ] = useState('')

  const internal = user?.role === 'manco' || user?.role === 'exco'

  if (loading) return <div className="text-white/40">Loading…</div>

  const matchQ = (o: typeof onboardings[number]) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [o.name, o.client_name, o.sponsor_name, o.invoice_number]
      .some(v => (v ?? '').toLowerCase().includes(s))
  }
  const active = onboardings.filter(o => o.status !== 'converted' && o.status !== 'withdrawn' && matchQ(o))
  const converted = onboardings.filter(o => o.status === 'converted' && matchQ(o))
  const withdrawn = onboardings.filter(o => o.status === 'withdrawn' && matchQ(o))
  const sortByAction = (rows: typeof active) => [...rows].sort((x, y) => y.last_action_at.localeCompare(x.last_action_at))

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-white">Onboarding</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/40">
            The pre-SOW pipeline: invoice request → Ember360 → welcome party → signed SOW. Each ticket moves
            Exco → ManCo → Consultant → Aggregator/Sponsor and back. When the SOW is signed the beneficiary
            enters Central proper.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input className="input w-64 pl-9" placeholder="Search name, sponsor or invoice"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {internal && (
            <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New onboarding</button>
          )}
        </div>
      </header>

      {/* welcome parties */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-lime" />
          <h2 className="text-sm text-white">Welcome parties</h2>
          {internal && <button className="ml-auto text-xs text-lime hover:underline" onClick={() => setPartyOpen(true)}>+ New party</button>}
        </div>
        {welcomeParties.length === 0 ? (
          <Empty text="No welcome parties scheduled yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...welcomeParties].sort((a, b) => a.party_date.localeCompare(b.party_date)).map(w => {
              const invited = welcomePartyInvites.filter(i => i.welcome_party_id === w.id)
              return (
                <div key={w.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-white">{fmtDate(w.party_date)}</div>
                      {w.title && <div className="text-xs text-white/40">{w.title}</div>}
                    </div>
                    {internal && (
                      <div className="flex gap-1">
                        <button className="text-white/30 hover:text-white" aria-label="Edit party" onClick={() => setEditParty(w)}>
                          <Pencil size={13} />
                        </button>
                        <button className="text-white/30 hover:text-flame" aria-label="Delete party"
                          onClick={() => { if (window.confirm(`Delete the welcome party on ${fmtDate(w.party_date)}? Any tickets on it will be detached.`)) repo.deleteWelcomeParty(w.id, user?.id ?? null) }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  {w.teams_url && (
                    <a href={w.teams_url} target="_blank" rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-lime hover:text-white">
                      <Video size={12} /> MS Teams registration
                    </a>
                  )}
                  <div className="mt-2 text-[11px] text-white/40">
                    {invited.length} invited · {invited.filter(i => i.status === 'attended').length} attended · {invited.filter(i => i.status === 'no_show').length} no-show
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* active tickets, grouped by status */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-lime" />
          <h2 className="text-sm text-white">In progress</h2>
          {active.length > 0 && <span className="rounded-full bg-lime-soft px-2 py-0.5 text-[11px] text-lime">{active.length}</span>}
        </div>
        {active.length === 0 ? (
          <Empty text="Nothing in the onboarding pipeline right now." />
        ) : (
          ONB_ACTIVE_ORDER.map(status => {
            const rows = sortByAction(active.filter(o => o.status === status))
            if (rows.length === 0) return null
            return (
              <div key={status} className="space-y-2 rounded-xl border border-ink-600/60 bg-ink-800/30 p-3">
                <div className="flex items-center gap-2">
                  <div className="label">{ONB_STATUS_LABEL[status as OnbStatus]}</div>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">{rows.length}</span>
                </div>
                {rows.map((o, i) => (
                  <motion.div key={o.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`card flex flex-wrap items-center justify-between gap-4 p-4 ${o.is_red ? 'border-flame/40' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-white">{o.name}</span>
                        <span className="text-white/30">·</span>
                        <span className="text-sm text-white/60">{o.client_name}</span>
                        <OnbStatusPill status={o.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        <span className="text-white/40">
                          <span className="text-white/25">Owner:</span> {ONB_OWNER_LABEL[ONB_STATUS_OWNER[o.status]]}
                          {o.current_owner_id ? ` · ${o.owner_name}` : (ONB_STATUS_OWNER[o.status] === 'external' ? ` · ${o.sponsor_name}` : '')}
                        </span>
                        <span className="text-white/40"><span className="text-white/25">Last action:</span> {timeAgo(o.last_action_at)}</span>
                        {o.invoice_number && <span className="text-white/40"><span className="text-white/25">Invoice:</span> {o.invoice_number}</span>}
                      </div>
                    </div>
                    <button className="btn-primary" onClick={() => setViewId(o.id)}>View / act</button>
                  </motion.div>
                ))}
              </div>
            )
          })
        )}
      </section>

      {/* converted */}
      {converted.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <CheckCircle2 size={15} className="text-lime" />
            <div className="label">Converted to beneficiaries</div>
          </div>
          {converted.map(o => (
            <button key={o.id} onClick={() => setViewId(o.id)}
              className="card flex w-full items-center justify-between gap-3 p-3.5 text-left opacity-60 transition hover:opacity-100">
              <span className="text-sm text-white/70">{o.name} — {o.client_name}</span>
              <span className="shrink-0 text-[11px] text-white/30">SOW signed {fmtDate(o.sow_signed_date)}</span>
            </button>
          ))}
        </section>
      )}

      {/* withdrawn */}
      {withdrawn.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <Ban size={15} className="text-white/30" />
            <div className="label">Withdrawn</div>
          </div>
          {withdrawn.map(o => (
            <button key={o.id} onClick={() => setViewId(o.id)}
              className="card flex w-full items-center justify-between gap-3 p-3.5 text-left opacity-50 transition hover:opacity-100">
              <span className="text-sm text-white/70">{o.name} — {o.client_name}</span>
              <span className="shrink-0 text-[11px] text-white/30">{o.withdrawn_reason ?? 'withdrawn'}</span>
            </button>
          ))}
        </section>
      )}

      {/* detail */}
      <Modal open={Boolean(viewId)} onClose={() => setViewId(null)} title="Onboarding ticket" wide>
        {viewId && <OnboardingDetail id={viewId} onClose={() => setViewId(null)} />}
      </Modal>

      {creating && <CreateOnboarding sponsors={sponsors} aggregators={aggregators} onClose={() => setCreating(false)} />}
      {partyOpen && <CreateParty onClose={() => setPartyOpen(false)} />}
      {editParty && <EditParty party={editParty} onClose={() => setEditParty(null)} />}
    </div>
  )
}

function CreateOnboarding({ sponsors, aggregators, onClose }: {
  sponsors: { id: string; name: string; aggregator_id?: string | null }[]
  aggregators: { id: string; name: string }[]
  onClose: () => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [sponsorId, setSponsorId] = useState('')
  const [budget, setBudget] = useState('')
  const [industry, setIndustry] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const label = (s: { id: string; name: string; aggregator_id?: string | null }) => {
    const ag = aggregators.find(a => a.id === s.aggregator_id)
    return ag ? `${s.name} · ${ag.name}` : s.name
  }

  const save = async () => {
    if (!name.trim() || !sponsorId) return
    setBusy(true)
    await repo.createOnboarding({
      name: name.trim(), sponsor_id: sponsorId, budget: budget ? Number(budget) : null,
      industry: industry || null, contact_person: contact || null, contact_email: email || null, contact_phone: phone || null,
    }, user?.id ?? null)
    setBusy(false)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="New onboarding">
      <Field label="Beneficiary name (required)"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Aggregator / Sponsor (required)">
        <select className="input" value={sponsorId} onChange={e => setSponsorId(e.target.value)}>
          <option value="">Select sponsor</option>
          {sponsors.map(s => <option key={s.id} value={s.id}>{label(s)}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Budget (R)"><input className="input" type="number" value={budget} onChange={e => setBudget(e.target.value)} /></Field>
        <Field label="Industry"><input className="input" value={industry} onChange={e => setIndustry(e.target.value)} /></Field>
      </div>
      <Field label="Contact person"><input className="input" value={contact} onChange={e => setContact(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact email"><input className="input" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Contact phone"><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!name.trim() || !sponsorId || busy} onClick={save}>Open ticket</button>
      </div>
    </Modal>
  )
}

function CreateParty({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [date, setDate] = useState('')
  const [title, setTitle] = useState('')
  const [teams, setTeams] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!date) return
    setBusy(true)
    await repo.createWelcomeParty({ party_date: date, title: title || null, teams_url: teams || null }, user?.id ?? null)
    setBusy(false)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="New welcome party">
      <Field label="Date (required)"><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Welcome Party — this week" /></Field>
      <Field label="MS Teams registration link" hint="Sent to beneficiaries so they can register for the party.">
        <input className="input" value={teams} onChange={e => setTeams(e.target.value)} placeholder="https://teams.microsoft.com/…" />
      </Field>
      <div className="mt-1 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!date || busy} onClick={save}>Create</button>
      </div>
    </Modal>
  )
}

function EditParty({ party, onClose }: { party: WelcomeParty; onClose: () => void }) {
  const { user } = useAuth()
  const [date, setDate] = useState(party.party_date)
  const [title, setTitle] = useState(party.title ?? '')
  const [teams, setTeams] = useState(party.teams_url ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!date) return
    setBusy(true)
    await repo.updateWelcomeParty(party.id, { party_date: date, title: title || null, teams_url: teams || null }, user?.id ?? null)
    setBusy(false)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Edit welcome party">
      <Field label="Date (required)"><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Welcome Party — this week" /></Field>
      <Field label="MS Teams registration link" hint="Sent to beneficiaries so they can register for the party.">
        <input className="input" value={teams} onChange={e => setTeams(e.target.value)} placeholder="https://teams.microsoft.com/…" />
      </Field>
      <div className="mt-1 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!date || busy} onClick={save}>Save changes</button>
      </div>
    </Modal>
  )
}
