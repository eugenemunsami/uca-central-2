import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Clock, CheckCircle2, Sparkles, Eye,
  FileCheck2, PackageCheck, Archive, Flame, FileDown, Send,
} from 'lucide-react'
import { useData } from '../lib/useData'
import { useAuth } from '../context/AuthContext'
import { repo } from '../lib/repo'
import { RAG_HEX } from '../lib/rag'
import { categoryTint } from '../lib/palette'
import { STATUS_LABEL, type IvStatus, type InterventionView } from '../lib/types'

import { Empty, Field, Modal, RagPill, StatCard, fmtDate, timeAgo } from '../components/ui'
import EscalationDetail, { EscStatusPill } from '../components/EscalationDetail'

const ALL = '__all__'
const uniq = (xs: string[]) => Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b))
const isToday = (iso?: string | null) => {
  if (!iso) return false
  const d = new Date(iso); const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}
const isThisMonth = (iso?: string | null) => {
  if (!iso) return false
  const d = new Date(iso); const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

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

type StatFilter = 'open' | 'stale' | 'red' | null

// Escapes user-supplied text before it lands in the print-window HTML string.
const escHtml = (s?: string | null) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fmtLong = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function MyWork() {
  const { beneficiaries, interventions, updates, escalations, notifications, people, loading } = useData()
  const { user, can } = useAuth()

  const [fTitle, setFTitle] = useState(ALL)
  const [fBeneficiary, setFBeneficiary] = useState(ALL)
  const [fStatus, setFStatus] = useState(ALL)
  const [fSponsor, setFSponsor] = useState(ALL)
  const [stat, setStat] = useState<StatFilter>(null)
  const [bellOpen, setBellOpen] = useState(false)
  const [viewEsc, setViewEsc] = useState<string | null>(null)

  // Beneficiary close-out ("Produce & send") modal state.
  const [closeoutBen, setCloseoutBen] = useState<string | null>(null)
  const [reportUrl, setReportUrl] = useState('')
  const [closeoutNote, setCloseoutNote] = useState('')

  const sponsorOf = (bid: string) => beneficiaries.find(b => b.id === bid)?.client_name ?? null

  const isStale = (id: string, createdAt: string) => {
    const last = updates.filter(u => u.intervention_id === id)
      .sort((a, z) => z.created_at.localeCompare(a.created_at))[0]?.created_at ?? createdAt
    return Date.now() - new Date(last).getTime() > 7 * 86400000
  }

  // Everything assigned to me, freshly-assigned or not.
  const mineAll = useMemo(() => interventions
    .filter(i => i.consultant_id === user?.id)
    .sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.rag] - { red: 0, amber: 1, green: 2 }[b.rag])),
    [interventions, user])

  // New assignments still need acknowledging before they enter the main flow.
  const newAssignments = useMemo(() => mineAll.filter(i => !i.acknowledged), [mineAll])
  // The main list / stats / filters / due-bell only see acknowledged work.
  const mine = useMemo(() => mineAll.filter(i => i.acknowledged), [mineAll])

  const openIvs = mine.filter(i => i.status !== 'completed')
  const stale = openIvs.filter(i => isStale(i.id, i.created_at))
  const escalationRisk = openIvs.filter(i => i.rag === 'red')

  // Assigned today: freshly-assigned (unacknowledged) items dated today.
  const assignedToday = useMemo(
    () => mineAll.filter(i => !i.acknowledged && isToday(i.assigned_at)),
    [mineAll],
  )

  // Due this week: today through the next 7 days, not yet completed.
  const dueThisWeek = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
    return mine
      .filter(i => i.status !== 'completed' && i.due_date)
      .filter(i => {
        const d = new Date(i.due_date as string)
        return d >= today && d <= weekEnd
      })
      .sort((a, z) => (a.due_date as string).localeCompare(z.due_date as string))
  }, [mine])

  // Unread notifications for me, newest first. (No kind filtering — new close-out
  // kinds show here alongside everything else.)
  const myNotifications = useMemo(
    () => notifications
      .filter(n => n.user_id === user?.id && !n.read)
      .sort((a, b) => b.at.localeCompare(a.at)),
    [notifications, user],
  )

  const bellCount = assignedToday.length + dueThisWeek.length + myNotifications.length

  // Baton escalations where I am the current owner and must act.
  const escNeedsAction = useMemo(
    () => escalations.filter(e => e.current_owner_id === user?.id && e.status !== 'resolved'),
    [escalations, user],
  )

  // Baton escalations I've owned/acted on but that now sit with someone else (read-only).
  const escInvolved = useMemo(
    () => escalations.filter(e =>
      e.participants.includes(user?.id ?? '') && e.current_owner_id !== user?.id && e.status !== 'resolved'),
    [escalations, user],
  )

  // ManCo close-out approvals across the WHOLE portfolio.
  const closeoutRequests = useMemo(
    () => interventions.filter(i => i.closeout_status === 'requested'),
    [interventions],
  )

  // ManCo: beneficiaries ready for a beneficiary-level close-out report.
  const pendingCloseouts = useMemo(
    () => (can('manage') ? beneficiaries.filter(b => b.lifecycle === 'pending_closeout') : []),
    [beneficiaries, can],
  )

  // ManCo: beneficiaries the client has acknowledged this cycle.
  const concludedBens = useMemo(
    () => (can('manage') ? beneficiaries.filter(b => b.lifecycle === 'concluded') : []),
    [beneficiaries, can],
  )

  const closeoutTarget = closeoutBen ? beneficiaries.find(b => b.id === closeoutBen) ?? null : null

  const submitCloseout = async () => {
    if (!closeoutBen || !user || !reportUrl.trim()) return
    await repo.submitBeneficiaryCloseout(closeoutBen, user.id, reportUrl.trim(), closeoutNote.trim() || undefined)
    setCloseoutBen(null); setReportUrl(''); setCloseoutNote('')
  }

  // Month-end extract: a print-ready window listing every beneficiary concluded in the
  // CURRENT calendar month. Mirrors the evidence-pack styling (lime brand bar, Arial, print CSS).
  const extractMonthEnd = () => {
    const now = new Date()
    const monthLabel = now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    const concluded = beneficiaries
      .filter(b => b.lifecycle === 'concluded' && isThisMonth(b.concluded_at))
      .sort((a, z) => (a.concluded_at ?? '').localeCompare(z.concluded_at ?? ''))

    const rows = concluded.map(b => {
      const ivCount = interventions.filter(i => i.beneficiary_id === b.id && !i.cancelled).length
      const link = b.closeout_report_url
        ? `<a href="${escHtml(b.closeout_report_url)}">Open report</a>`
        : '<span class="empty">—</span>'
      return `<tr>
        <td>${escHtml(b.name)}</td>
        <td>${escHtml(b.client_name)}${b.sponsor_name ? ' &middot; ' + escHtml(b.sponsor_name) : ''}</td>
        <td>${escHtml(b.pm_name ?? 'unassigned')}</td>
        <td>${fmtLong(b.concluded_at)}</td>
        <td style="text-align:center">${ivCount}</td>
        <td>${link}</td>
      </tr>`
    }).join('')

    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Month-end close-outs — ${escHtml(monthLabel)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 32px; line-height: 1.5; }
        .bar { height: 6px; background: #9FD150; margin-bottom: 18px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .sub { color: #555; font-size: 12px; margin-bottom: 4px; }
        table.log { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 12px; }
        table.log th { background: #f4f4f2; text-align: left; padding: 6px 8px; font-size: 11px; }
        table.log td { border-top: 1px solid #eee; padding: 6px 8px; vertical-align: top; }
        table.log a { color: #19A06E; }
        .empty { color: #999; }
        .foot { margin-top: 30px; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 8px; }
        @media print { body { margin: 14mm; } }
      </style></head><body>
      <div class="bar"></div>
      <h1>Month-end close-outs — ${escHtml(monthLabel)}</h1>
      <div class="sub">Beneficiaries concluded (client-acknowledged) this month · ${concluded.length} total</div>
      <div class="sub">Generated ${fmtLong(new Date().toISOString())}</div>
      <table class="log">
        <thead><tr>
          <th>Beneficiary</th><th>Client / sponsor</th><th>Project manager</th>
          <th>Concluded</th><th>Interventions</th><th>Close-out report</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="empty">No beneficiaries concluded this month.</td></tr>'}</tbody>
      </table>
      <div class="foot">UCA Central — month-end close-out extract. Archive these beneficiaries once filed.</div>
      <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
      </body></html>`

    const w = window.open('', '_blank')
    if (!w) { alert('Please allow pop-ups to extract the month-end PDF.'); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  const titleOpts = uniq(mine.map(i => i.title)).map(v => ({ value: v, label: v }))
  const benOpts = uniq(mine.map(i => i.beneficiary_name)).map(v => ({ value: v, label: v }))
  const sponsorOpts = uniq(mine.map(i => sponsorOf(i.beneficiary_id)).filter((v): v is string => Boolean(v)))
    .map(v => ({ value: v, label: v }))
  const statusOpts = uniq(mine.map(i => i.status))
    .map(v => ({ value: v, label: STATUS_LABEL[v as IvStatus] }))

  const list = mine.filter(i => {
    if (fTitle !== ALL && i.title !== fTitle) return false
    if (fBeneficiary !== ALL && i.beneficiary_name !== fBeneficiary) return false
    if (fStatus !== ALL && i.status !== fStatus) return false
    if (fSponsor !== ALL && sponsorOf(i.beneficiary_id) !== fSponsor) return false
    if (stat === 'open' && i.status === 'completed') return false
    if (stat === 'stale' && !(i.status !== 'completed' && isStale(i.id, i.created_at))) return false
    if (stat === 'red' && !(i.status !== 'completed' && i.rag === 'red')) return false
    return true
  })

  if (loading) return <div className="text-white/40">Loading...</div>

  const toggleStat = (s: StatFilter) => setStat(prev => (prev === s ? null : s))

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">My work</h1>
        </div>

        <div className="relative">
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative rounded-lg border border-ink-500 bg-ink-800 p-2.5 text-white/70 hover:text-white"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {bellCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-semibold text-ink-900">
                {bellCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-ink-500 bg-ink-800 p-4 shadow-xl"
              >
                <div className="mb-3 flex items-center gap-2 text-sm text-white">
                  <Sparkles size={14} className="text-lime" /> Assigned today
                </div>
                {assignedToday.length === 0 ? (
                  <div className="text-xs text-white/30">Nothing new assigned today.</div>
                ) : (
                  <div className="space-y-2">
                    {assignedToday.map(i => (
                      <Link
                        key={i.id}
                        to={`/beneficiaries/${i.beneficiary_id}`}
                        onClick={() => setBellOpen(false)}
                        className="block rounded-lg bg-ink-900/60 p-2.5 text-xs text-white/70 hover:text-white"
                      >
                        <span className="text-white/90">{i.beneficiary_name}</span> — {i.title}
                        <div className="mt-0.5 text-[11px] text-white/40">assigned {fmtDate(i.assigned_at)}</div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="my-3 h-px bg-ink-500" />

                <div className="mb-3 flex items-center gap-2 text-sm text-white">
                  <Bell size={14} className="text-lime" /> Due this week
                </div>
                {dueThisWeek.length === 0 ? (
                  <div className="text-xs text-white/30">Nothing due this week.</div>
                ) : (
                  <div className="space-y-2">
                    {dueThisWeek.map(i => (
                      <Link
                        key={i.id}
                        to={`/beneficiaries/${i.beneficiary_id}`}
                        onClick={() => setBellOpen(false)}
                        className="block rounded-lg bg-ink-900/60 p-2.5 text-xs text-white/70 hover:text-white"
                      >
                        <span className="text-white/90">{i.beneficiary_name}</span> — {i.title}
                        <div className="mt-0.5 text-[11px] text-white/40">due {fmtDate(i.due_date)}</div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="my-3 h-px bg-ink-500" />

                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Bell size={14} className="text-lime" /> Notifications
                  </div>
                  {myNotifications.length > 0 && user && (
                    <button
                      onClick={() => repo.markAllNotificationsRead(user.id)}
                      className="text-[11px] text-lime hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {myNotifications.length === 0 ? (
                  <div className="text-xs text-white/30">You're all caught up.</div>
                ) : (
                  <div className="space-y-2">
                    {myNotifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => repo.markNotificationRead(n.id)}
                        className="block w-full rounded-lg bg-ink-900/60 p-2.5 text-left text-xs text-white/70 hover:text-white"
                      >
                        <div className="flex items-start gap-2">
                          {n.action_required && (
                            <span className="mt-0.5 shrink-0 rounded-full bg-flame/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-flame">
                              Action
                            </span>
                          )}
                          <span className="flex-1">{n.text}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/40">{timeAgo(n.at)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatToggle active={stat === 'open'} onClick={() => toggleStat('open')}>
          <StatCard label="Open interventions" value={openIvs.length} />
        </StatToggle>
        <StatToggle active={stat === 'stale'} onClick={() => toggleStat('stale')}>
          <StatCard label="Needs an update" value={stale.length} accent={RAG_HEX.amber}
            sub="no log in 7+ days" delay={0.05} />
        </StatToggle>
        <StatToggle active={stat === 'red'} onClick={() => toggleStat('red')}>
          <StatCard label="Escalation risk" value={escalationRisk.length}
            accent={RAG_HEX.red} sub="breached or overdue" delay={0.1} />
        </StatToggle>
      </div>

      {can('manage') && closeoutRequests.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-lime" />
            <h2 className="text-sm text-white">Close-out requests</h2>
            <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] text-lime">{closeoutRequests.length}</span>
          </div>
          <div className="space-y-2">
            {closeoutRequests.map(i => (
              <CloseoutRequestRow key={i.id} i={i} userId={user?.id ?? null}
                who={people.find(p => p.id === i.closeout_requested_by)?.full_name ?? 'a consultant'} />
            ))}
          </div>
        </motion.section>
      )}

      {pendingCloseouts.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card border-lime/30 p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileCheck2 size={16} className="text-lime" />
            <h2 className="text-sm text-white">Close-outs to approve</h2>
            <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] text-lime">{pendingCloseouts.length}</span>
          </div>
          <p className="mb-3 text-[11px] text-white/40">
            Every intervention is closed out. Produce the POE / close-out report and send it to the client for acknowledgement.
          </p>
          <div className="space-y-2">
            {pendingCloseouts.map(b => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 p-3">
                <div className="text-sm text-white/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white">{b.name}</span>
                    <span className="text-[11px] text-white/40">
                      {b.client_name}{b.sponsor_name ? ' · ' + b.sponsor_name : ''}
                    </span>
                    {b.all_interventions_closed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-lime/15 px-2 py-0.5 text-[10px] text-lime">
                        <CheckCircle2 size={11} /> All interventions closed
                      </span>
                    )}
                  </div>
                  {b.closeout_return_notes && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-flame">
                      <Flame size={13} className="mt-0.5 shrink-0" />
                      <span>Returned by client: {b.closeout_return_notes}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setCloseoutBen(b.id); setReportUrl(''); setCloseoutNote('') }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-xs font-medium text-ink-900 hover:opacity-90"
                >
                  <Send size={13} /> Produce &amp; send close-out
                </button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {concludedBens.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PackageCheck size={16} className="text-lime" />
              <h2 className="text-sm text-white">Concluded this month</h2>
              <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] text-lime">{concludedBens.length}</span>
            </div>
            <button
              onClick={extractMonthEnd}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 bg-ink-800 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white"
            >
              <FileDown size={13} /> Extract month-end PDF
            </button>
          </div>
          <div className="space-y-2">
            {concludedBens.map(b => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 p-3">
                <div className="text-sm text-white/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white">{b.name}</span>
                    <span className="text-[11px] text-white/40">
                      {b.client_name}{b.sponsor_name ? ' · ' + b.sponsor_name : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/40">Concluded {fmtDate(b.concluded_at)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => user && repo.archiveBeneficiary(b.id, user.id)}
                    disabled={b.lifecycle !== 'concluded'}
                    title="Archiving files this beneficiary away and frees a repeat beneficiary to be re-onboarded later."
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 bg-ink-900 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white disabled:opacity-40"
                  >
                    <Archive size={13} /> Archive
                  </button>
                  <span className="text-[10px] text-white/30">Frees a repeat beneficiary to re-onboard</span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {escNeedsAction.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card border-flame/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Flame size={16} className="text-flame" />
            <h2 className="text-sm text-white">Escalations needing your action</h2>
            <span className="rounded-full bg-flame/15 px-2 py-0.5 text-[11px] text-flame">{escNeedsAction.length}</span>
          </div>
          <p className="mb-3 text-[11px] text-white/40">The ownership baton is with you — open each one to act.</p>
          <div className="space-y-2">
            {escNeedsAction.map(e => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 p-3">
                <div className="min-w-0 text-sm text-white/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white">{e.beneficiary_name}</span>
                    <span className="text-[11px] text-white/40">{e.intervention_title}</span>
                    <EscStatusPill status={e.status} />
                  </div>
                  <div className="mt-0.5 text-[12px] text-white/50">{e.reason}</div>
                </div>
                <button className="btn-primary" onClick={() => setViewEsc(e.id)}>View / act</button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {escInvolved.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Eye size={16} className="text-white/40" />
            <h2 className="text-sm text-white">Escalations you&apos;re involved in</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">{escInvolved.length}</span>
          </div>
          <p className="mb-3 text-[11px] text-white/40">Read-only — the baton is currently with someone else.</p>
          <div className="space-y-2">
            {escInvolved.map(e => (
              <button key={e.id} onClick={() => setViewEsc(e.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 p-3 text-left transition hover:bg-ink-700">
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                  <span className="text-white">{e.beneficiary_name}</span>
                  <span className="text-[11px] text-white/40">{e.intervention_title}</span>
                  <EscStatusPill status={e.status} />
                </div>
                <span className="text-[11px] text-white/40">with {e.owner_name ?? 'unassigned'}</span>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      <AnimatePresence>
        {newAssignments.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-lime/40 bg-lime/5 p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-lime" />
              <h2 className="text-sm text-white">New projects</h2>
              <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[11px] font-semibold text-lime">{newAssignments.length}</span>
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {newAssignments.map(i => {
                  const tint = categoryTint(i.category)
                  return (
                    <motion.div
                      key={i.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className="flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-lg p-3"
                      style={{ background: tint.bg, borderLeft: `3px solid ${tint.border}` }}
                    >
                      <div className="text-sm text-white/80">
                        <span className="text-white" style={{ color: tint.text }}>{i.beneficiary_name}</span> — {i.title}
                        <div className="mt-0.5 text-[11px] text-white/40">assigned {fmtDate(i.assigned_at)}</div>
                      </div>
                      <button
                        onClick={() => repo.acknowledgeIntervention(i.id)}
                        className="rounded-lg bg-lime px-3 py-1.5 text-xs font-medium text-ink-900 hover:opacity-90"
                      >
                        Acknowledge
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-3">
        <Select value={fTitle} onChange={setFTitle} options={titleOpts} allLabel="All interventions" />
        <Select value={fBeneficiary} onChange={setFBeneficiary} options={benOpts} allLabel="All beneficiaries" />
        <Select value={fStatus} onChange={setFStatus} options={statusOpts} allLabel="All statuses" />
        <Select value={fSponsor} onChange={setFSponsor} options={sponsorOpts} allLabel="All sponsors" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((i, idx) => {
          const tint = categoryTint(i.category)
          return (
            <motion.div key={i.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}>
              <Link to={`/beneficiaries/${i.beneficiary_id}`} className="card card-hover block p-5"
                style={{ background: tint.bg, borderLeft: `3px solid ${tint.border}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-white" style={{ color: tint.text }}>{i.title}</div>
                    <div className="mt-0.5 text-xs text-white/40">{i.beneficiary_name} · {i.category}</div>
                  </div>
                  <RagPill rag={i.rag} reason={i.rag_reason} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/40">
                  <span>{STATUS_LABEL[i.status]}</span>
                  <span>Due {fmtDate(i.due_date)}</span>
                  <span>Updated {timeAgo(i.last_update_at)}</span>
                </div>
                {i.days_awaiting !== null && i.status !== 'completed' && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px]"
                    style={{ color: i.days_awaiting >= 3 ? RAG_HEX.red : RAG_HEX.amber }}>
                    <Clock size={12} /> {i.days_awaiting}/3 working days awaiting beneficiary
                  </div>
                )}
              </Link>
            </motion.div>
          )
        })}
      </div>
      {list.length === 0 && <Empty text={mine.length === 0 ? 'Nothing assigned to you yet.' : 'No interventions match these filters.'} />}

      <Modal open={Boolean(viewEsc)} onClose={() => setViewEsc(null)} title="Escalation" wide>
        {viewEsc && <EscalationDetail id={viewEsc} onClose={() => setViewEsc(null)} />}
      </Modal>

      <Modal open={Boolean(closeoutBen)} onClose={() => setCloseoutBen(null)} title="Produce & send close-out">
        {closeoutTarget && (
          <div>
            <p className="mb-4 text-sm text-white/60">
              Produce the POE / close-out report for <span className="text-white">{closeoutTarget.name}</span> and drop it in the
              Drive folder. On send, the report goes to <span className="text-white">{closeoutTarget.client_name}</span>'s contacts
              for acknowledgement.
            </p>
            {closeoutTarget.closeout_return_notes && (
              <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-flame/10 p-3 text-[12px] text-flame">
                <Flame size={13} className="mt-0.5 shrink-0" />
                <span>Returned by client: {closeoutTarget.closeout_return_notes}</span>
              </div>
            )}
            <Field label="POE / close-out report Drive link" hint="Required — paste the shareable Drive link to the report.">
              <input
                value={reportUrl}
                onChange={e => setReportUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm text-white/90 focus:border-lime focus:outline-none"
              />
            </Field>
            <Field label="Note to client (optional)">
              <textarea
                value={closeoutNote}
                onChange={e => setCloseoutNote(e.target.value)}
                rows={3}
                placeholder="Anything the client should know before acknowledging."
                className="w-full rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm text-white/90 focus:border-lime focus:outline-none"
              />
            </Field>
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setCloseoutBen(null)}
                className="rounded-lg border border-ink-500 px-4 py-2 text-sm text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={submitCloseout}
                disabled={!reportUrl.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-sm font-medium text-ink-900 hover:opacity-90 disabled:opacity-40"
              >
                <Send size={14} /> Produce &amp; send
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function StatToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`block rounded-2xl text-left transition ${active ? 'ring-2 ring-lime' : 'ring-0'}`}
    >
      {children}
    </button>
  )
}

