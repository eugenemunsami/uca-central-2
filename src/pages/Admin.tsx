import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Ban, Building2, ChevronDown, Eye, EyeOff, History, KeyRound, Mail, Network, Plus,
  RotateCcw, ToggleLeft, ToggleRight, Trash2, UserCheck,
} from 'lucide-react'
import { useData } from '../lib/useData'
import { repo, subscribe } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import type { BeneficiaryView, InterventionView, Profile, Role, UserStatus } from '../lib/types'
import { LIFECYCLE_LABEL, STATUS_LABEL, USER_EVENT_LABEL, USER_STATUS_LABEL } from '../lib/types'
import { Empty, Field, Modal, RagPill } from '../components/ui'
import { categoryTint } from '../lib/palette'

// User verticals map 1:1 onto the internal Role. "Client / Aggregator / Sponsor"
// is the external funder side of the house.
const VERTICALS: { value: Role; label: string }[] = [
  { value: 'exco', label: 'ExCo' },
  { value: 'manco', label: 'ManCo' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'external', label: 'Client / Aggregator / Sponsor' },
]
const verticalLabel = (r: Role) => VERTICALS.find(v => v.value === r)?.label ?? r

// Status pill colours: pending=amber, active=lime, suspended=flame, deactivated/expired=grey.
const STATUS_HEX: Record<UserStatus, string> = {
  pending: '#F5B942', active: '#9FD150', suspended: '#EE4823',
  deactivated: '#8A94A6', invitation_expired: '#8A94A6',
}
function StatusPill({ status }: { status: UserStatus }) {
  const hex = STATUS_HEX[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
      {USER_STATUS_LABEL[status]}
    </span>
  )
}

