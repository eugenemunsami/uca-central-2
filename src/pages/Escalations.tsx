import { useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Lightbulb, Users } from 'lucide-react'
import { useData } from '../lib/useData'
import { ESC_STATUS_LABEL, ONB_ESC_STATUSES, ONB_STATUS_LABEL, type EscStatus } from '../lib/types'
import { Empty, Modal, timeAgo } from '../components/ui'
import EscalationDetail, { EscStatusPill } from '../components/EscalationDetail'
import OnboardingDetail, { OnbStatusPill } from '../components/OnboardingDetail'

// Order active escalations move through the ownership baton; shown top-to-bottom.
const ACTIVE_ORDER: EscStatus[] = [
  'returned_to_consultant', 'with_manco', 'with_sponsor',
  'returned_to_manco', 'resolution_submitted', 'outcome_to_consultant',
]

const roleLabel: Record<string, string> = {
  consultant: 'Consultant', manco: 'ManCo', external: 'Aggregator/Sponsor',
}

const truncate = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

export default function Escalations() {
  const { escalations, suggestions, onboardings, loading } = useData()
  const [viewId, setViewId] = useState<string | null>(null)
  const [onbId, setOnbId] = useState<string | null>(null)

  if (loading) return <div className="text-white/40">Loading...</div>

  const active = escalations.filter(e => e.status !== 'resolved')
  const resolved = escalations.filter(e => e.status === 'resolved')
  const onbEscalations = onboardings.filter(o => ONB_ESC_STATUSES.includes(o.status))

  // newest action first within each status group
  const sortActive = (es: typeof active) =>
    [...es].sort((a, b) => b.last_action_at.localeCompare(a.last_action_at))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl text-white">Escalations</h1>
        <p className="mt-1 text-sm text-white/40">
          Ownership-baton view. An escalation moves consultant → ManCo → Aggregator/Sponsor and back until
          the consultant accepts. Only the current owner can act; everyone else sees it read-only.
        </p>
      </header>

      {/* ---- Suggested (informational hint only) ---- */}
      {suggestions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-amberx" />
            <h2 className="text-sm text-white">Possible escalations</h2>
            <span className="rounded-full bg-amberx/15 px-2 py-0.5 text-[11px] text-amberx">{suggestions.length}</span>
          </div>
          <div className="rounded-xl border border-amberx/25 bg-amberx/5 p-4 text-[13px] text-white/60">
            These beneficiaries show breach signals. Escalations are now started from the beneficiary&apos;s
            intervention — open the beneficiary to raise one.
            <div className="mt-3 space-y-1.5">
              {suggestions.map(s => (
                <div key={s.key} className="text-[13px] text-white/70">
                  <span className="text-white">{s.beneficiary_name}</span>
                  <span className="text-white/30"> · </span>{s.intervention_title}
                  <span className="text-white/40"> — {s.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Active escalations, grouped by status ---- */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-flame" />
          <h2 className="text-sm text-white">Active escalations</h2>
          {active.length > 0 && (
            <span className="rounded-full bg-flame/15 px-2 py-0.5 text-[11px] text-flame">{active.length}</span>
          )}
        </div>
        {active.length === 0 ? (
          <Empty text="Nothing is escalated. Good week." />
        ) : (
          ACTIVE_ORDER.map(status => {
            const rows = sortActive(active.filter(e => e.status === status))
            if (rows.length === 0) return null
            return (
              <div key={status} className="space-y-2">
                <div className="label">{ESC_STATUS_LABEL[status]}</div>
                {rows.map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="card flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-white">{e.beneficiary_name}</span>
                        <span className="text-white/30">·</span>
                        <span className="text-sm text-white/60">{e.intervention_title}</span>
                        <EscStatusPill status={e.status} />
                      </div>
                      <div className="mt-0.5 text-sm text-white/50">{truncate(e.reason)}</div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        <span className="text-white/40">
                          <span className="text-white/25">Owner:</span>{' '}
                          {e.owner_name ?? 'unassigned'} ({roleLabel[e.current_owner_role] ?? e.current_owner_role})
                          {e.owner_org ? ` · ${e.owner_org}` : ''}
                        </span>
                        <span className="text-white/40">
                          <span className="text-white/25">Last action:</span> {timeAgo(e.last_action_at)}
                        </span>
                      </div>
                    </div>
                    <button className="btn-primary" onClick={() => setViewId(e.id)}>View / act</button>
                  </motion.div>
                ))}
              </div>
            )
          })
        )}
      </section>

      {/* ---- Onboarding escalations (from the pre-SOW pipeline) ---- */}
      {onbEscalations.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-flame" />
            <h2 className="text-sm text-white">Onboarding escalations</h2>
            <span className="rounded-full bg-flame/15 px-2 py-0.5 text-[11px] text-flame">{onbEscalations.length}</span>
          </div>
          {onbEscalations.map(o => (
            <div key={o.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white">{o.name}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-sm text-white/60">{o.client_name}</span>
                  <OnbStatusPill status={o.status} />
                </div>
                <div className="mt-2 text-[11px] text-white/40">
                  <span className="text-white/25">Onboarding · </span>{ONB_STATUS_LABEL[o.status]}
                  <span className="text-white/25"> · last action</span> {timeAgo(o.last_action_at)}
                </div>
              </div>
              <button className="btn-primary" onClick={() => setOnbId(o.id)}>View / act</button>
            </div>
          ))}
        </section>
      )}

      {/* ---- Resolved ---- */}
      {resolved.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <Users size={15} className="text-white/30" />
            <div className="label">Resolved</div>
          </div>
          {resolved.map(e => (
            <button key={e.id} onClick={() => setViewId(e.id)}
              className="card flex w-full items-center justify-between gap-3 p-3.5 text-left opacity-60 transition hover:opacity-100">
              <span className="text-sm text-white/70">{e.beneficiary_name} — {e.reason}</span>
              <span className="shrink-0 text-[11px] text-white/30">
                {e.time_to_resolve_days !== null
                  ? `resolved in ${e.time_to_resolve_days} day${e.time_to_resolve_days === 1 ? '' : 's'}`
                  : 'resolved'}
              </span>
            </button>
          ))}
        </section>
      )}

      {/* Detail / act modal */}
      <Modal open={Boolean(viewId)} onClose={() => setViewId(null)} title="Escalation" wide>
        {viewId && <EscalationDetail id={viewId} onClose={() => setViewId(null)} />}
      </Modal>
      <Modal open={Boolean(onbId)} onClose={() => setOnbId(null)} title="Onboarding ticket" wide>
        {onbId && <OnboardingDetail id={onbId} onClose={() => setOnbId(null)} />}
      </Modal>
    </div>
  )
}
