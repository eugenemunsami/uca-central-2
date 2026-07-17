import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertTriangle, PauseCircle, TrendingUp, ClipboardCheck, ArrowRight } from 'lucide-react'
import { useData } from '../lib/useData'
import { useAuth } from '../context/AuthContext'
import { RAG_HEX } from '../lib/rag'
import { STAGE_LABEL, LIFECYCLE_LABEL, type Rag, type BeneLifecycle } from '../lib/types'
import { Empty, RagPill, StatCard, timeAgo } from '../components/ui'
import { EscStatusPill } from '../components/EscalationDetail'

// Active work sorts first; concluded / archived sink to the bottom of the table.
const LIFECYCLE_ORDER: Record<BeneLifecycle, number> = {
  active: 0, pending_closeout: 1, closeout_sent: 2, concluded: 3, archived: 4,
}

export default function Portal() {
  const { beneficiaries, interventions, escalations, loading } = useData()
  const { user } = useAuth()

  const scoped = useMemo(() => beneficiaries
    .filter(b =>
      (user?.external_client_id && b.client_id === user.external_client_id) ||
      (user?.external_sponsor_id && b.sponsor_id === user.external_sponsor_id))
    .sort((a, b) => LIFECYCLE_ORDER[a.lifecycle] - LIFECYCLE_ORDER[b.lifecycle]),
    [beneficiaries, user])

  // Close-outs sent to this user that still need their sign-off in My work.
  const closeoutsForMe = useMemo(
    () => scoped.filter(b => b.lifecycle === 'closeout_sent' && b.recipient_ids.includes(user?.id ?? '')),
    [scoped, user])

  // Baton-model: open escalations this user is a participant in, within their scope.
  const involved = useMemo(
    () => escalations.filter(e =>
      e.participants.includes(user?.id ?? '') &&
      e.status !== 'resolved' &&
      scoped.some(b => b.id === e.beneficiary_id)),
    [escalations, scoped, user])

  if (loading) return <div className="text-white/40">Loading...</div>

  const counts: Record<Rag, number> = {
    green: scoped.filter(b => b.rag === 'green').length,
    amber: scoped.filter(b => b.rag === 'amber').length,
    red: scoped.filter(b => b.rag === 'red').length,
  }
  const donut = (['green', 'amber', 'red'] as Rag[])
    .map(r => ({ name: r, value: counts[r] })).filter(d => d.value > 0)
  const ivs = interventions.filter(i => scoped.some(b => b.id === i.beneficiary_id))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl text-white">{user?.full_name}</h1>
        <p className="mt-1 text-sm text-white/40">
          Read-only view of your programme. Progress, blockers and anything escalated to you.
        </p>
      </header>

      {closeoutsForMe.length > 0 && (
        <Link
          to="/my-work"
          className="flex items-center justify-between gap-3 rounded-xl border border-lime/40 bg-lime/5 px-4 py-3 transition hover:bg-lime/10"
        >
          <span className="flex items-center gap-2.5 text-sm text-white">
            <ClipboardCheck size={16} className="text-lime" />
            {closeoutsForMe.length === 1
              ? `A close-out for ${closeoutsForMe[0].name} is ready for your sign-off.`
              : `${closeoutsForMe.length} close-outs are ready for your sign-off.`}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-lime">
            Review in My work <ArrowRight size={14} />
          </span>
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Beneficiaries" value={scoped.length}
          sub={`${ivs.filter(i => i.status === 'completed').length}/${ivs.length} interventions closed`} />
        <StatCard label="On track" value={counts.green} accent={RAG_HEX.green} icon={<TrendingUp size={20} />} delay={0.05} />
        <StatCard label="On hold" value={counts.amber} accent={RAG_HEX.amber} icon={<PauseCircle size={20} />} delay={0.1} />
        <StatCard label="Involving you" value={involved.length} accent={RAG_HEX.red}
          icon={<AlertTriangle size={20} />} delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="card p-5">
          <div className="label mb-2">Cohort health</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75}
                paddingAngle={3} stroke="none" animationDuration={900}>
                {donut.map(d => <Cell key={d.name} fill={RAG_HEX[d.name as Rag]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #3A3A3A', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-600 text-[11px] uppercase tracking-wider text-white/35">
                <th className="p-4 font-medium">Beneficiary</th>
                <th className="p-4 font-medium">Stage</th>
                <th className="p-4 font-medium">Close-out</th>
                <th className="p-4 font-medium">Progress</th>
                <th className="p-4 font-medium">Last engaged</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {scoped.map((b, i) => (
                <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }} className="border-b border-ink-600/60 last:border-0">
                  <td className="p-4 text-white">{b.name}</td>
                  <td className="p-4 text-white/50">{STAGE_LABEL[b.stage]}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                      b.lifecycle === 'concluded' ? 'bg-lime/15 text-lime'
                      : b.lifecycle === 'closeout_sent' ? 'bg-amberx/15 text-amberx'
                      : b.lifecycle === 'archived' ? 'bg-ink-700 text-white/40'
                      : 'bg-ink-700 text-white/60'}`}>
                      {LIFECYCLE_LABEL[b.lifecycle]}
                    </span>
                  </td>
                  <td className="p-4 text-white/50">{b.completed_count}/{b.intervention_count}</td>
                  <td className="p-4 text-white/50">{timeAgo(b.last_engagement_at)}</td>
                  <td className="p-4"><RagPill rag={b.rag} reason={b.escalation_reason} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {scoped.length === 0 && <div className="p-6"><Empty text="No beneficiaries in your programme yet." /></div>}
        </div>
      </div>

      {involved.length > 0 && (
        <div className="card border-flame/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-flame">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">Escalated to you</span>
          </div>
          <div className="space-y-2">
            {involved.map(e => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-flame-soft px-4 py-3">
                <span className="text-sm text-white">{e.beneficiary_name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-[11px] text-white/40">Owner: {e.owner_name ?? '-'}</span>
                  <EscStatusPill status={e.status} />
                  <span className="text-[11px] text-white/30">{timeAgo(e.last_action_at)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/25">
        Internal consultant notes and the UCA communication log are not shared in this view.
      </p>
    </div>
  )
}