function fmtStamp(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function Admin() {
  const { catalogue, people, aggregators, sponsors, userEvents, loading } = useData()
  const { can, live, user } = useAuth()
  const isManco = user?.role === 'manco'
  // ManCo + Exco can hide / delete records; this is exactly what can('manage') gates (and what the DB allows).
  const canManage = can('manage')
  const [tab, setTab] = useState<'interventions' | 'programmes' | 'beneficiaries' | 'users'>('interventions')
  const [addCat, setAddCat] = useState(false)
  const [addUser, setAddUser] = useState(false)
  const [addAgg, setAddAgg] = useState(false)
  const [addSpo, setAddSpo] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [cat, setCat] = useState({ category: '', name: '', description: '', est_delivery: '', default_owner_id: '' })
  const [usr, setUsr] = useState({ full_name: '', email: '', organisation: '', job_title: '', role: 'consultant' as Role, programme: '' })
  const [created, setCreated] = useState<{ name: string; email: string; temp: string } | null>(null)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [agg, setAgg] = useState({ name: '' })
  const [spo, setSpo] = useState({ name: '', aggregator_id: '' })
  const [activityUser, setActivityUser] = useState<Profile | null>(null)
  const [activate, setActivate] = useState<Profile | null>(null)
  const [actForm, setActForm] = useState({ password: '', terms: false })

  // Beneficiaries tab: its own fetch that INCLUDES admin-hidden records (so they can be restored / purged).
  const [adminBens, setAdminBens] = useState<BeneficiaryView[]>([])
  const [adminIvs, setAdminIvs] = useState<InterventionView[]>([])
  // Users tab: its own fetch that INCLUDES admin-hidden users (so they can be restored / deleted).
  const [adminUsers, setAdminUsers] = useState<Profile[]>([])
  const [benOpen, setBenOpen] = useState<Record<string, boolean>>({})
  const [benSearch, setBenSearch] = useState('')
  // Permanent-delete confirmation (type-to-confirm), for either a beneficiary or an intervention.
  const [del, setDel] = useState<{ kind: 'beneficiary' | 'intervention' | 'user' | 'catalogue'; id: string; name: string; sub?: string } | null>(null)
  const [delText, setDelText] = useState('')
  const [delErr, setDelErr] = useState<string | null>(null)

  useEffect(() => {
    const load = () => {
      repo.beneficiariesAdmin().then(setAdminBens).catch(() => setAdminBens([]))
      repo.interventionsAdmin().then(setAdminIvs).catch(() => setAdminIvs([]))
      repo.profilesAdmin().then(setAdminUsers).catch(() => setAdminUsers([]))
    }
    load()
    const unsub = subscribe(load)
    return () => { unsub() }
  }, [])

  const runDelete = async () => {
    if (!del) return
    try {
      if (del.kind === 'beneficiary') await repo.deleteBeneficiary(del.id, user?.id ?? null)
      else if (del.kind === 'user') await repo.deleteUser(del.id, user?.id ?? null)
      else if (del.kind === 'catalogue') await repo.deleteCatalogueItem(del.id)
      else await repo.deleteIntervention(del.id, user?.id ?? null)
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Could not delete.')
      return
    }
    setDel(null); setDelText(''); setDelErr(null)
  }

  const grouped = useMemo(() => {
    const m = new Map<string, typeof catalogue>()
    catalogue.forEach(c => m.set(c.category, [...(m.get(c.category) ?? []), c]))
    return Array.from(m.entries())
  }, [catalogue])

  // Beneficiaries tab: search + hidden-last ordering.
  const adminBenRows = useMemo(() => {
    const q = benSearch.trim().toLowerCase()
    return adminBens
      .filter(b => !q
        || b.name.toLowerCase().includes(q)
        || (b.client_name ?? '').toLowerCase().includes(q)
        || (b.sponsor_name ?? '').toLowerCase().includes(q))
      .sort((a, z) =>
        (Number(Boolean(a.removed_at)) - Number(Boolean(z.removed_at))) || a.name.localeCompare(z.name))
  }, [adminBens, benSearch])

  // Sponsors grouped under their parent aggregator, plus a standalone bucket.
  const sponsorGroups = useMemo(() => {
    const groups = aggregators.map(a => ({
      key: a.id,
      label: a.name,
      standalone: false,
      sponsors: sponsors.filter(s => s.aggregator_id === a.id),
    }))
    const standalone = sponsors.filter(s => s.aggregator_id == null)
    if (standalone.length) {
      groups.push({ key: '__standalone', label: 'Standalone', standalone: true, sponsors: standalone })
    }
    return groups
  }, [aggregators, sponsors])

  // External users must be linked to a programme (aggregator or sponsor) or
  // escalations silently have no audience. Encode both target fields as a single
  // select value: '' = unassigned, 'a:<id>' = aggregator, 's:<id>' = sponsor.
  const parseProg = (v: string): { external_client_id: string | null; external_sponsor_id: string | null } => {
    if (v.startsWith('a:')) return { external_client_id: v.slice(2), external_sponsor_id: null }
    if (v.startsWith('s:')) return { external_client_id: null, external_sponsor_id: v.slice(2) }
    return { external_client_id: null, external_sponsor_id: null }
  }
  const progValue = (pr: { external_client_id?: string | null; external_sponsor_id?: string | null }) =>
    pr.external_client_id ? `a:${pr.external_client_id}` : pr.external_sponsor_id ? `s:${pr.external_sponsor_id}` : ''
  const progLabel = (pr: { external_client_id?: string | null; external_sponsor_id?: string | null }) => {
    if (pr.external_client_id) return aggregators.find(a => a.id === pr.external_client_id)?.name ?? '— unassigned —'
    if (pr.external_sponsor_id) return sponsors.find(sp => sp.id === pr.external_sponsor_id)?.name ?? '— unassigned —'
    return '— unassigned —'
  }
  const programmeOptions = (
    <>
      <option value="">— unassigned —</option>
      <optgroup label="Aggregators">
        {aggregators.map(a => (
          <option key={a.id} value={`a:${a.id}`}>{a.name} (aggregator — all its sponsors)</option>
        ))}
      </optgroup>
      <optgroup label="Sponsors">
        {sponsors.map(sp => (
          <option key={sp.id} value={`s:${sp.id}`}>{sp.name} (sponsor)</option>
        ))}
      </optgroup>
    </>
  )

  const resetUserForm = () => {
    setAddUser(false)
    setCreated(null)
    setCreateErr(null)
    setUsr({ full_name: '', email: '', organisation: '', job_title: '', role: 'consultant', programme: '' })
  }

  const byName = (id?: string | null) => people.find(p => p.id === id)?.full_name ?? 'System'

  if (loading) return <div className="text-white/40">Loading...</div>
  if (!can('manage')) return <Empty text="You do not have access to the admin panel." />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl text-white">Admin</h1>
      </header>

      <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
        {(['interventions', 'programmes', 'beneficiaries', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm capitalize transition-colors ${
              tab === t ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'interventions' ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 text-xs">
              <button className="btn-ghost px-2.5 py-1"
                onClick={() => setOpen(Object.fromEntries(grouped.map(([c]) => [c, true])))}>
                Expand all
              </button>
              <button className="btn-ghost px-2.5 py-1" onClick={() => setOpen({})}>
                Collapse all
              </button>
            </div>
            <button className="btn-primary" onClick={() => setAddCat(true)}>
              <Plus size={16} /> Add intervention
            </button>
          </div>
          {grouped.map(([category, items], gi) => {
            const tint = categoryTint(category)
            const isOpen = !!open[category]
            const activeCount = items.filter(i => i.active).length
            return (
              <motion.section key={category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.03 }} className="card overflow-hidden p-0">
                <button
                  onClick={() => setOpen(o => ({ ...o, [category]: !o[category] }))}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-600/40">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tint.hue }} />
                    <span className="text-sm text-white">{category}</span>
                    <span className="text-[11px] text-white/35">
                      {items.length} {items.length === 1 ? 'service' : 'services'} · {activeCount} active
                    </span>
                  </div>
                  <ChevronDown
                    size={18}
                    className="text-white/40 transition-transform"
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden">
                      <div className="space-y-1 border-t border-ink-600 px-3 pb-3 pt-2">
                        {items.map(i => (
                          <div key={i.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-ink-600/50">
                            <div className={i.active ? '' : 'opacity-40'}>
                              <div className="text-sm text-white">{i.name}</div>
                              <div className="text-[11px] text-white/35">
                                {i.est_delivery ?? '—'}
                                {' · default owner: '}
                                {people.find(p => p.id === i.default_owner_id)?.full_name ?? 'none'}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <select
                                className="input w-40 py-1 text-xs"
                                value={i.default_owner_id ?? ''}
                                onChange={e => repo.saveCatalogueItem({ id: i.id, default_owner_id: e.target.value || null })}>
                                <option value="">No default owner</option>
                                {people.filter(p => p.role === 'consultant' || p.role === 'manco')
                                  .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </select>
                              <button onClick={() => repo.saveCatalogueItem({ id: i.id, active: !i.active })}
                                className={`flex items-center gap-1 text-[11px] ${i.active ? 'text-lime' : 'text-white/40'}`}
                                title={i.active ? 'Active — click to deactivate (hides it from new assignments)' : 'Inactive — click to activate'}
                                aria-label={i.active ? 'Deactivate' : 'Activate'}>
                                {i.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                {i.active ? 'Active' : 'Inactive'}
                              </button>
                              {canManage && (
                                <button onClick={() => { setDelErr(null); setDel({ kind: 'catalogue', id: i.id, name: i.name }) }}
                                  className="text-white/30 hover:text-flame" title="Delete this intervention type"
                                  aria-label="Delete">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )
          })}
        </>
      ) : tab === 'programmes' ? (
        <>
          <p className="text-xs text-white/35">
            {live
              ? 'An aggregator sits on top and can fund many sponsors; a sponsor can also stand alone.'
              : 'Demo mode — programme changes are in-memory only.'}
          </p>

          {/* Aggregators */}
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network size={16} className="text-lime" />
                <span className="label">Aggregators</span>
              </div>
              <button className="btn-primary" onClick={() => setAddAgg(true)}>
                <Plus size={16} /> Add aggregator
              </button>
            </div>
            {aggregators.length === 0 ? (
              <Empty text="No aggregators yet." />
            ) : (
              <div className="space-y-1">
                {aggregators.map(a => {
                  const count = sponsors.filter(s => s.aggregator_id === a.id).length
                  return (
                    <div key={a.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-ink-600/50">
                      <div className="text-sm text-white">{a.name}</div>
                      <div className="text-[11px] text-white/35">
                        {count} {count === 1 ? 'sponsor' : 'sponsors'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.section>

          {/* Sponsors */}
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-lime" />
                <span className="label">Sponsors</span>
              </div>
              <button className="btn-primary" onClick={() => setAddSpo(true)}>
                <Plus size={16} /> Add sponsor
              </button>
            </div>
            <p className="mb-4 text-[11px] text-white/35">
              To let an aggregator fund its own cohort, add a sponsor under that aggregator.
            </p>
            {sponsors.length === 0 ? (
              <Empty text="No sponsors yet." />
            ) : (
              <div className="space-y-4">
                {sponsorGroups.filter(g => g.sponsors.length).map(g => (
                  <div key={g.key}>
                    <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/35">
                      {g.standalone ? 'Standalone (no aggregator)' : g.label}
                    </div>
                    <div className="space-y-1">
                      {g.sponsors.map(s => (
                        <div key={s.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-ink-600/50">
                          <div className="text-sm text-white">{s.name}</div>
                          <div className="text-[11px] text-white/35">
                            {g.standalone ? 'Standalone' : `Under ${g.label}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        </>
      ) : tab === 'beneficiaries' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs text-white/35">
              {live
                ? 'Hide a beneficiary or a single assigned intervention to take it off every screen (reversible), or delete it permanently. ManCo and Exco only.'
                : 'Demo mode — changes are in-memory only. Hide, restore, or permanently delete beneficiaries and their assigned interventions.'}
            </p>
            <input
              className="input w-64"
              placeholder="Search beneficiary or sponsor"
              value={benSearch}
              onChange={e => setBenSearch(e.target.value)}
            />
          </div>

          {adminBenRows.length === 0 ? (
            <Empty text={benSearch ? 'No beneficiaries match your search.' : 'No beneficiaries loaded yet.'} />
          ) : (
            adminBenRows.map((b, gi) => {
              const isOpen = !!benOpen[b.id]
              const ivs = adminIvs.filter(i => i.beneficiary_id === b.id)
              const removed = Boolean(b.removed_at)
              return (
                <motion.section key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(gi * 0.02, 0.2) }} className="card overflow-hidden p-0">
                  <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${removed ? 'opacity-60' : ''}`}>
                    <button
                      onClick={() => setBenOpen(o => ({ ...o, [b.id]: !o[b.id] }))}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <ChevronDown size={18} className="shrink-0 text-white/40 transition-transform"
                        style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm text-white">{b.name}</span>
                          {removed && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                              Hidden
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/35">
                          {b.client_name}{b.sponsor_name ? ` · ${b.sponsor_name}` : ''} · {LIFECYCLE_LABEL[b.lifecycle]}
                          {' · '}{ivs.length} {ivs.length === 1 ? 'intervention' : 'interventions'}
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <RagPill rag={b.rag} />
                      {canManage && (
                        <>
                          {removed ? (
                            <button className="btn-ghost px-2 py-1 text-[11px] text-lime"
                              onClick={() => repo.setBeneficiaryRemoved(b.id, false, user?.id ?? null)}>
                              <RotateCcw size={13} /> Restore
                            </button>
                          ) : (
                            <button className="btn-ghost px-2 py-1 text-[11px]"
                              onClick={() => repo.setBeneficiaryRemoved(b.id, true, user?.id ?? null)}>
                              <EyeOff size={13} /> Hide
                            </button>
                          )}
                          <button className="btn-ghost px-2 py-1 text-[11px] text-flame"
                            onClick={() => { setDel({ kind: 'beneficiary', id: b.id, name: b.name, sub: `${ivs.length} intervention${ivs.length === 1 ? '' : 's'} and all history` }); setDelText('') }}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="space-y-1 border-t border-ink-600 px-3 pb-3 pt-2">
                          {ivs.length === 0 ? (
                            <div className="px-3 py-2 text-[12px] text-white/30">No interventions assigned to this beneficiary.</div>
                          ) : ivs.map(i => {
                            const ivRemoved = Boolean(i.removed_at)
                            return (
                              <div key={i.id}
                                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-ink-600/50 ${ivRemoved ? 'opacity-50' : ''}`}>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm text-white">{i.title}</span>
                                    {i.cancelled && (
                                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">cancelled</span>
                                    )}
                                    {ivRemoved && (
                                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50">hidden</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-white/35">
                                    {i.category} · {i.consultant_name ?? 'unassigned'} · {STATUS_LABEL[i.status]}
                                  </div>
                                </div>
                                {canManage && (
                                  <div className="flex shrink-0 items-center gap-2">
                                    {ivRemoved ? (
                                      <button className="btn-ghost px-2 py-1 text-[11px] text-lime"
                                        onClick={() => repo.setInterventionRemoved(i.id, false, user?.id ?? null)}>
                                        <Eye size={13} /> Restore
                                      </button>
                                    ) : (
                                      <button className="btn-ghost px-2 py-1 text-[11px]"
                                        onClick={() => repo.setInterventionRemoved(i.id, true, user?.id ?? null)}>
                                        <EyeOff size={13} /> Hide
                                      </button>
                                    )}
                                    <button className="btn-ghost px-2 py-1 text-[11px] text-flame"
                                      onClick={() => { setDel({ kind: 'intervention', id: i.id, name: i.title, sub: `on ${b.name}` }); setDelText('') }}>
                                      <Trash2 size={13} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              )
            })
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/35">
              {live
                ? 'Creating a user sends an onboarding invite; the vertical here controls what they can see.'
                : 'Demo mode — user changes are in-memory only. Onboarding emails are simulated.'}
              {!isManco && ' Only ManCo can create or manage accounts.'}
            </p>
            {isManco && (
              <button className="btn-primary shrink-0" onClick={() => setAddUser(true)}>
                <Plus size={16} /> Add user
              </button>
            )}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-600 text-[11px] uppercase tracking-wider text-white/35">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Organisation</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Programme</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Admin</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map(p => {
                  const st = (p.status ?? 'active') as UserStatus
                  const isSelf = p.id === user?.id
                  const removed = Boolean(p.removed_at)
                  return (
                    <tr key={p.id} className={`border-b border-ink-600/60 last:border-0 hover:bg-ink-600/40 align-top ${removed ? 'opacity-50' : ''}`}>
                      <td className="p-4 text-white">
                        {p.full_name}
                        {removed && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">Hidden</span>}
                        {p.job_title && <div className="text-[11px] text-white/35">{p.job_title}</div>}
                      </td>
                      <td className="p-4 text-white/50">{p.email}</td>
                      <td className="p-4 text-white/50">{p.organisation ?? '—'}</td>
                      <td className="p-4">
                        {isManco ? (
                          <select className="input w-32 py-1 text-xs disabled:opacity-40" value={p.role}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot change your own role.' : undefined}
                            onChange={e => repo.changeUserRole(p.id, e.target.value as Role, user?.id ?? null)}>
                            <option value="exco">Exco</option>
                            <option value="manco">ManCo</option>
                            <option value="consultant">Consultant</option>
                            <option value="external">External</option>
                          </select>
                        ) : (
                          <span className="text-white/60">{verticalLabel(p.role)}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {p.role === 'external' ? (
                          isManco ? (
                            <select
                              className="input w-48 py-1 text-xs"
                              value={progValue(p)}
                              onChange={e => repo.saveProfile({ id: p.id, ...parseProg(e.target.value) })}
                              title={progLabel(p)}>
                              {programmeOptions}
                            </select>
                          ) : (
                            <span className="text-white/60">{progLabel(p)}</span>
                          )
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                      <td className="p-4"><StatusPill status={st} /></td>
                      <td className="p-4">
                        {isManco ? (
                          <button onClick={() => repo.saveProfile({ id: p.id, is_admin: !p.is_admin })}
                            className={p.is_admin ? 'text-lime' : 'text-white/25'}>
                            {p.is_admin ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                        ) : (
                          <span className={p.is_admin ? 'text-lime' : 'text-white/25'}>{p.is_admin ? 'Yes' : 'No'}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button className="btn-ghost px-2 py-1 text-[11px]"
                            onClick={() => setActivityUser(p)}>
                            <History size={13} /> Activity
                          </button>
                          {isManco && !removed && (st === 'pending' || st === 'invitation_expired') && (
                            <>
                              <button className="btn-ghost px-2 py-1 text-[11px]"
                                onClick={() => repo.resendInvite(p.id, user?.id ?? null, p.email)}>
                                <Mail size={13} /> Resend invite
                              </button>
                              {!live && (
                                <button className="btn-ghost px-2 py-1 text-[11px]"
                                  onClick={() => { setActivate(p); setActForm({ password: '', terms: false }) }}>
                                  <UserCheck size={13} /> Simulate activation
                                </button>
                              )}
                            </>
                          )}
                          {isManco && !removed && st === 'active' && (
                            <>
                              <button className="btn-ghost px-2 py-1 text-[11px] text-amberx"
                                disabled={isSelf}
                                onClick={() => repo.setUserStatus(p.id, 'suspended', user?.id ?? null)}>
                                <Ban size={13} /> Suspend
                              </button>
                              <button className="btn-ghost px-2 py-1 text-[11px]"
                                onClick={() => repo.resetUserPassword(p.id, user?.id ?? null, p.email)}>
                                <KeyRound size={13} /> Reset password
                              </button>
                            </>
                          )}
                          {isManco && !removed && st === 'suspended' && (
                            <>
                              <button className="btn-ghost px-2 py-1 text-[11px] text-lime"
                                onClick={() => repo.setUserStatus(p.id, 'active', user?.id ?? null)}>
                                <RotateCcw size={13} /> Reactivate
                              </button>
                              <button className="btn-ghost px-2 py-1 text-[11px] text-flame"
                                onClick={() => repo.setUserStatus(p.id, 'deactivated', user?.id ?? null)}>
                                <Ban size={13} /> Deactivate
                              </button>
                            </>
                          )}
                          {isManco && !removed && st === 'deactivated' && (
                            <button className="btn-ghost px-2 py-1 text-[11px] text-lime"
                              onClick={() => repo.setUserStatus(p.id, 'active', user?.id ?? null)}>
                              <RotateCcw size={13} /> Reactivate
                            </button>
                          )}
                          {isManco && !isSelf && !removed && (
                            <button className="btn-ghost px-2 py-1 text-[11px] text-white/60"
                              title="Hide this user everywhere in the app (restorable)"
                              onClick={() => repo.setUserRemoved(p.id, true, user?.id ?? null)}>
                              <EyeOff size={13} /> Hide
                            </button>
                          )}
                          {isManco && removed && (
                            <button className="btn-ghost px-2 py-1 text-[11px] text-lime"
                              onClick={() => repo.setUserRemoved(p.id, false, user?.id ?? null)}>
                              <Eye size={13} /> Restore
                            </button>
                          )}
                          {isManco && !isSelf && (
                            <button className="btn-ghost px-2 py-1 text-[11px] text-flame"
                              title="Permanently delete this user"
                              onClick={() => setDel({ kind: 'user', id: p.id, name: p.full_name, sub: p.email })}>
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={addCat} onClose={() => setAddCat(false)} title="Add an intervention to the catalogue">
        <Field label="Category" hint="Branding, Web Development, Finance, Compliance, Coaching...">
          <input className="input" value={cat.category} onChange={e => setCat({ ...cat, category: e.target.value })} />
        </Field>
        <Field label="Name">
          <input className="input" value={cat.name} onChange={e => setCat({ ...cat, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className="input h-20 resize-none" value={cat.description}
            onChange={e => setCat({ ...cat, description: e.target.value })} />
        </Field>
        <Field label="Estimated delivery">
          <input className="input" placeholder="1-1.5 weeks" value={cat.est_delivery}
            onChange={e => setCat({ ...cat, est_delivery: e.target.value })} />
        </Field>
        <p className="mt-1 text-[11px] text-white/35">
          New intervention types are created with <span className="text-white/60">no default owner</span>. You can set an owner later from the list if you want it to auto-route.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAddCat(false)}>Cancel</button>
          <button className="btn-primary" disabled={!cat.name || !cat.category}
            onClick={async () => {
              await repo.saveCatalogueItem({ ...cat, default_owner_id: cat.default_owner_id || null, active: true })
              setAddCat(false)
              setCat({ category: '', name: '', description: '', est_delivery: '', default_owner_id: '' })
            }}>
            Add to catalogue
          </button>
        </div>
      </Modal>

      <Modal open={addAgg} onClose={() => setAddAgg(false)} title="Add an aggregator">
        <Field label="Name" hint="The funder that sits on top and can back many sponsors.">
          <input className="input" placeholder="BEE123" value={agg.name}
            onChange={e => setAgg({ name: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAddAgg(false)}>Cancel</button>
          <button className="btn-primary" disabled={!agg.name}
            onClick={async () => {
              await repo.addAggregator(agg.name)
              setAddAgg(false)
              setAgg({ name: '' })
            }}>
            Add aggregator
          </button>
        </div>
      </Modal>

      <Modal open={addSpo} onClose={() => setAddSpo(false)} title="Add a sponsor">
        <Field label="Name" hint="The funder of a cohort.">
          <input className="input" value={spo.name}
            onChange={e => setSpo({ ...spo, name: e.target.value })} />
        </Field>
        <Field label="Parent" hint="Choose an aggregator, or leave standalone.">
          <select className="input" value={spo.aggregator_id}
            onChange={e => setSpo({ ...spo, aggregator_id: e.target.value })}>
            <option value="">Standalone (no aggregator)</option>
            {aggregators.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAddSpo(false)}>Cancel</button>
          <button className="btn-primary" disabled={!spo.name}
            onClick={async () => {
              await repo.addSponsor(spo.name, spo.aggregator_id || null)
              setAddSpo(false)
              setSpo({ name: '', aggregator_id: '' })
            }}>
            Add sponsor
          </button>
        </div>
      </Modal>

      {/* ManCo-only: create + invite a user */}
      <Modal open={addUser} onClose={resetUserForm} title={created ? 'User invited' : 'Add a user'}>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-lime/40 bg-lime-soft p-4">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-lime" />
                <span className="text-sm text-white">{created.name} was created.</span>
              </div>
              {live ? (
                <div className="mt-3 rounded-lg bg-ink-900/60 px-3 py-2 text-[13px] text-white/70">
                  A 6-digit sign-in code was emailed to <span className="text-white">{created.email}</span>. They
                  open the app, choose “First time here, or forgot your password?”, enter the code, and set their
                  own password.
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-ink-900/60 px-3 py-2">
                  <span className="label">Simulated temp password</span>
                  <code className="font-mono text-sm text-lime">{created.temp}</code>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="label">Account status</span>
                <StatusPill status="pending" />
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-white/40">
              {live
                ? 'The code lets them set their password and accept the terms — no link to click, so it works even with strict email security. The account stays Pending until they do.'
                : 'In demo mode the onboarding email is simulated. At go-live this sends a real invite. The account stays Pending until the user activates it (sets their own password and accepts the terms).'}
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => {
                setCreated(null)
                setUsr({ full_name: '', email: '', organisation: '', job_title: '', role: 'consultant', programme: '' })
              }}>
                Add another
              </button>
              <button className="btn-primary" onClick={resetUserForm}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-x-4 md:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={usr.full_name} onChange={e => setUsr({ ...usr, full_name: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={usr.email} onChange={e => setUsr({ ...usr, email: e.target.value })} />
              </Field>
              <Field label="Organisation">
                <input className="input" placeholder="UCA, BEE123, Acme (Pty) Ltd..." value={usr.organisation}
                  onChange={e => setUsr({ ...usr, organisation: e.target.value })} />
              </Field>
              <Field label="Job title">
                <input className="input" placeholder="Finance Lead, Programme Manager..." value={usr.job_title}
                  onChange={e => setUsr({ ...usr, job_title: e.target.value })} />
              </Field>
            </div>
            <Field label="User vertical" hint="Determines what this user can see and do across UCA Central.">
              <select className="input" value={usr.role}
                onChange={e => setUsr({ ...usr, role: e.target.value as Role })}>
                {VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Field>
            {usr.role === 'external' && (
              <Field label="Programme access"
                hint="Aggregator access covers every sponsor under it; sponsor access is just that programme.">
                <select className="input" value={usr.programme}
                  onChange={e => setUsr({ ...usr, programme: e.target.value })}>
                  {programmeOptions}
                </select>
              </Field>
            )}
            <p className="mb-4 text-[11px] text-white/30">
              {live
                ? 'A 6-digit sign-in code is emailed on creation; the person enters it on the app (“First time here, or forgot your password?”) to set their own password. The account is Pending until they do.'
                : 'An onboarding invite (simulated in demo) goes out on creation. The account is Pending until activated.'}
            </p>
            {createErr && <div className="mb-3 text-xs text-flame">{createErr}</div>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={resetUserForm}>Cancel</button>
              <button className="btn-primary"
                disabled={creating || !usr.full_name || !usr.email || !usr.organisation || !usr.job_title}
                onClick={async () => {
                  setCreateErr(null); setCreating(true)
                  try {
                    const prog = usr.role === 'external'
                      ? parseProg(usr.programme)
                      : { external_client_id: null, external_sponsor_id: null }
                    const res = await repo.createUser({
                      full_name: usr.full_name, email: usr.email, organisation: usr.organisation,
                      job_title: usr.job_title, role: usr.role, ...prog,
                    }, user?.id ?? null)
                    setCreated({ name: usr.full_name, email: usr.email, temp: res.temp })
                  } catch (e) {
                    setCreateErr(e instanceof Error ? e.message : 'Could not create the user.')
                  } finally {
                    setCreating(false)
                  }
                }}>
                {creating ? 'Sending invite...' : 'Create & invite'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Simulated first-login activation (stands in for the real invite flow) */}
      <Modal open={!!activate} onClose={() => setActivate(null)}
        title={`Simulate activation — ${activate?.full_name ?? ''}`}>
        <p className="mb-4 text-[11px] leading-relaxed text-white/40">
          This stands in for the invited user's first login. In demo mode you set a password and
          accept the terms on their behalf; at go-live the user does this from their invite link.
        </p>
        <Field label="New password">
          <input className="input" type="text" placeholder="Set a password" value={actForm.password}
            onChange={e => setActForm({ ...actForm, password: e.target.value })} />
        </Field>
        <label className="mb-5 flex items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={actForm.terms}
            onChange={e => setActForm({ ...actForm, terms: e.target.checked })} />
          Accept the UCA Central terms of use
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setActivate(null)}>Cancel</button>
          <button className="btn-primary" disabled={!actForm.password || !actForm.terms}
            onClick={async () => {
              if (activate) await repo.activateUser(activate.id, actForm.password)
              setActivate(null)
            }}>
            Activate account
          </button>
        </div>
      </Modal>

      {/* Per-user audit trail */}
      <Modal open={!!activityUser} onClose={() => setActivityUser(null)}
        title={`Activity — ${activityUser?.full_name ?? ''}`}>
        {(() => {
          const events = activityUser
            ? userEvents.filter(e => e.target_user_id === activityUser.id)
            : []
          if (events.length === 0) return <Empty text="No recorded activity for this user yet." />
          return (
            <ol className="relative space-y-4 border-l border-ink-500 pl-5">
              {events.map(e => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-lime" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white">{USER_EVENT_LABEL[e.kind]}</span>
                    <span className="shrink-0 text-[11px] text-white/35">{fmtStamp(e.at)}</span>
                  </div>
                  {e.text && <p className="mt-0.5 text-[13px] text-white/60">{e.text}</p>}
                  <p className="mt-0.5 text-[11px] text-white/30">by {byName(e.by_user_id)}</p>
                </li>
              ))}
            </ol>
          )
        })()}
      </Modal>

      {/* Permanent-delete confirmation (type-to-confirm) */}
      <Modal open={!!del} onClose={() => { setDel(null); setDelText(''); setDelErr(null) }} title="Delete permanently">
        {del && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-flame/40 bg-flame-soft p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-flame" />
              <div className="text-sm text-white/80">
                You're about to permanently delete{' '}
                {del.kind === 'beneficiary' ? 'the beneficiary' : del.kind === 'user' ? 'the user' : del.kind === 'catalogue' ? 'the intervention type' : 'the intervention'}{' '}
                <span className="text-white">{del.name}</span>{del.sub ? ` — ${del.sub}` : ''}.
                <div className="mt-1.5 text-[12px] leading-relaxed text-white/50">
                  This can't be undone.{' '}
                  {del.kind === 'beneficiary'
                    ? 'Every intervention, weekly update, communication, escalation and activity-log entry for this beneficiary is deleted too.'
                    : del.kind === 'user'
                    ? 'Their login and profile are removed, and they are unassigned from any interventions or beneficiaries they owned.'
                    : del.kind === 'catalogue'
                    ? 'It is removed from the catalogue. It can’t be deleted while it’s still assigned to any beneficiary.'
                    : 'Its weekly updates, communications and escalations are deleted too.'}
                  {' '}{del.kind === 'catalogue'
                    ? 'To keep it but hide it from new assignments, cancel and switch it to Inactive instead.'
                    : 'To just take it off the screens instead, cancel and use Hide.'}
                </div>
              </div>
            </div>
            {delErr && <div className="text-xs text-flame">{delErr}</div>}
            <Field label="Type DELETE to confirm">
              <input className="input" value={delText} autoFocus placeholder="DELETE"
                onChange={e => setDelText(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setDel(null); setDelText('') }}>Cancel</button>
              <button className="btn-danger disabled:opacity-40"
                disabled={delText.trim().toUpperCase() !== 'DELETE'}
                onClick={runDelete}>
                <Trash2 size={15} /> Delete permanently
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
