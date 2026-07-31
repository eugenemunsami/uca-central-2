import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Flame, CheckCheck, Inbox, ClipboardCheck, ExternalLink, CornerUpLeft, Lock, Rocket } from 'lucide-react'
import { useData } from '../lib/useData'
import { useAuth } from '../context/AuthContext'
import { repo } from '../lib/repo'
import { RAG_HEX } from '../lib/rag'
import { ONB_STATUS_OWNER, ONB_OWNER_LABEL, ONB_TERMINAL, type BeneficiaryView } from '../lib/types'
import { Empty, Field, Modal, StatCard, timeAgo } from '../components/ui'
import EscalationDetail, { EscStatusPill } from '../components/EscalationDetail'
import { OnbStatusPill } from '../components/OnboardingDetail'

// Modal body for reviewing a beneficiary close-out sent to the client.
// Acknowledging concludes the job; sending back returns it to UCA to fix.
function CloseoutReview({ ben, userId, onDone }: {
  ben: BeneficiaryView; userId: string | null; onDone: () => void
}) {
  const [sendBack, setSendBack] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const acknowledge = async () => {
    setBusy(true)
    await repo.acknowledgeBeneficiaryCloseout(ben.id, userId)
    onDone()
  }
  const returnToUca = async () => {
    if (!notes.trim()) return
    setBusy(true)
    await repo.returnBeneficiaryCloseout(ben.id, userId, notes.trim())
    onDone()
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-white">{ben.name}</div>
        <div className="mt-0.5 text-sm text-white/40">{ben.sponsor_name ?? ben.client_name}</div>
      </div>

      <div className="rounded-xl border border-ink-500 bg-ink-900/50 p-4">
        <div className="label mb-2">Close-out report (proof of execution)</div>
        {ben.closeout_report_url ? (
          <a
            href={ben.closeout_report_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-lime hover:underline"
          >
            <ExternalLink size={14} /> Open the close-out report
          </a>
        ) : (
          <div className="text-sm text-white/40">No report link was attached.</div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-white/50">
        <span className="text-white/70">Acknowledge</span> to confirm the work is complete — the beneficiary
        moves to <span className="text-white/70">Concluded</span> and nothing further is required from UCA.
        <br />
        <span className="text-white/70">Send back</span> if something needs fixing — it returns to UCA with
        your notes and will be re-sent once resolved.
      </p>

      {!sendBack ? (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={acknowledge} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
            <CheckCheck size={14} className="mr-1.5 inline" /> Acknowledge — complete
          </button>
          <button onClick={() => setSendBack(true)} disabled={busy} className="btn-ghost text-sm disabled:opacity-50">
            <CornerUpLeft size={14} className="mr-1.5 inline" /> Send back to UCA
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-flame/30 bg-flame/5 p-4">
          <Field label="What needs to be fixed?" hint="Required — these notes go back to UCA.">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Describe what is outstanding or incorrect..."
              className="w-full resize-none rounded-lg border border-ink-500 bg-ink-900 p-3 text-sm text-white placeholder:text-white/25 focus:border-flame focus:outline-none"
            />
          </Field>
          <div className="flex items-center gap-3">
            <button
              onClick={returnToUca}
              disabled={busy || !notes.trim()}
              className="btn-primary text-sm disabled:opacity-40"
            >
              Send back to UCA
            </button>
            <button onClick={() => { setSendBack(false); setNotes('') }} disabled={busy} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientWork() {
  const { beneficiaries, escalations, notifications, onboardings, loading } = useData()
  const { user } = useAuth()

  // Read-only awareness of the onboarding pipeline for this aggregator/sponsor's cases.
  const myOnboarding = useMemo(() =>
    onboardings.filter(o =>
      !ONB_TERMINAL.includes(o.status) &&
      ((user?.external_sponsor_id && o.sponsor_id === user.external_sponsor_id) ||
        (user?.external_client_id && o.client_id === user.external_client_id)))
      .sort((a, b) => b.last_action_at.localeCompare(a.last_action_at)),
    [onboardings, user])
  const [openId, setOpenId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [bellOpen, setBellOpen] = useState(false)

  // Baton model: this external user is the operational OWNER when a case is
  // currently escalated to them. Only the owner can act.
  const needsAction = useMemo(() =>
    escalations
      .filter(e => e.current_owner_id === user?.id && e.status !== 'resolved')
      .sort((a, b) => b.last_action_at.localeCompare(a.last_action_at)),
    [escalations, user])

  // Cases they've been part of but no longer own — read-only awareness.
  const involved = useMemo(() =>
    escalations
      .filter(e => e.participants.includes(user?.id ?? '') && e.current_owner_id !== user?.id && e.status !== 'resolved')
      .sort((a, b) => b.last_action_at.localeCompare(a.last_action_at)),
    [escalations, user])

  const resolvedMine = useMemo(() =>
    escalations.filter(e => e.participants.includes(user?.id ?? '') && e.status === 'resolved'),
    [escalations, user])

  // Close-outs sent to this user awaiting their sign-off.
  const closeouts = useMemo(() =>
    beneficiaries
      .filter(b => b.recipient_ids.includes(user?.id ?? '') && b.lifecycle === 'closeout_sent')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [beneficiaries, user])
  const reviewBen = closeouts.find(b => b.id === reviewId) ?? null

  const myNotifs = useMemo(
    () => notifications
      .filter(n => n.user_id === user?.id)
      .sort((a, b) => b.at.localeCompare(a.at)),
    [notifications, user])
  const unread = myNotifs.filter(n => !n.read).length

  if (loading) return <div className="text-white/40">Loading...</div>

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">My work</h1>
          <p className="mt-1 text-sm text-white/40">
            Escalations that need you{user?.full_name ? `, ${user.full_name}` : ''}. Act on what you own, review a close-out, or track cases you're part of.
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative rounded-lg border border-ink-500 bg-ink-800 p-2.5 text-white/70 hover:text-white"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-flame px-1 text-[10px] font-semibold text-white">
                {unread}
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
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-white">
                    <Bell size={14} className="text-lime" /> Notifications
                  </span>
                  {unread > 0 && (
                    <button
                      onClick={() => user && repo.markAllNotificationsRead(user.id)}
                      className="text-[11px] text-lime hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {myNotifs.length === 0 ? (
                  <div className="text-xs text-white/30">Nothing here yet.</div>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {myNotifs.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) repo.markNotificationRead(n.id)
                          if (n.escalation_id) { setOpenId(n.escalation_id); setBellOpen(false) }
                        }}
                        className={`block w-full rounded-lg p-2.5 text-left text-xs ${n.read ? 'bg-ink-900/40 text-white/50' : 'bg-ink-900/70 text-white/80'}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-flame" />}
                          <span>{n.text}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-white/30">{timeAgo(n.at)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Close-outs to review" value={closeouts.length} accent={RAG_HEX.green}
          sub="need your sign-off" icon={<ClipboardCheck size={18} />} />
        <StatCard label="Needing your action" value={needsAction.length} accent={RAG_HEX.red}
          sub="you own these" icon={<Flame size={18} />} delay={0.05} />
        <StatCard label="Involved in" value={involved.length} accent="#7F77DD"
          sub="read-only" icon={<Inbox size={18} />} delay={0.1} />
        <StatCard label="Resolved" value={resolvedMine.length} accent={RAG_HEX.green}
          icon={<CheckCheck size={18} />} delay={0.15} />
      </div>

      {myOnboarding.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="rounded-2xl border border-ink-500 bg-ink-800/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Rocket size={16} className="text-lime" />
            <h2 className="text-sm text-white">Onboarding pipeline</h2>
            <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] text-lime">{myOnboarding.length}</span>
          </div>
          <p className="mb-3 text-xs text-white/50">Where your beneficiaries are in the pre-SOW journey. View-only — UCA records each step.</p>
          <div className="space-y-2">
            {myOnboarding.map(o => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-900/50 p-3">
                <div className="text-sm text-white/80">
                  <span className="text-white">{o.name}</span>
                  <span className="text-white/40"> · {o.sponsor_name}</span>
                  <div className="mt-0.5 text-[11px] text-white/40">
                    With {ONB_OWNER_LABEL[ONB_STATUS_OWNER[o.status]]} · last action {timeAgo(o.last_action_at)}
                  </div>
                </div>
                <OnbStatusPill status={o.status} />
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Close-outs to review — prominent, sits alongside escalations */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className={`rounded-2xl border p-5 ${closeouts.length > 0 ? 'border-lime/40 bg-lime/5' : 'border-ink-500 bg-ink-800/40'}`}
      >
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-lime" />
          <h2 className="text-sm text-white">Close-outs to review</h2>
          {closeouts.length > 0 && (
            <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[11px] font-semibold text-lime">{closeouts.length}</span>
          )}
        </div>
        {closeouts.length === 0 ? (
          <Empty text="No close-outs are waiting for your sign-off." />
        ) : (
          <>
            <p className="mb-4 text-xs text-white/50">
              UCA has completed the work and sent the proof of execution. Review each one and either
              acknowledge (which completes the job) or send it back to UCA to fix.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <AnimatePresence initial={false}>
                {closeouts.map((b, i) => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }}
                    transition={{ delay: i * 0.04 }}
                    className="card flex flex-col gap-3 border-lime/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white">{b.name}</div>
                        <div className="mt-0.5 text-sm text-white/50">{b.sponsor_name ?? b.client_name}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-medium text-lime">
                        Close-out
                      </span>
                    </div>
                    <button onClick={() => setReviewId(b.id)} className="btn-primary self-start text-xs">
                      Review close-out
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.section>

      {/* Escalations needing your action — you are the current owner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-flame/40 bg-flame/5 p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <Flame size={16} className="text-flame" />
          <h2 className="text-sm text-white">Escalations needing your action</h2>
          {needsAction.length > 0 && (
            <span className="rounded-full bg-flame/20 px-2 py-0.5 text-[11px] font-semibold text-flame">{needsAction.length}</span>
          )}
        </div>
        {needsAction.length === 0 ? (
          <Empty text="Nothing is waiting on you right now." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {needsAction.map((e, i) => (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: i * 0.04 }}
                  className="card flex flex-col gap-3 border-flame/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white">{e.beneficiary_name}</div>
                      <div className="mt-0.5 text-sm text-white/50">{e.intervention_title}</div>
                    </div>
                    <EscStatusPill status={e.status} />
                  </div>
                  <div className="text-xs text-white/50">{e.reason}</div>
                  <div className="text-[11px] text-white/30">Last action {timeAgo(e.last_action_at)}</div>
                  <button onClick={() => setOpenId(e.id)} className="btn-primary self-start text-xs">Open</button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {/* Escalations you're involved in — read-only, owned by someone else */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="card p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <Inbox size={16} className="text-lime" />
          <h2 className="text-sm text-white">Escalations you're involved in</h2>
          <span className="text-[11px] text-white/30">read-only</span>
          {involved.length > 0 && (
            <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] text-lime">{involved.length}</span>
          )}
        </div>
        {involved.length === 0 ? (
          <Empty text="You're not part of any other active escalations." />
        ) : (
          <div className="space-y-2">
            {involved.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-white">{e.beneficiary_name}</div>
                  <div className="mt-0.5 max-w-xl truncate text-xs text-white/40">{e.reason}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-white/30">
                    <Lock size={11} /> Owned by {e.owner_name ?? 'someone else'} · {timeAgo(e.last_action_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <EscStatusPill status={e.status} />
                  <button onClick={() => setOpenId(e.id)} className="btn-ghost text-xs">Open</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      <Modal open={openId !== null} onClose={() => setOpenId(null)} title="Escalation" wide>
        {openId && <EscalationDetail id={openId} onClose={() => setOpenId(null)} />}
      </Modal>

      <Modal open={reviewBen !== null} onClose={() => setReviewId(null)} title="Review close-out">
        {reviewBen && (
          <CloseoutReview ben={reviewBen} userId={user?.id ?? null} onDone={() => setReviewId(null)} />
        )}
      </Modal>
    </div>
  )
}
