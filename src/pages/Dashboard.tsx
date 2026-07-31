import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  AlertTriangle, ArrowUpRight, PauseCircle, TrendingUp, Users, Rocket, CheckCircle2, Ban, CalendarDays,
} from 'lucide-react'
import { useData } from '../lib/useData'
import { RAG_HEX } from '../lib/rag'
import {
  FUNNEL_STAGES, STAGE_LABEL, ONB_ACTIVE_ORDER, ONB_STATUS_LABEL, ONB_STATUS_OWNER, ONB_OWNER_LABEL,
  type Rag, type OnbOwnerRole, type OnboardingView, type WelcomeParty, type WelcomePartyInvite,
} from '../lib/types'
import { Empty, RagPill, StatCard, timeAgo, fmtDate } from '../components/ui'
import { EscStatusPill } from '../components/EscalationDetail'
import { OnbStatusPill } from '../components/OnboardingDetail'

const tip = {
  contentStyle: { background: '#1A1A1A', border: '1px solid #3A3A3A', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#fff' },
}

export default function Dashboard() {
  const { beneficiaries, interventions, escalations, people, onboardings, welcomeParties, welcomePartyInvites, loading } = useData()
  const [tab, setTab] = useState('all')
  const [rag, setRag] = useState<'all' | Rag>('all')
  const [view, setView] = useState<'delivery' | 'onboarding'>('delivery')

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

  // Open interventions grouped by type (e.g. "5-page website", "Business card design"), scoped to
  // the selected client filter. Long type names are shown in full on a horizontal bar chart.
  const scopedIds = new Set(scoped.map(b => b.id))
  const openByType = Object.entries(
    interventions
      .filter(i => i.status !== 'completed' && !i.cancelled && scopedIds.has(i.beneficiary_id))
      .reduce((m, i) => { m[i.title] = (m[i.title] ?? 0) + 1; return m }, {} as Record<string, number>),
  ).map(([name, count]) => ({ name, count })).sort((a, z) => z.count - a.count)
  const noInterventions = scoped.filter(b => b.intervention_count === 0).length

  if (loading) return <div className="text-white/40">Loading...</div>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Central Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
            <button onClick={() => setView('delivery')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${view === 'delivery' ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
              Delivery
            </button>
            <button onClick={() => setView('onboarding')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${view === 'onboarding' ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
              <Rocket size={14} /> Onboarding
            </button>
          </div>
          {view === 'delivery' && (
            <select className="input w-auto" value={rag} onChange={e => setRag(e.target.value as never)}>
              <option value="all">All statuses</option>
              <option value="red">Red only</option>
              <option value="amber">Amber only</option>
              <option value="green">Green only</option>
            </select>
          )}
        </div>
      </header>

      {view === 'onboarding' && (
        <OnboardingSummary onboardings={onboardings} welcomeParties={welcomeParties} welcomePartyInvites={welcomePartyInvites} />
      )}

      {view === 'delivery' && <>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Live beneficiaries" value={scoped.length} icon={<Users size={20} />}
          sub={`${interventions.filter(i => i.status !== 'completed').length} open interventions`} delay={0} />
        <StatCard label="On track" value={counts.green} accent={RAG_HEX.green} icon={<TrendingUp size={20} />}
          sub="moving, no breach" delay={0.05} />
        <StatCard label="On hold" value={counts.amber} accent={RAG_HEX.amber} icon={<PauseCircle size={20} />}
          sub={`${onHold.length} blocked interventions`} delay={0.1} />
        <StatCard label="Escalate to client" value={counts.red} accent={RAG_HEX.red} icon={<AlertTriangle size={20} />}
          sub={`${open.length} open escalations`} delay={0.15} />
        <StatCard label="No interventions yet" value={noInterventions} accent="#7F77DD" icon={<Ban size={20} />}
          sub="beneficiaries awaiting scoping" delay={0.2} />
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

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
        className="card p-5">
        <div className="label mb-3">Open interventions by type</div>
        {openByType.length === 0 ? (
          <Empty text="No open interventions in this view." />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, openByType.length * 30)}>
            <BarChart data={openByType} layout="vertical" margin={{ left: 12, right: 24 }}>
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}
                tick={{ fill: '#ffffff44', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={220} tickLine={false} axisLine={false}
                tick={{ fill: '#ffffff99', fontSize: 11 }} interval={0} />
              <Tooltip {...tip} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#5E8C1E" radius={[0, 4, 4, 0]} animationDuration={900} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

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
      </>}
    </div>
  )
}

const OWNER_HEX: Record<OnbOwnerRole, string> = {
  exco: '#F5B942', manco: '#4C93E8', consultant: '#7F77DD', external: '#19A06E',
}

function OnboardingSummary({ onboardings, welcomeParties, welcomePartyInvites }: {
  onboardings: OnboardingView[]
  welcomeParties: WelcomeParty[]
  welcomePartyInvites: WelcomePartyInvite[]
}) {
  const active = onboardings.filter(o => o.status !== 'converted' && o.status !== 'withdrawn')
  const red = active.filter(o => o.is_red)
  const converted = onboardings.filter(o => o.status === 'converted')
  const withdrawn = onboardings.filter(o => o.status === 'withdrawn')

  const byStage = ONB_ACTIVE_ORDER
    .map(s => ({ stage: ONB_STATUS_LABEL[s], count: active.filter(o => o.status === s).length }))
    .filter(d => d.count > 0)

  const owners: OnbOwnerRole[] = ['exco', 'manco', 'consultant', 'external']
  const byOwner = owners
    .map(r => ({ role: r, label: ONB_OWNER_LABEL[r], count: active.filter(o => ONB_STATUS_OWNER[o.status] === r).length }))
    .filter(d => d.count > 0)
  const maxOwner = Math.max(1, ...byOwner.map(d => d.count))

  const upcoming = [...welcomeParties]
    .filter(w => w.party_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.party_date.localeCompare(b.party_date))
    .slice(0, 4)

  if (onboardings.length === 0) return <Empty text="No onboarding tickets yet." />

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="In the pipeline" value={active.length} icon={<Rocket size={20} />}
          sub={`${onboardings.length} tickets in total`} delay={0} />
        <StatCard label="At risk" value={red.length} accent={RAG_HEX.red} icon={<AlertTriangle size={20} />}
          sub="2 welcome parties missed" delay={0.05} />
        <StatCard label="Converted" value={converted.length} accent={RAG_HEX.green} icon={<CheckCircle2 size={20} />}
          sub="SOW signed → in Central" delay={0.1} />
        <StatCard label="Withdrawn" value={withdrawn.length} accent="#888780" icon={<Ban size={20} />}
          sub="dropped out at onboarding" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-5 lg:col-span-1">
          <div className="label mb-3">Where tickets sit</div>
          {byOwner.length === 0 ? <Empty text="Nothing active." /> : (
            <div className="space-y-3">
              {byOwner.map(d => (
                <div key={d.role}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-white/60">{d.label}</span>
                    <span className="text-white/40">{d.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-700">
                    <div className="h-2 rounded-full" style={{ width: `${(d.count / maxOwner) * 100}%`, background: OWNER_HEX[d.role] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="card p-5 lg:col-span-2">
          <div className="label mb-2">Pipeline by stage</div>
          {byStage.length === 0 ? <Empty text="Nothing active." /> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={byStage} layout="vertical" margin={{ left: 12, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="stage" width={150} tickLine={false} axisLine={false}
                  tick={{ fill: '#ffffff66', fontSize: 11 }} />
                <Tooltip {...tip} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="count" fill="#9FD150" radius={[0, 4, 4, 0]} animationDuration={900} barSize={13} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-lime" />
            <span className="text-sm text-white">Upcoming welcome parties</span>
          </div>
          {upcoming.length === 0 ? <Empty text="No welcome parties scheduled." /> : (
            <div className="space-y-2">
              {upcoming.map(w => {
                const inv = welcomePartyInvites.filter(i => i.welcome_party_id === w.id)
                return (
                  <div key={w.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-2.5">
                    <div>
                      <div className="text-sm text-white">{fmtDate(w.party_date)}</div>
                      {w.title && <div className="text-[11px] text-white/35">{w.title}</div>}
                    </div>
                    <div className="text-[11px] text-white/40">
                      {inv.length} invited · {inv.filter(i => i.status === 'attended').length} attended · {inv.filter(i => i.status === 'no_show').length} no-show
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className={`card p-5 ${red.length ? 'border-flame/40' : ''}`}>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className={red.length ? 'text-flame' : 'text-white/30'} />
            <span className="text-sm text-white">Needs attention — {red.length}</span>
          </div>
          {red.length === 0 ? <Empty text="Nothing at risk. Good." /> : (
            <div className="space-y-2">
              {red.map(o => (
                <Link key={o.id} to="/onboarding"
                  className="flex items-center justify-between gap-3 rounded-lg bg-flame-soft px-3 py-2.5 transition-colors hover:bg-flame/20">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{o.name}</div>
                    <div className="text-[11px] text-white/40">{o.client_name} · {o.missed_welcome_parties} missed</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <OnbStatusPill status={o.status} />
                    <ArrowUpRight size={14} className="text-flame" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="text-right">
        <Link to="/onboarding" className="inline-flex items-center gap-1 text-sm text-lime hover:underline">
          Open the Onboarding tab <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  )
}