// A single row in the ManCo "Close-out requests" queue: verify & confirm, or return to the
// consultant with a reason (previously the return was only reachable from the intervention page).
function CloseoutRequestRow({ i, userId, who }: { i: InterventionView; userId: string | null; who: string }) {
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <div className="rounded-lg bg-ink-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/80">
          <span className="text-white">{i.beneficiary_name}</span> — {i.title}
          <div className="mt-0.5 text-[11px] text-white/40">Requested by {who}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => repo.confirmCloseout(i.id, userId)}
            className="rounded-lg bg-lime px-3 py-1.5 text-xs font-medium text-ink-900 hover:opacity-90"
          >
            Verify &amp; confirm
          </button>
          <button
            onClick={() => setReturning(v => !v)}
            className="rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            Return
          </button>
        </div>
      </div>
      {returning && (
        <div className="mt-3 rounded-md bg-ink-900/60 p-3">
          <textarea
            className="input h-16 w-full resize-none"
            placeholder="Reason for returning — sent to the consultant so they can fix and resubmit."
            value={reason} onChange={e => setReason(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => { setReturning(false); setReason('') }}>Cancel</button>
            <button className="btn-danger" disabled={!reason.trim()}
              onClick={async () => { await repo.returnCloseout(i.id, userId, reason.trim()); setReturning(false); setReason('') }}>
              Return to consultant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
