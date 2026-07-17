import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, ArrowUpRight, PauseCircle, TrendingUp, Users } from 'lucide-react'
import { useData } from '../lib/useData'
import { RAG_HEX } from '../lib/rag'
import { FUNNEL_STAGES, STAGE_LABEL, type Rag } from '../lib/types'
import { Empty, RagPill, StatCard, timeAgo } from '../components/ui'
import { EscStatusPill } from '../components/EscalationDetail'

const tip = {
  contentStyle: { background: '#1A1A1A', border: '1px solid #3A3A3A', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#fff' },
}

export default function Dashboard() {
  const { beneficiaries, interventions, escalations, people, loading } = useData()
  const [tab, setTab] = useState('all')
  const [rag, setRag] = useState<'all' | Rag>('all')

  // One tab per distinct sponsor/aggregator (grouped by client_name), with counts.
  const clientTabs = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of beneficiaries) map.set(b.client_name, (map.get(b.client_name) ?? 0) + 1)
    return Array.from(map, ([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [beneficiaries])

  const live = beneficiaries.filter(b => b.lifecycle !== 'archived')
  const scoped = live.filter(b => tab === 'all' || b.client_name === tab)

  const rows = scoped
    .filter(b => rag === 'all' || b.rag === rag)
    .sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.rag] - { red: 0, amber: 1, green: 2 }[b.rag]))

  const counts: Record<Rag, number> = {
    green: scoped.filter(b => b.rag === 'green').length,
    amber: scoped.filter(b => b.rag === 'amber').length,
    red: scoped.filter(b => b.rag === 'red').length,
  }
  const donut = (['green', 'amber', 'red'] as Rag[])
    .map(r => ({ name: r, value: counts[r] })).filter(d => d.value > 0)

  // Funnel is the post-SOW delivery pipeline only.
  const funnel = FUNNEL_STAGES.map(s => ({
    stage: STAGE_LABEL[s],
    count: scoped.filter(b => b.stage === s).length,
  }))

  const byConsultant = people
    .filter(p => p.role === 'consultant')
    .map(p => {
      const mine = interventions.filter(i => i.consultant_id === p.id && i.status !== 'completed')
      return {
        name: p.full_name.split(' ')[0],
        green: mine.filter(i => i.rag === 'green').length,
        amber: mine.filter(i => i.rag === 'amber').length,
        red: mine.filter(i => i.rag === 'red').length,
      }
    })
    .filter(r => r.green + r.amber + r.red > 0)

  const open = escalations.filter(e => e.status !== 'resolved')
  const onHold = interventions.filter(i => i.status === 'on_hold' || i.status === 'awaiting_beneficiary')

  if (loading) return <div className="text-white/40">Loading...</div>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Exco dashboard</h1>
          <p className="mt-1 text-sm text-white/40">
            Every live beneficiary, scored against the playbook clocks.
          </p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={rag} onChange={e => setRag(e.target.value as never)}>
            <option value="all">All statuses</option>
            <option value="red">Red only</option>
            <option value="amber">Amber only</option>
            <option value="green">Green only</option>
          </select>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Live beneficiaries" value={scoped.length} icon={<Users size={20} />}
          sub={`${interventions.filter(i => i.status !== 'completed').length} open interventions`} delay={0} />
        <StatCard label="On track" value={counts.green} accent={RAG_HEX.green} icon={<TrendingUp size={20} />}
          sub="moving, no breach" delay={0.05} />
        <StatCard label="On hold" value={counts.amber} accent={RAG_HEX.amber} icon={<PauseCircle size={20} />}
          sub={`${onHold.length} blocked interventions`} delay={0.1} />
        <StatCard label="Escalate to client" value={counts.red} accent={RAG_HEX.red} icon={<AlertTriangle size={20} />}
          sub={`${open.length} open escalations`} delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-5">
          <div className="label mb-2">Portfolio health</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80}
                paddingAngle={3} stroke="none" animationDuration={900}>
                {donut.map(d => <Cell key={d.name} fill={RAG_HEX[d.name as Rag]} />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            {(['green', 'amber', 'red'] as Rag[]).map(r => (
              <span key={r} className="flex items-center gap-1.5 text-white/50">
                <span className="h-2 w-2 rounded-full" style={{ background: RAG_HEX[r] }} />
                {counts[r]}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="card p-5">
          <div className="label mb-2">Stage funnel</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 12, right: 12 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" width={92} tickLine={false} axisLine={false}
                tick={{ fill: '#ffffff66', fontSize: 11 }} />
              <Tooltip {...tip} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#19A06E" radius={[0, 4, 4, 0]} animationDuration={900} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card p-5">
          <div className="label mb-2">Load by consultant</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byConsultant} margin={{ left: -20 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#ffffff66', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#ffffff44', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tip} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="green" stackId="a" fill={RAG_HEX.green} animationDuration={900} barSize={22} />
              <Bar dataKey="amber" stackId="a" fill={RAG_HEX.amber} animationDuration={900} barSize={22} />
              <Bar dataKey="red" stackId="a" fill={RAG_HEX.red} radius={[4, 4, 0, 0]} animationDuration={900} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {open.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="card border-flame/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-flame">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">Escalated to client — {open.length}</span>
          </div>
          <div className="space-y-2">
            {open.map(e => (
              <Link key={e.id} to="/escalations"
                className="block rounded-lg bg-flame-soft px-3 py-2.5 transition-colors hover:bg-flame/20">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white">{e.beneficiary_name}</span>
                  <span className="flex items-center gap-3">
                    <EscStatusPill status={e.status} />
                    <ArrowUpRight size={14} className="text-flame" />
                  </span>
                </div>
                <div className="mt-1 max-w-2xl truncate text-xs text-white/60">{e.reason}</div>
                <div className="mt-0.5 text-[11px] text-white/35">
                  Owner: {e.owner_name ?? 'Unassigned'} · Last action {timeAgo(e.last_action_at)}
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg bg-ink-800 p-1">
        <button onClick={() => setTab('all')}
          className={`rounded-md px-4 py-2 text-sm transition-colors ${
            tab === 'all' ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
          All <span className="opacity-60">{beneficiaries.length}</span>
        </button>
        {clientTabs.map(t => (
          <button key={t.name} onClick={() => setTab(t.name)}
            className={`rounded-md px-4 py-2 text-sm transition-colors ${
              tab === t.name ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
            {t.name} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-600 text-[11px] uppercase tracking-wider text-white/35">
              <th className="p-4 font-medium">Beneficiary</th>
              <th className="p-4 font-medium">Sponsor / client</th>
              <th className="p-4 font-medium">Stage</th>
              <th className="p-4 font-medium">Project manager</th>
              <th className="p-4 font-medium">Last engaged</th>
              <th className="p-4 font-medium">Next action</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, idx) => (
              <motion.tr key={b.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 * idx }}
                className="border-b border-ink-600/60 last:border-0 hover:bg-ink-600/40">
                <td className="p-4">
                  <Link to={`/beneficiaries/${b.id}`} className="text-white hover:text-lime">{b.name}</Link>
                  <div className="text-[11px] text-white/30">
                    {b.completed_count}/{b.intervention_count} interventions done
                  </div>
                  {b.escalated && b.escalation_reason && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-flame">
                      <AlertTriangle size={11} />
                      <span className="max-w-[220px] truncate">{b.escalation_reason}</span>
                    </div>
                  )}
                </td>
                <td className="p-4 text-white/50">{b.sponsor_name ?? '-'}<div className="text-[11px] text-white/30">{b.client_name}</div></td>
                <td className="p-4 text-white/50">{STAGE_LABEL[b.stage]}</td>
                <td className="p-4 text-white/50">{b.pm_name ?? '-'}</td>
                <td className="p-4 text-white/50">{timeAgo(b.last_engagement_at)}</td>
                <td className="p-4 max-w-[220px] truncate text-white/50">{b.next_action ?? '-'}</td>
                <td className="p-4"><RagPill rag={b.rag} reason={b.escalation_reason} /></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-6"><Empty text="Nothing matches these filters." /></div>}
      </div>
    </div>
  )
}
