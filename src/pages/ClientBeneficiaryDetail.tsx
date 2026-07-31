import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, FolderOpen, FileText, AlertTriangle, ExternalLink } from 'lucide-react'
import { useData } from '../lib/useData'
import {
  companyKey, LIFECYCLE_LABEL, STAGE_LABEL, STATUS_LABEL,
  type BeneficiaryView, type InterventionView,
} from '../lib/types'
import { Empty, RagPill, fmtDate, timeAgo } from '../components/ui'

// Client-safe beneficiary view for aggregator/sponsor users. Shows progress, stage, RAG, funding and
// the intervention list — but NOT the internal communication log or consultants' weekly-update notes.
function DiscoveryTag({ iv }: { iv: InterventionView }) {
  const s = iv.discovery_status
  if (!s || s === 'na') return null
  const label = s === 'cleared' ? 'Discovery done' : s === 'incomplete' ? 'Discovery outstanding' : 'Discovery pending'
  const cls = s === 'cleared' ? 'bg-jade/15 text-jade' : s === 'incomplete' ? 'bg-amberx/15 text-amberx' : 'bg-ink-700 text-white/50'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
}

export default function ClientBeneficiaryDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const asCompany = params.get('company') === '1'
  const { beneficiaries, interventions, escalations, loading } = useData()

  const primary = beneficiaries.find(b => b.id === id)

  // When opened as a company card, gather all in-scope funding lines of the same business.
  const lines = useMemo<BeneficiaryView[]>(() => {
    if (!primary) return []
    if (!asCompany) return [primary]
    return beneficiaries.filter(b => companyKey(b) === companyKey(primary))
  }, [beneficiaries, primary, asCompany])

  const lineIds = new Set(lines.map(l => l.id))
  const ivs = useMemo(
    () => interventions.filter(i => lineIds.has(i.beneficiary_id)),
    [interventions, lineIds])
  const openEsc = useMemo(
    () => escalations.filter(e => lineIds.has(e.beneficiary_id) && e.status !== 'resolved'),
    [escalations, lineIds])

  if (loading) return <div className="text-white/40">Loading…</div>
  if (!primary) return (
    <div className="space-y-4">
      <Link to="/beneficiaries" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={15} /> Back to beneficiaries
      </Link>
      <Empty text="This beneficiary isn't in your programme, or isn't available." />
    </div>
  )

  const completed = ivs.filter(i => i.status === 'completed').length
  const sponsorLabel = Array.from(new Set(lines.map(l => l.sponsor_name ?? l.client_name).filter(Boolean))).join(', ')
  const driveUrl = lines.map(l => l.drive_folder_url).find(Boolean)
  const emberUrl = lines.map(l => l.ember360_report_url).find(Boolean)

  return (
    <div className="space-y-6">
      <Link to="/beneficiaries" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={15} /> Back to beneficiaries
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl text-white">{primary.name}</h1>
            <RagPill rag={primary.rag} reason={primary.escalation_reason} />
          </div>
          <p className="mt-1 text-sm text-white/40">
            {[sponsorLabel, primary.aggregator_name].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
              {LIFECYCLE_LABEL[primary.lifecycle]}
            </span>
            <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-lime/80">
              {STAGE_LABEL[primary.stage]}
            </span>
            {lines.length > 1 && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                {lines.length} funding lines
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noreferrer" className="btn-ghost">
              <FolderOpen size={15} /> Drive folder
            </a>
          )}
          {emberUrl && (
            <a href={emberUrl} target="_blank" rel="noreferrer" className="btn-ghost">
              <FileText size={15} /> Ember360 report
            </a>
          )}
        </div>
      </header>

      {openEsc.length > 0 && (
        <div className="card border-flame/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-flame">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">Escalation open</span>
          </div>
          {openEsc.map(e => (
            <div key={e.id} className="text-[13px] text-white/70">
              {e.intervention_title}{e.reason ? ` — ${e.reason}` : ''}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info k="Invoice" v={lines.map(l => l.invoice_number).filter(Boolean).join(', ') || '—'} />
        <Info k="Budget" v={primary.budget != null ? `R${Number(primary.budget).toLocaleString('en-ZA')}` : '—'} />
        <Info k="SOW signed" v={fmtDate(primary.sow_signed_date)} />
        <Info k="Expected completion" v={fmtDate(primary.expected_completion)} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-white">Interventions</h2>
          {ivs.length > 0 && (
            <span className="text-[12px] text-white/50">{completed} of {ivs.length} complete</span>
          )}
        </div>
        {ivs.length === 0 ? (
          <Empty text="No interventions assigned yet." />
        ) : (
          <div className="space-y-2">
            {ivs.map((iv, i) => (
              <motion.div key={iv.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white">{iv.title}</span>
                    <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-white/50">{iv.category}</span>
                    <DiscoveryTag iv={iv} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/40">
                    <span>{STATUS_LABEL[iv.status]}</span>
                    {iv.due_date && <span>· Due {fmtDate(iv.due_date)}</span>}
                    <span>· Updated {timeAgo(iv.last_update_at)}</span>
                  </div>
                </div>
                <RagPill rag={iv.rag} reason={iv.rag_reason} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-white/25">
        Internal consultant notes and the UCA communication log are not shared in this view.
      </p>
    </div>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="card p-4">
      <div className="label">{k}</div>
      <div className="mt-1 text-sm text-white/80">{v}</div>
    </div>
  )
}
