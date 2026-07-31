import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Plus, Search, Trash2, Upload, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useData } from '../lib/useData'
import { repo } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import { LIFECYCLE_LABEL, STAGE_LABEL, companyKey, type BeneLifecycle, type BeneficiaryView, type Director, type Rag } from '../lib/types'
import { worst } from '../lib/rag'
import { downloadTemplate, parseWorkbook, type ParsedRow } from '../lib/bulkOnboard'
import { Empty, Field, Modal, RagPill, timeAgo } from '../components/ui'

const uniq = (xs: (string | null | undefined)[]) =>
  Array.from(new Set(xs.filter(Boolean) as string[]))

// A card on the list is either one funding line (managers/exco see lines separately) or a whole
// beneficiary — all its funding lines collapsed into one (what the consultant sees).
type BenCard = {
  key: string
  to: string
  name: string
  subtitle: string
  rag: Rag
  reason: string | null
  lifecycle: BeneLifecycle
  cycle: number
  intervention_count: number
  completed_count: number
  stageLabel: string
  pm_name: string | null
  last_engagement_at: string | null
  badges: string[]
  archived?: BeneficiaryView
}

function lineCard(b: BeneficiaryView, lineCount: number): BenCard {
  return {
    key: b.id, to: `/beneficiaries/${b.id}`, name: b.name,
    subtitle: [b.sponsor_name ?? b.client_name, b.aggregator_name].filter(Boolean).join(' · '),
    rag: b.rag, reason: b.escalation_reason, lifecycle: b.lifecycle, cycle: b.cycle,
    intervention_count: b.intervention_count, completed_count: b.completed_count,
    stageLabel: STAGE_LABEL[b.stage], pm_name: b.pm_name, last_engagement_at: b.last_engagement_at ?? null,
    badges: [b.invoice_number, lineCount > 1 ? `1 of ${lineCount} lines` : null].filter(Boolean) as string[],
    archived: b.lifecycle === 'archived' ? b : undefined,
  }
}

// Collapse all funding lines of one company into a single consultant-facing card.
function companyCard(lines: BeneficiaryView[]): BenCard {
  const primary = lines.find(l => companyKey(l) === l.id) ?? lines[0]
  const sponsors = uniq(lines.map(l => l.sponsor_name ?? l.client_name))
  const aggs = uniq(lines.map(l => l.aggregator_name))
  const sponsorLabel = sponsors.length <= 2 ? sponsors.join(', ') : `${sponsors.length} sponsors`
  const engaged = lines.map(l => l.last_engagement_at).filter((x): x is string => !!x).sort()
  return {
    key: companyKey(primary), to: `/beneficiaries/${primary.id}?company=1`, name: primary.name,
    subtitle: [sponsorLabel, aggs.join(', ')].filter(Boolean).join(' · '),
    rag: worst(lines.map(l => l.rag)), reason: lines.map(l => l.escalation_reason).find(Boolean) ?? null,
    lifecycle: primary.lifecycle, cycle: primary.cycle,
    intervention_count: lines.reduce((s, l) => s + l.intervention_count, 0),
    completed_count: lines.reduce((s, l) => s + l.completed_count, 0),
    stageLabel: STAGE_LABEL[primary.stage], pm_name: primary.pm_name,
    last_engagement_at: engaged.length ? engaged[engaged.length - 1] : null,
    badges: lines.length > 1 ? [`${lines.length} funding lines`] : (primary.invoice_number ? [primary.invoice_number] : []),
  }
}

type DirectorRow = { name: string; email: string; phone: string }
const emptyDirector = (): DirectorRow => ({ name: '', email: '', phone: '' })

const blankForm = () => ({
  name: '', sponsor_id: '', industry: '',
  contact_person: '', contact_email: '', contact_phone: '',
  project_manager_id: '',
  sow_signed_date: new Date().toISOString().slice(0, 10),
  ember360_report_url: '', drive_folder_url: '', expected_completion: '', needs_onsite: false,
})

