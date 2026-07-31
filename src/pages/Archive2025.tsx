import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, Search, Pencil, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchArchiveJobs, updateArchiveJob, ARCH_STATUSES, ARCH_RAGS,
  type ArchiveJob, type ArchStatus, type ArchRag,
} from '../lib/archive2025'
import { Empty, Field, Modal } from '../components/ui'

// Local presentational helpers (kept in-file so this section shares nothing that could couple it to
// the rest of Central). Colours mirror Central's RAG palette so it looks native.
const RAG_HEX: Record<ArchRag, string> = { green: '#9FD150', amber: '#F5B942', red: '#EE4823' }
const RAG_LABEL: Record<ArchRag, string> = { green: 'On track', amber: 'Watch', red: 'At risk' }
const STATUS_HEX: Record<ArchStatus, string> = {
  'Not Started': '#8A94A6', 'In Progress': '#4C93E8', 'Complete: To Send Report': '#F5B942', 'Closed': '#9FD150',
}
const worst = (rs: ArchRag[]): ArchRag => rs.includes('red') ? 'red' : rs.includes('amber') ? 'amber' : 'green'

function RagPill({ rag }: { rag: ArchRag }) {
  const hex = RAG_HEX[rag]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} /> {RAG_LABEL[rag]}
    </span>
  )
}
function StatusPill({ status }: { status: ArchStatus }) {
  const hex = STATUS_HEX[status]
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}>{status}</span>
  )
}

