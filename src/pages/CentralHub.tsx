import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Bug, Lightbulb, Search, ChevronDown, Trash2, LifeBuoy, Send, CheckCircle2,
  Compass, LayoutDashboard, Users, Rocket, Briefcase, AlertTriangle, Settings, Building2,
  ClipboardCheck, KeyRound, ListChecks, ScrollText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { repo, subscribe } from '../lib/repo'
import { useAuth } from '../context/AuthContext'
import type { Feedback, FeedbackKind, Role } from '../lib/types'
import { FEEDBACK_STATUS_LABEL, FEEDBACK_PRIORITY_LABEL } from '../lib/types'
import { Empty, Field } from '../components/ui'

// ---------------- Help manual content (tailored per role) ----------------
// Each topic declares which roles it's relevant to; the manual only shows a user the topics that
// apply to them. Content is plain data so it's easy to keep accurate as the app evolves.
interface HelpSection { heading?: string; text?: string; steps?: string[] }
interface HelpTopic { id: string; title: string; icon: LucideIcon; roles: Role[]; summary: string; body: HelpSection[] }

const ALL: Role[] = ['exco', 'manco', 'consultant', 'external']
const INTERNAL: Role[] = ['exco', 'manco', 'consultant']
const MANAGERS: Role[] = ['exco', 'manco']

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'welcome', title: 'Welcome to UCA Central', icon: Compass, roles: ALL,
    summary: 'What this app is and how it fits into the UCA programme.',
    body: [
      { text: 'UCA Central is the operations hub for The Unconventional CA. It tracks SMME beneficiaries from a sponsor’s invoice, through onboarding and a signed Scope of Works, into live delivery of interventions, escalations, and close-out reporting — across aggregators (like BEE123) and the sponsors beneath them.' },
      { text: 'What you see is tailored to your role. This Help section only shows guidance relevant to you, and the left-hand menu only lists the areas you have access to.' },
    ],
  },
  {
    id: 'navigation', title: 'Finding your way around', icon: LayoutDashboard, roles: ALL,
    summary: 'The left-hand menu, live updates, and where things live.',
    body: [
      { text: 'Everything is reached from the menu on the left. Your name and role sit at the bottom, with a Sign out button.' },
      { text: 'UCA Central updates live. When a colleague changes something you’re looking at, your screen refreshes on its own within a moment — you rarely need to reload the page.' },
      { heading: 'If a section is missing', text: 'A manager can switch individual sections on or off per person. If you expect to see something and don’t, ask a ManCo member to check your section access in Admin.' },
    ],
  },
  {
    id: 'dashboard', title: 'The Central Dashboard', icon: LayoutDashboard, roles: INTERNAL,
    summary: 'Programme health at a glance, and the onboarding pipeline summary.',
    body: [
      { text: 'The Dashboard opens on a live picture of the whole programme: how beneficiaries are tracking (green / amber / red), open interventions by type, and a summary of the onboarding pipeline.' },
      { text: 'Use the client filter above the charts to narrow everything to a single aggregator or sponsor.' },
    ],
  },
  {
    id: 'beneficiaries', title: 'Beneficiaries & funding lines', icon: Users, roles: INTERNAL,
    summary: 'How a business can span several sponsors, and how cards are grouped.',
    body: [
      { text: 'A beneficiary is a business receiving support. Because one business can be funded by several sponsors or invoices, each funding line is tracked separately but grouped under the business.' },
      { text: 'Consultants see a single card per business, with every intervention together and tagged by its funder. Exco, ManCo and funders see the funding lines separately.' },
      { heading: 'Opening a beneficiary', text: 'Click any beneficiary to see its details: contacts, the Google Drive folder, its interventions, the communication log folded into an activity timeline, and its funding lines. From here you can link a line to an existing business or manage close-out.' },
    ],
  },
  {
    id: 'mywork', title: 'My Work: interventions & updates', icon: Briefcase, roles: INTERNAL,
    summary: 'Your personal queue — what’s assigned to you and what needs action.',
    body: [
      { text: 'My Work is your personal queue. It splits what’s ongoing from what’s completed, and surfaces anything waiting on you: interventions to acknowledge, discovery checks, weekly updates due, and close-out requests to action.' },
      { heading: 'Weekly updates', text: 'Keep each active intervention current with a short weekly update — what’s done, what’s in progress, any blocker (and who owns it), and the next action. These drive the RAG status and keep everyone aligned.' },
    ],
  },
  {
    id: 'discovery', title: 'Discovery links & when timers start', icon: ListChecks, roles: INTERNAL,
    summary: 'The discovery-form gate that pauses SLA/RAG timers until it clears.',
    body: [
      { text: 'Many interventions include a discovery form (a Google Form embedded in the SOW) that the beneficiary fills in first. A ManCo member sets that link when the intervention is created.' },
      { text: 'After you acknowledge an intervention, My Work shows a Discovery check. Confirm whether the beneficiary completed the form, or mark it Not Applicable if there is none.' },
      { heading: 'Why it matters', text: 'The SLA and RAG timers for an intervention only start once its discovery phase clears. If the form isn’t done yet, log a follow-up or escalate — the clock stays paused so you’re not penalised for a delay outside your control.' },
    ],
  },
  {
    id: 'closeout', title: 'Requesting & approving close-outs', icon: ClipboardCheck, roles: INTERNAL,
    summary: 'The consultant → ManCo verify chain, and beneficiary close-out.',
    body: [
      { heading: 'As a consultant', text: 'When an intervention is finished, request a close-out from My Work. It moves to a ManCo member to verify. Attach the outputs (Drive subfolder) and confirm the close-out email to the beneficiary was sent.' },
      { heading: 'As a ManCo member', text: 'Close-out requests appear in your My Work. Confirm to approve, or Return with a reason to send it back to the consultant. When every intervention on a beneficiary is confirmed, the beneficiary becomes ready for close-out — you then produce and send the POE report to the client for sign-off.' },
    ],
  },
  {
    id: 'onboarding', title: 'Onboarding & welcome parties', icon: Rocket, roles: INTERNAL,
    summary: 'The pre-SOW pipeline from invoice to a signed Scope of Works.',
    body: [
      { text: 'Onboarding runs a beneficiary from a sponsor’s invoice request through to a signed SOW, at which point it converts into a beneficiary in Central. It’s an ownership-baton flow: the ticket moves between Exco, ManCo, Consultant and the Aggregator/Sponsor, and only the current owner can act.' },
      { text: 'Stages cover intake, the Ember360 report (load / review / revision), the welcome party, attendance, and sending the SOW. Welcome parties carry an MS Teams registration link and attendance is recorded by ManCo or Exco.' },
      { heading: 'Escalating', text: 'An onboarding ticket can be escalated at any stage — directly between the consultant or ManCo and the aggregator/sponsor — without a separate approval step.' },
    ],
  },
  {
    id: 'escalations', title: 'Escalations', icon: AlertTriangle, roles: ALL,
    summary: 'How issues are raised, owned, and resolved along the chain.',
    body: [
      { text: 'An escalation flags an intervention that needs attention up the chain. It uses an ownership baton: it moves consultant → ManCo → aggregator/sponsor and back, and only the current owner can act — everyone else sees it, locked, for visibility.' },
      { text: 'Every step is time-stamped in the escalation’s history, and the people involved are notified. You’ll see escalations that involve you highlighted in your own space.' },
    ],
  },
  {
    id: 'portal', title: 'Your Portal', icon: Building2, roles: ['external'],
    summary: 'The read-only view of your programme’s progress and health.',
    body: [
      { text: 'The Portal is your read-only window on your programme. It shows your beneficiaries, their stage and progress, cohort health, when each was last engaged, and anything escalated that involves you.' },
      { text: 'Internal consultant notes and the UCA communication log are not shown here — the Portal is a clean, client-facing view.' },
    ],
  },
  {
    id: 'signoff', title: 'Signing off a close-out', icon: ClipboardCheck, roles: ['external'],
    summary: 'What to do when a close-out is ready for your approval.',
    body: [
      { text: 'When UCA completes a beneficiary and produces its proof-of-execution report, it’s sent to you for sign-off. You’ll see a prompt on your Portal and the item in My Work.' },
      { text: 'Open it in My Work to review and acknowledge. Once you sign off, the beneficiary is marked concluded for that period.' },
    ],
  },
  {
    id: 'admin', title: 'Admin: users, programmes & sections', icon: Settings, roles: MANAGERS,
    summary: 'Managing accounts, aggregators/sponsors, the catalogue, and per-user access.',
    body: [
      { heading: 'Users', text: 'Create and invite users, set their vertical (role), link external users to an aggregator or sponsor, reset passwords, suspend, hide or delete accounts, and review each person’s activity history.' },
      { heading: 'Sections', text: 'The Sections button on any user opens per-person visibility switches. You can hide a section that a user’s role would otherwise see — role is always the ceiling, so you can never grant access a role doesn’t allow. My Work stays available to everyone.' },
      { heading: 'Programmes & catalogue', text: 'Add aggregators and the sponsors beneath them, and manage the intervention catalogue (the predefined services offered, with default owners).' },
      { heading: 'Bugs & Ideas', text: 'The feedback everyone logs here lands in the Admin review list, where you can prioritise, star, resolve or delete it.' },
    ],
  },
  {
    id: 'accounts', title: 'Accounts, passwords & getting help', icon: KeyRound, roles: ALL,
    summary: 'Signing in, resetting your password, and who to contact.',
    body: [
      { text: 'You sign in with your email and password. First time in, or if you’ve forgotten your password, choose “First time here, or forgot your password?” on the login screen and follow the steps to set your own.' },
      { text: 'If invite or reset emails don’t arrive (some corporate mail filters block them), ask a ManCo member — they can set you a temporary password to get you in, then you set your own.' },
      { heading: 'Something not working?', text: 'Use the Bugs & Ideas tab in this Central Hub to report a problem or suggest an improvement. It goes straight to the team.' },
    ],
  },
]