export default function Beneficiaries() {
  const { beneficiaries, people, aggregators, sponsors, loading } = useData()
  const { can, user } = useAuth()
  const [q, setQ] = useState('')
  const [sponsorFilter, setSponsorFilter] = useState('all')
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  const [form, setForm] = useState(blankForm())
  const [directors, setDirectors] = useState<DirectorRow[]>([emptyDirector()])

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')

  // Distinct sponsor/aggregator labels present in the loaded beneficiaries.
  const clientNames = useMemo(
    () => Array.from(new Set(beneficiaries.map(b => b.client_name).filter(Boolean))).sort(),
    [beneficiaries])

  // Sponsors grouped by aggregator for the load form's <optgroup> select.
  const groupedSponsors = useMemo(() => {
    const groups = aggregators.map(a => ({
      label: a.name,
      options: sponsors.filter(s => s.aggregator_id === a.id),
    })).filter(g => g.options.length > 0)
    const standalone = sponsors.filter(s => s.aggregator_id == null)
    if (standalone.length) groups.push({ label: 'Standalone', options: standalone })
    return groups
  }, [aggregators, sponsors])

  const derivedAggregator = useMemo(() => {
    const s = sponsors.find(s => s.id === form.sponsor_id)
    if (!s) return null
    return aggregators.find(a => a.id === s.aggregator_id)?.name ?? 'Standalone'
  }, [aggregators, sponsors, form.sponsor_id])

  const visible = beneficiaries.filter(b => {
    const matchesQ = b.name.toLowerCase().includes(q.toLowerCase()) ||
      (b.client_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (b.sponsor_name ?? '').toLowerCase().includes(q.toLowerCase())
    const matchesSponsor = sponsorFilter === 'all' || b.client_name === sponsorFilter
    const matchesView = view === 'archived'
      ? b.lifecycle === 'archived'
      : can('manage')
        ? b.lifecycle !== 'archived'
        : (b.lifecycle !== 'archived' && b.lifecycle !== 'concluded')  // consultants don't see concluded
    return matchesQ && matchesSponsor && matchesView
  })

  // Managers/Exco see each funding line as its own card; consultants see one card per beneficiary
  // (all its funding lines collapsed), regardless of how many sponsors fund it.
  const isManager = can('manage')
  const lineCounts = new Map<string, number>()
  beneficiaries.forEach(b => lineCounts.set(companyKey(b), (lineCounts.get(companyKey(b)) ?? 0) + 1))
  let cards: BenCard[]
  if (isManager) {
    cards = visible.map(b => lineCard(b, lineCounts.get(companyKey(b)) ?? 1))
  } else {
    const groups = new Map<string, BeneficiaryView[]>()
    visible.forEach(b => { const k = companyKey(b); groups.set(k, [...(groups.get(k) ?? []), b]) })
    cards = Array.from(groups.values()).map(companyCard)
  }

  const readyRows = rows.filter(r => r.errors.length === 0)

  function resetModal() {
    setForm(blankForm())
    setDirectors([emptyDirector()])
    setRows([])
    setFileName('')
    setMode('single')
  }

  async function saveSingle() {
    const cleanDirectors: Director[] = directors
      .filter(d => d.name.trim())
      .map(d => ({ name: d.name.trim(), email: d.email.trim() || null, phone: d.phone.trim() || null }))
    await repo.addBeneficiary({
      name: form.name,
      sponsor_id: form.sponsor_id,
      industry: form.industry || null,
      contact_person: form.contact_person || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      directors: cleanDirectors,
      sow_signed_date: form.sow_signed_date || null,
      ember360_report_url: form.ember360_report_url || null,
      drive_folder_url: form.drive_folder_url || null,
      expected_completion: form.expected_completion || null,
      project_manager_id: form.project_manager_id || null,
      needs_onsite: form.needs_onsite,
    })
    setOpen(false)
    resetModal()
  }

  async function loadReady() {
    await repo.addBeneficiaries(readyRows.map(r => ({
      ...r.data,
      project_manager_id: people.find(p => p.email.toLowerCase() === r.pmEmail?.toLowerCase())?.id ?? null,
    })))
    setOpen(false)
    resetModal()
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setRows(await parseWorkbook(file, sponsors))
  }

  if (loading) return <div className="text-white/40">Loading...</div>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Beneficiaries</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input className="input w-64 pl-9" placeholder="Search beneficiary or sponsor"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="input w-52" value={sponsorFilter} onChange={e => setSponsorFilter(e.target.value)}>
            <option value="all">All sponsors / aggregators</option>
            {clientNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          {can('manage') && (
            <div className="flex rounded-lg bg-ink-800 p-1">
              {(['active', 'archived'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors ${
                    view === v ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
                  {v}
                </button>
              ))}
            </div>
          )}
          {can('manage') && (
            <button className="btn-primary" onClick={() => { resetModal(); setOpen(true) }}>
              <Plus size={16} /> Load beneficiary
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}>
            <Link to={c.to} className="card card-hover block p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white">{c.name}</div>
                  <div className="mt-0.5 text-xs text-white/35">{c.subtitle}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.lifecycle !== 'active' && (
                      <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                        {LIFECYCLE_LABEL[c.lifecycle]}{c.cycle > 1 ? ` · cycle ${c.cycle}` : ''}
                      </span>
                    )}
                    {c.badges.map(bd => (
                      <span key={bd} className="inline-block rounded-full bg-lime/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-lime/80">
                        {bd}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.intervention_count > 0 && c.completed_count === c.intervention_count && (
                    <span title="All interventions complete"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-jade/20 text-jade animate-pulse">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                  <RagPill rag={c.rag} reason={c.reason} />
                </div>
              </div>

              {c.intervention_count === 0 ? (
                <div className="mt-4 rounded-lg bg-ink-800/60 px-3 py-2 text-center text-[11px] text-white/40">
                  No interventions assigned yet
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-center justify-between text-[11px]">
                    <span className="text-white/50">Interventions</span>
                    <span className="text-white/70">{c.completed_count} of {c.intervention_count} complete</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
                    <motion.div className="h-full rounded-full bg-jade"
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.completed_count / c.intervention_count) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }} />
                  </div>
                </>
              )}

              <div className="mt-4 flex justify-between border-t border-ink-600 pt-3 text-[11px] text-white/40">
                <span>PM · {c.pm_name ?? 'unassigned'}</span>
                <span>Engaged {timeAgo(c.last_engagement_at)}</span>
              </div>
            </Link>
            {c.archived && can('manage') && (
              <button
                className="btn-ghost mt-2 w-full justify-center"
                onClick={() => {
                  const d = window.prompt('New SOW signed date for re-onboarding (YYYY-MM-DD):',
                    new Date().toISOString().slice(0, 10))
                  if (d && c.archived) repo.reonboardBeneficiary(c.archived.id, user?.id ?? null, d)
                }}>
                <RefreshCw size={14} /> Re-onboard (new SOW)
              </button>
            )}
          </motion.div>
        ))}
      </div>
      {cards.length === 0 && <Empty text={view === 'archived' ? 'No archived beneficiaries.' : 'No beneficiaries match those filters.'} />}

      <Modal open={open} onClose={() => { setOpen(false); resetModal() }} title="Load a signed beneficiary" wide>
        <div className="mb-5 inline-flex rounded-lg border border-ink-600 p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-sm ${mode === 'single' ? 'bg-jade text-ink-900' : 'text-white/50 hover:text-white'}`}
            onClick={() => setMode('single')}>Single</button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm ${mode === 'bulk' ? 'bg-jade text-ink-900' : 'text-white/50 hover:text-white'}`}
            onClick={() => setMode('bulk')}>Bulk upload</button>
        </div>

        {mode === 'single' ? (
          <>
            <div className="grid gap-x-4 md:grid-cols-2">
              <Field label="Business name">
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Sponsor" hint={derivedAggregator ? `Aggregator: ${derivedAggregator}` : 'Select the sponsor funding this business'}>
                <select className="input" value={form.sponsor_id} onChange={e => setForm({ ...form, sponsor_id: e.target.value })}>
                  <option value="">Select...</option>
                  {groupedSponsors.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Industry">
                <input className="input" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
              </Field>
              <Field label="Primary contact name">
                <input className="input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
              </Field>
              <Field label="Primary contact email">
                <input className="input" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
              </Field>
              <Field label="Primary contact phone">
                <input className="input" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              </Field>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label">Directors</span>
                <button className="btn-ghost text-xs" onClick={() => setDirectors([...directors, emptyDirector()])}>
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
              <Field label="SOW signed on">
                <input className="input" type="date" value={form.sow_signed_date} onChange={e => setForm({ ...form, sow_signed_date: e.target.value })} />
              </Field>
              <Field label="Expected completion">
                <input className="input" type="date" value={form.expected_completion} onChange={e => setForm({ ...form, expected_completion: e.target.value })} />
              </Field>
              <Field label="Ember360 report link" hint="The diagnostic that the SOW was drafted from.">
                <input className="input" placeholder="https://" value={form.ember360_report_url}
                  onChange={e => setForm({ ...form, ember360_report_url: e.target.value })} />
              </Field>
              <Field label="Beneficiary Google Drive folder" hint="The beneficiary's whole Drive folder — shared with consultants.">
                <input className="input" placeholder="https://drive.google.com/…" value={form.drive_folder_url}
                  onChange={e => setForm({ ...form, drive_folder_url: e.target.value })} />
              </Field>
              <Field label="Project manager">
                <select className="input" value={form.project_manager_id} onChange={e => setForm({ ...form, project_manager_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {people.filter(p => p.role === 'manco' || p.role === 'exco')
                    .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </Field>
            </div>
            <label className="mb-5 flex items-center gap-2 text-sm text-white/60">
              <input type="checkbox" checked={form.needs_onsite}
                onChange={e => setForm({ ...form, needs_onsite: e.target.checked })} />
              Local or non-tech-savvy — flag for on-site visits
            </label>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setOpen(false); resetModal() }}>Cancel</button>
              <button className="btn-primary" disabled={!form.name || !form.sponsor_id} onClick={saveSingle}>
                Load beneficiary
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button className="btn-ghost" onClick={downloadTemplate}>
                <Download size={15} /> Download standard template
              </button>
              <label className="btn-ghost cursor-pointer">
                <Upload size={15} /> Choose file
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => onFile(e.target.files?.[0])} />
              </label>
              {fileName && <span className="text-xs text-white/40">{fileName}</span>}
            </div>
            <p className="mb-4 text-xs text-white/35">
              The sheet must use the standard columns from the template. Sponsor / aggregator names must match a known sponsor.
            </p>

            {rows.length > 0 && (
              <>
                <div className="mb-3 text-sm text-white/60">
                  {readyRows.length} ready
                  {rows.length - readyRows.length > 0 && `, ${rows.length - readyRows.length} need attention`}
                </div>
                <div className="mb-5 max-h-72 overflow-y-auto rounded-xl border border-ink-600">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-ink-700 text-[11px] uppercase tracking-wide text-white/40">
                      <tr>
                        <th className="px-3 py-2 font-medium">Business name</th>
                        <th className="px-3 py-2 font-medium">Sponsor</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.row} className="border-t border-ink-600">
                          <td className="px-3 py-2 text-white/80">{r.data.name || <span className="text-white/30">—</span>}</td>
                          <td className="px-3 py-2 text-white/50">{r.sponsorText || <span className="text-white/30">—</span>}</td>
                          <td className="px-3 py-2">
                            {r.errors.length === 0
                              ? <span className="text-jade">Ready</span>
                              : <span className="text-red-400">{r.errors.join(', ')}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setOpen(false); resetModal() }}>Cancel</button>
              <button className="btn-primary" disabled={readyRows.length === 0} onClick={loadReady}>
                Load {readyRows.length} ready {readyRows.length === 1 ? 'beneficiary' : 'beneficiaries'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
