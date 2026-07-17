import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CalendarDays, ChevronDown, Search } from 'lucide-react'
import { useData } from '../lib/useData'
import { RAG_HEX } from '../lib/rag'
import { categoryTint } from '../lib/palette'
import { STATUS_LABEL, type Rag } from '../lib/types'
import type { InterventionView, WeeklyUpdate } from '../lib/types'
import { Empty, RagPill, fmtDate, timeAgo } from '../components/ui'

const ALL = '__all__'
const uniq = (xs: string[]) => Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b))

function Select({ value, onChange, options, allLabel }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm text-white/80 focus:border-lime focus:outline-none"
    >
      <option value={ALL}>{allLabel}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export default function Huddle() {
  const { beneficiaries, interventions, updates, people, loading } = useData()

  const [search, setSearch] = useState('')
  const [fSponsor, setFSponsor] = useState(ALL)
  const [fTitle, setFTitle] = useState(ALL)
  const [fConsultant, setFConsultant] = useState(ALL)
  const [fBeneficiary, setFBeneficiary] = useState(ALL)
  const [fRag, setFRag] = useState(ALL)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const live = useMemo(() => interventions.filter(i => i.status !== 'completed'), [interventions])

  const sponsorOpts = uniq(
    beneficiaries.filter(b => live.some(i => i.beneficiary_id === b.id)).map(b => b.client_name),
  ).map(v => ({ value: v, label: v }))
  const titleOpts = uniq(live.map(i => i.title)).map(v => ({ value: v, label: v }))
  const beneficiaryOpts = uniq(
    beneficiaries.filter(b => live.some(i => i.beneficiary_id === b.id)).map(b => b.name),
  ).map(v => ({ value: v, label: v }))
  const consultantOpts = uniq(
    live.map(i => i.consultant_id).filter((v): v is string => Boolean(v)),
  ).map(id => ({ value: id, label: people.find(p => p.id === id)?.full_name ?? 'Unassigned' }))
  const ragOpts = (['green', 'amber', 'red'] as Rag[]).map(r => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))

  const rows = useMemo(() => {
    return beneficiaries
      .map(b => {
        const ivs = live
          .filter(i => i.beneficiary_id === b.id)
          .filter(i => (fTitle === ALL || i.title === fTitle)
            && (fConsultant === ALL || i.consultant_id === fConsultant)
            && (fRag === ALL || i.rag === fRag))
        return { b, ivs }
      })
      .filter(({ b, ivs }) => {
        if (ivs.length === 0) return false
        if (fSponsor !== ALL && b.client_name !== fSponsor) return false
        if (fBeneficiary !== ALL && b.name !== fBeneficiary) return false
        if (search.trim() && !b.name.toLowerCase().includes(search.trim().toLowerCase())) return false
        return true
      })
      .sort((a, z) => ({ red: 0, amber: 1, green: 2 }[a.b.rag] - { red: 0, amber: 1, green: 2 }[z.b.rag]))
  }, [beneficiaries, live, fTitle, fConsultant, fRag, fSponsor, fBeneficiary, search])

  if (loading) return <div className="text-white/40">Loading...</div>

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <CalendarDays className="text-lime" size={22} />
        <div>
          <h1 className="text-2xl text-white">The Huddle</h1>
          <p className="mt-1 text-sm text-white/40">
            Wednesday. Every live project, led by the beneficiary who owns it.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search beneficiary"
            className="rounded-lg border border-ink-500 bg-ink-800 py-2 pl-9 pr-3 text-sm text-white/80 placeholder:text-white/25 focus:border-lime focus:outline-none"
          />
        </div>
        <Select value={fSponsor} onChange={setFSponsor} options={sponsorOpts} allLabel="All aggregators" />
        <Select value={fTitle} onChange={setFTitle} options={titleOpts} allLabel="All interventions" />
        <Select value={fConsultant} onChange={setFConsultant} options={consultantOpts} allLabel="All consultants" />
        <Select value={fBeneficiary} onChange={setFBeneficiary} options={beneficiaryOpts} allLabel="All beneficiaries" />
        <Select value={fRag} onChange={setFRag} options={ragOpts} allLabel="All RAG" />
      </div>

      {rows.map(({ b, ivs }, idx) => {
        const multi = ivs.length > 1
        const isOpen = expanded.has(b.id)
        return (
          <motion.section key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }} className="card p-6">
            <button
              onClick={() => multi && toggle(b.id)}
              className={`flex w-full items-center justify-between gap-3 text-left ${multi ? '' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-3">
                {multi && (
                  <ChevronDown
                    size={18}
                    className="text-white/40 transition-transform"
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  />
                )}
                <div>
                  <h2 className="text-lg text-white">{b.name}</h2>
                  <div className="text-xs text-white/35">
                    {b.client_name}{b.sponsor_name ? ` · ${b.sponsor_name}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {multi && <span className="text-[11px] text-white/30">{ivs.length} interventions</span>}
                <RagPill rag={b.rag} />
              </div>
            </button>

            {multi ? (
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-3">
                      {ivs.map(i => <IvBlock key={i.id} iv={i} updates={updates} />)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <div className="mt-4 space-y-3">
                {ivs.map(i => <IvBlock key={i.id} iv={i} updates={updates} />)}
              </div>
            )}
          </motion.section>
        )
      })}
      {rows.length === 0 && <Empty text="No live projects match these filters." />}
    </div>
  )
}

function IvBlock({ iv, updates }: { iv: InterventionView; updates: WeeklyUpdate[] }) {
  const tint = categoryTint(iv.category)
  const last = updates.filter(u => u.intervention_id === iv.id)
    .sort((a, z) => z.created_at.localeCompare(a.created_at))[0]
  const staleUpdate = !last || Date.now() - new Date(last.created_at).getTime() > 7 * 86400000
  return (
    <div className="rounded-lg bg-ink-800 p-4" style={{ borderLeft: `3px solid ${tint.border}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/beneficiaries/${iv.beneficiary_id}`}
          className="text-sm hover:opacity-80" style={{ color: tint.text }}>
          {iv.title}
        </Link>
        <span className="flex items-center gap-3">
          <span className="text-[11px] text-white/30">{STATUS_LABEL[iv.status]}</span>
          <RagPill rag={iv.rag} reason={iv.rag_reason} />
        </span>
      </div>

      {last ? (
        <div className="mt-3 grid gap-x-6 gap-y-1 text-xs md:grid-cols-2">
          <Cell k="Completed" v={last.completed_work} />
          <Cell k="Now" v={last.in_progress} />
          <Cell k="Blocker" v={last.blocker} danger />
          <Cell k="Owner" v={last.blocker_owner} />
          <Cell k="Next action" v={last.next_action} />
          <Cell k="Next update" v={last.next_update_due ? fmtDate(last.next_update_due) : null} />
        </div>
      ) : (
        <div className="mt-3 text-xs text-white/30">No update logged.</div>
      )}

      {staleUpdate && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: RAG_HEX.amber }}>
          <AlertCircle size={12} /> Last update {timeAgo(last?.created_at)} — needs a fresh update
        </div>
      )}
    </div>
  )
}

function Cell({ k, v, danger }: { k: string; v?: string | null; danger?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-white/30">{k}</span>
      <span className={danger && v ? 'text-flame' : 'text-white/70'}>{v ?? '—'}</span>
    </div>
  )
}