function matchesQuery(t: HelpTopic, q: string) {
  if (!q) return true
  const hay = (t.title + ' ' + t.summary + ' ' + t.body.map(b => `${b.heading ?? ''} ${b.text ?? ''} ${(b.steps ?? []).join(' ')}`).join(' ')).toLowerCase()
  return hay.includes(q)
}

function HelpManual({ role }: { role: Role }) {
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const topics = useMemo(
    () => HELP_TOPICS.filter(t => t.roles.includes(role)).filter(t => matchesQuery(t, q.trim().toLowerCase())),
    [role, q])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input className="input w-full pl-9" placeholder="Search the guide…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {topics.length === 0 ? (
        <Empty text="Nothing in the guide matches that. Try a different word." />
      ) : (
        <div className="space-y-2">
          {topics.map((t, i) => {
            const open = openId === t.id
            const Icon = t.icon
            return (
              <motion.section key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }} className="card overflow-hidden p-0">
                <button onClick={() => setOpenId(open ? null : t.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-600/40">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime-soft text-lime">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white">{t.title}</span>
                    <span className="block truncate text-[12px] text-white/40">{t.summary}</span>
                  </span>
                  <ChevronDown size={18} className="shrink-0 text-white/40 transition-transform"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="space-y-3 border-t border-ink-600 px-5 py-4">
                        {t.body.map((s, si) => (
                          <div key={si}>
                            {s.heading && <div className="mb-1 text-[13px] font-medium text-lime">{s.heading}</div>}
                            {s.text && <p className="text-[13px] leading-relaxed text-white/70">{s.text}</p>}
                            {s.steps && (
                              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-white/70">
                                {s.steps.map((st, sti) => <li key={sti}>{st}</li>)}
                              </ol>
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
    </div>
  )
}

// ---------------- Bugs & Lightbulbs ----------------
const STATUS_HEX: Record<string, string> = {
  open: '#F5B942', in_progress: '#5AA9E6', resolved: '#9FD150', dismissed: '#8A94A6',
}
function StatusPill({ status }: { status: Feedback['status'] }) {
  const hex = STATUS_HEX[status] ?? '#8A94A6'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${hex}1f`, color: hex }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
      {FEEDBACK_STATUS_LABEL[status]}
    </span>
  )
}

function BugsAndIdeas({ mine, onChanged }: { mine: Feedback[]; onChanged: () => void }) {
  const { user, can } = useAuth()
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [area, setArea] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await repo.addFeedback(
        { kind, title, detail, area },
        { id: user?.id ?? null, name: user?.full_name ?? null, role: user?.role ?? null },
      )
      setTitle(''); setDetail(''); setArea(''); setKind('bug')
      setDone(true)
      setTimeout(() => setDone(false), 3500)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="card p-5">
        <div className="mb-4 flex rounded-lg bg-ink-800 p-1">
          {(['bug', 'lightbulb'] as FeedbackKind[]).map(k => {
            const active = kind === k
            const Icon = k === 'bug' ? Bug : Lightbulb
            return (
              <button key={k} onClick={() => setKind(k)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? (k === 'bug' ? 'bg-flame/20 text-flame' : 'bg-lime text-ink-900') : 'text-white/50 hover:text-white'}`}>
                <Icon size={15} /> {k === 'bug' ? 'Report a bug' : 'Suggest an idea'}
              </button>
            )
          })}
        </div>

        <Field label={kind === 'bug' ? 'What went wrong?' : 'What’s your idea?'}>
          <input className="input" value={title} maxLength={140}
            placeholder={kind === 'bug' ? 'e.g. Close-out button does nothing on King Logistics' : 'e.g. Let me filter beneficiaries by consultant'}
            onChange={e => setTitle(e.target.value)} />
        </Field>
        <Field label="More detail" hint="Optional — steps to reproduce a bug, or why an idea would help.">
          <textarea className="input h-28 resize-none" value={detail} onChange={e => setDetail(e.target.value)} />
        </Field>
        <Field label="Which part of the app?" hint="Optional — e.g. My Work, Onboarding, Portal.">
          <input className="input" value={area} onChange={e => setArea(e.target.value)}
            placeholder="Dashboard, Beneficiaries, My Work…" />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence>
            {done && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[13px] text-lime">
                <CheckCircle2 size={15} /> Thanks — sent to the team.
              </motion.span>
            )}
          </AnimatePresence>
          <button className="btn-primary ml-auto disabled:opacity-40" disabled={saving || !title.trim()} onClick={submit}>
            <Send size={15} /> {saving ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm text-white/70">Your submissions</h3>
          {can('manage') && <span className="text-[11px] text-white/30">Manage everyone’s in Admin → Bugs & Ideas</span>}
        </div>
        {mine.length === 0 ? (
          <Empty text="You haven’t logged anything yet. Bugs and ideas you send show up here." />
        ) : (
          <div className="space-y-2">
            {mine.map(f => (
              <div key={f.id} className="card flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={f.kind === 'bug' ? 'text-flame' : 'text-lime'}>
                      {f.kind === 'bug' ? <Bug size={14} /> : <Lightbulb size={14} />}
                    </span>
                    <span className="truncate text-sm text-white">{f.title}</span>
                  </div>
                  {f.detail && <p className="mt-1 line-clamp-2 text-[12px] text-white/45">{f.detail}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={f.status} />
                    {f.area && <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-white/50">{f.area}</span>}
                    {f.priority !== 'none' && (
                      <span className="text-[10px] uppercase tracking-wider text-white/35">
                        {FEEDBACK_PRIORITY_LABEL[f.priority]} priority
                      </span>
                    )}
                  </div>
                  {f.admin_note && (
                    <p className="mt-2 rounded-lg bg-ink-800 px-2.5 py-1.5 text-[12px] text-white/60">
                      <span className="text-lime">Reply:</span> {f.admin_note}
                    </p>
                  )}
                </div>
                <button className="shrink-0 text-white/25 hover:text-flame" title="Withdraw this submission"
                  onClick={async () => { await repo.deleteFeedback(f.id); onChanged() }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OperatingManual() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-900">
      <iframe
        src="/uca-operating-manual.html"
        title="UCA Operating Manual"
        className="block w-full"
        style={{ height: 'calc(100vh - 220px)', minHeight: 560, border: 0 }}
      />
    </div>
  )
}

export default function CentralHub() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'help' | 'manual' | 'feedback'>('help')
  const [all, setAll] = useState<Feedback[]>([])

  const load = () => repo.feedback().then(setAll).catch(() => setAll([]))
  useEffect(() => {
    load()
    const unsub = subscribe(load)
    return () => { unsub() }
  }, [])

  const mine = useMemo(() => all.filter(f => f.author_id === user?.id), [all, user])
  if (!user) return null

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime-soft text-lime"><LifeBuoy size={22} /></span>
        <div>
          <h1 className="text-2xl text-white">Central Hub</h1>
          <p className="mt-0.5 text-sm text-white/40">Your guide to UCA Central — and where to report bugs or share ideas.</p>
        </div>
      </header>

      <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
        <button onClick={() => setTab('help')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${
            tab === 'help' ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
          <BookOpen size={15} /> UCA Central Help
        </button>
        <button onClick={() => setTab('manual')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${
            tab === 'manual' ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
          <ScrollText size={15} /> UCA Operating Manual
        </button>
        <button onClick={() => setTab('feedback')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${
            tab === 'feedback' ? 'bg-lime text-ink-900' : 'text-white/50 hover:text-white'}`}>
          <Lightbulb size={15} /> Bugs &amp; Ideas
        </button>
      </div>

      {tab === 'help' ? <HelpManual role={user.role} /> : tab === 'manual' ? <OperatingManual /> : <BugsAndIdeas mine={mine} onChanged={load} />}
    </div>
  )
}