export default function Archive2025() {
  const { user } = useAuth()
  const canEdit = user?.role !== 'external'   // internal staff edit; external accounts read-only
  const [jobs, setJobs] = useState<ArchiveJob[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [status, setStatus] = useState<'all' | ArchStatus>('all')
  const [rag, setRag] = useState<'all' | ArchRag>('all')
  const [edit, setEdit] = useState<ArchiveJob | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = () => {
    setLoading(true)
    fetchArchiveJobs().then(setJobs).catch(() => setJobs([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const categories = useMemo(() => Array.from(new Set(jobs.map(j => j.category))).sort(), [jobs])

  const filtered = useMemo(() => jobs.filter(j =>
    (!q || j.beneficiary_name.toLowerCase().includes(q.trim().toLowerCase())) &&
    (cat === 'all' || j.category === cat) &&
    (status === 'all' || j.status === status) &&
    (rag === 'all' || j.rag === rag)), [jobs, q, cat, status, rag])

  const cards = useMemo(() => {
    const m = new Map<string, ArchiveJob[]>()
    filtered.forEach(j => m.set(j.beneficiary_key, [...(m.get(j.beneficiary_key) ?? []), j]))
    return Array.from(m.values())
      .map(rows => ({
        key: rows[0].beneficiary_key,
        name: rows.reduce((a, b) => (a.beneficiary_name.length >= b.beneficiary_name.length ? a : b)).beneficiary_name,
        rag: worst(rows.map(r => r.rag)),
        rows: [...rows].sort((a, b) => a.category.localeCompare(b.category)),
      }))
      .sort((a, z) => a.name.toLowerCase().localeCompare(z.name.toLowerCase()))
  }, [filtered])

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of ARCH_STATUSES) c[s] = jobs.filter(j => j.status === s).length
    return c
  }, [jobs])

  const save = async (patch: { status: ArchStatus; rag: ArchRag; latest_comment: string }) => {
    if (!edit) return
    await updateArchiveJob(edit.id, patch, user?.id ?? null)
    setEdit(null)
    load()
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime-soft text-lime"><Archive size={22} /></span>
        <div>
          <h1 className="text-2xl text-white">2025 Archive</h1>
          <p className="mt-0.5 text-sm text-white/40">BEE123 FY25 projects — a temporary, standalone tracker kept separate from live Central.</p>
        </div>
      </header>

      <div className="rounded-xl border border-amberx/30 bg-amberx/5 px-4 py-3 text-[13px] text-white/70">
        This is a temporary archive giving line of sight into the 2025 (FY25) projects. It stands entirely on its
        own and does not touch the rest of UCA Central; it will be removed once it is no longer needed.
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="input w-60 pl-9" placeholder="Search beneficiary" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">All interventions</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          {ARCH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={rag} onChange={e => setRag(e.target.value as typeof rag)}>
          <option value="all">All RAG</option>
          {ARCH_RAGS.map(r => <option key={r} value={r}>{RAG_LABEL[r]}</option>)}
        </select>
        <span className="ml-auto text-[12px] text-white/35">
          {filtered.length} of {jobs.length} jobs · {cards.length} beneficiaries
        </span>
      </div>

      {/* status summary chips */}
      <div className="flex flex-wrap gap-2">
        {ARCH_STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(status === s ? 'all' : s)}
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              status === s ? 'border-lime bg-lime-soft text-lime' : 'border-ink-600 text-white/50 hover:text-white'}`}>
            {s} <span className="opacity-60">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40">Loading…</div>
      ) : cards.length === 0 ? (
        <Empty text="No 2025 jobs match these filters." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {cards.map((c, i) => {
            const isOpen = open[c.key] !== false   // default expanded
            return (
              <motion.section key={c.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25) }} className="card overflow-hidden p-0">
                <button onClick={() => setOpen(o => ({ ...o, [c.key]: !isOpen }))}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-600/40">
                  <div className="min-w-0">
                    <div className="truncate text-white">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-white/35">
                      {c.rows.length} {c.rows.length === 1 ? 'intervention' : 'interventions'} · {Array.from(new Set(c.rows.map(r => r.category))).join(', ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RagPill rag={c.rag} />
                    <ChevronDown size={18} className="text-white/40 transition-transform"
                      style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                      <div className="space-y-2 border-t border-ink-600 px-4 py-3">
                        {c.rows.map(j => (
                          <div key={j.id} className="rounded-lg bg-ink-800/50 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm text-white">{j.category}</span>
                                  {j.invoice && <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-white/45">{j.invoice}</span>}
                                  {j.owner && <span className="text-[11px] text-white/35">· {j.owner}</span>}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <StatusPill status={j.status} />
                                <span className="h-2 w-2 rounded-full" style={{ background: RAG_HEX[j.rag] }} title={RAG_LABEL[j.rag]} />
                                {canEdit && (
                                  <button className="text-white/30 hover:text-lime" title="Update status / RAG / comment"
                                    onClick={() => setEdit(j)}>
                                    <Pencil size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            {j.latest_comment && (
                              <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-white/55">{j.latest_comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )
          })}
        </div>
      )}

      {edit && <EditJob job={edit} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  )
}

function EditJob({ job, onClose, onSave }: {
  job: ArchiveJob
  onClose: () => void
  onSave: (patch: { status: ArchStatus; rag: ArchRag; latest_comment: string }) => Promise<void>
}) {
  const [status, setStatus] = useState<ArchStatus>(job.status)
  const [rag, setRag] = useState<ArchRag>(job.rag)
  const [comment, setComment] = useState(job.latest_comment ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <Modal open onClose={onClose} title={`${job.category} — ${job.beneficiary_name}`}>
      <Field label="Status">
        <select className="input" value={status} onChange={e => setStatus(e.target.value as ArchStatus)}>
          {ARCH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="RAG status">
        <select className="input" value={rag} onChange={e => setRag(e.target.value as ArchRag)}>
          {ARCH_RAGS.map(r => <option key={r} value={r}>{RAG_LABEL[r]}</option>)}
        </select>
      </Field>
      <Field label="Latest comment" hint="Replaces the current status comment.">
        <textarea className="input h-28 resize-none" value={comment} onChange={e => setComment(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy}
          onClick={async () => { setBusy(true); try { await onSave({ status, rag, latest_comment: comment }) } finally { setBusy(false) } }}>
          {busy ? 'Saving…' : 'Save update'}
        </button>
      </div>
    </Modal>
  )
}
