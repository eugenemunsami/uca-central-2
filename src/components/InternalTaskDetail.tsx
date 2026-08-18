import { useState } from 'react'
import { CheckCircle2, Circle, Plus, Trash2, CornerUpLeft, Send, MessageSquare, Clock, Tag } from 'lucide-react'
import { useData } from '../lib/useData'
import { useAuth } from '../context/AuthContext'
import { repo } from '../lib/repo'
import { TASK_STATUS_LABEL, TASK_PRIORITY_LABEL, fmtMinutes, type TaskStatus, type TaskPriority } from '../lib/types'
import { Modal, Empty, fmtDate } from './ui'

const STATUS_CLS: Record<TaskStatus, string> = {
  open: 'bg-white/10 text-white/60',
  in_progress: 'bg-lime/15 text-lime',
  submitted: 'bg-amberx/15 text-amberx',
  done: 'bg-jade/15 text-jade',
}
const PRIORITY_CLS: Record<TaskPriority, string> = {
  high: 'bg-flame/15 text-flame',
  medium: 'bg-amberx/15 text-amberx',
  low: 'bg-white/10 text-white/50',
}

// The shared task detail + action panel. Reused by the Internal Tasks page and My Work.
// Actions shown depend on the viewer's relationship to the task (requester vs assignee) and its status.
export default function InternalTaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, people } = useData()
  const { user } = useAuth()
  const task = tasks.find(t => t.id === taskId)

  const [busy, setBusy] = useState(false)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [newSub, setNewSub] = useState('')

  // Close-out: "Mark done" opens a panel asking how long the task took before it can be submitted.
  // On a re-submit after a send-back the boxes pre-fill with whatever was logged last time, so the
  // assignee adjusts it to the new running total rather than starting from scratch.
  const [closing, setClosing] = useState(false)
  const [hrs, setHrs] = useState('')
  const [mins, setMins] = useState('')

  if (!task) return null

  const openCloseOut = () => {
    const prev = task.time_minutes ?? 0
    setHrs(prev ? String(Math.floor(prev / 60)) : '')
    setMins(prev % 60 ? String(prev % 60) : '')
    setClosing(true)
  }
  const cancelCloseOut = () => { setClosing(false); setHrs(''); setMins('') }
  // Blank counts as zero; anything non-numeric or negative counts as zero too, so the button
  // simply stays disabled rather than writing rubbish.
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0 }
  const totalMinutes = num(hrs) * 60 + num(mins)
  const minsInvalid = num(mins) > 59
  const canSubmitCloseOut = totalMinutes > 0 && !minsInvalid

  const nameOf = (id?: string | null) => people.find(p => p.id === id)?.full_name ?? '—'
  const isRequester = user?.id === task.requester_id
  const isAssignee = user?.id === task.assignee_id
  const isExco = user?.role === 'exco'
  const canManage = isRequester || isExco
  const doneSubs = task.subtasks.filter(s => s.done).length

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }

  return (
    <Modal open onClose={onClose} title={task.title} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] ${STATUS_CLS[task.status]}`}>{TASK_STATUS_LABEL[task.status]}</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] ${PRIORITY_CLS[task.priority]}`}>{TASK_PRIORITY_LABEL[task.priority]} priority</span>
          {task.category && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
              <Tag size={11} /> {task.category}
            </span>
          )}
          {task.due_date && <span className="rounded-full bg-ink-700 px-2.5 py-1 text-[11px] text-white/50">Due {fmtDate(task.due_date)}</span>}
          {fmtMinutes(task.time_minutes) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-jade/15 px-2.5 py-1 text-[11px] text-jade">
              <Clock size={11} /> {fmtMinutes(task.time_minutes)} logged
            </span>
          )}
        </div>

        <div className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div><span className="text-white/30">Requested by </span><span className="text-white/80">{nameOf(task.requester_id)}</span></div>
          <div><span className="text-white/30">Assigned to </span><span className="text-white/80">{nameOf(task.assignee_id)}</span></div>
        </div>

        {task.detail && <p className="whitespace-pre-wrap rounded-lg bg-ink-900/50 p-3 text-[13px] text-white/70">{task.detail}</p>}

        {task.return_reason && task.status !== 'done' && (
          <div className="rounded-lg border border-flame/40 bg-flame/5 p-3 text-[13px] text-white/70">
            <span className="text-flame">Sent back: </span>{task.return_reason}
          </div>
        )}

        {/* Sub-tasks */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm text-white">Sub-tasks</h3>
            {task.subtasks.length > 0 && <span className="text-[12px] text-white/40">{doneSubs}/{task.subtasks.length}</span>}
          </div>
          <div className="space-y-1.5">
            {task.subtasks.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-[13px]">
                <button onClick={() => run(() => repo.toggleSubtask(s.id, !s.done))} className="text-white/50 hover:text-lime" aria-label="Toggle">
                  {s.done ? <CheckCircle2 size={16} className="text-lime" /> : <Circle size={16} />}
                </button>
                <span className={s.done ? 'text-white/35 line-through' : 'text-white/75'}>{s.title}</span>
                {canManage && (
                  <button onClick={() => run(() => repo.deleteSubtask(s.id))} className="ml-auto text-white/20 hover:text-flame" aria-label="Delete sub-task">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {task.status !== 'done' && (
            <div className="mt-2 flex gap-2">
              <input className="input flex-1" placeholder="Add a sub-task" value={newSub}
                onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newSub.trim()) { run(() => repo.addSubtask(task.id, newSub.trim())); setNewSub('') } }} />
              <button className="btn-ghost" disabled={!newSub.trim() || busy}
                onClick={() => { run(() => repo.addSubtask(task.id, newSub.trim())); setNewSub('') }}>
                <Plus size={15} /> Add
              </button>
            </div>
          )}
        </section>

        {/* Comments / notes */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare size={15} className="text-lime" />
            <h3 className="text-sm text-white">Notes &amp; comments</h3>
            {task.comments.length > 0 && <span className="text-[12px] text-white/40">{task.comments.length}</span>}
          </div>
          <div className="space-y-2">
            {task.comments.length === 0 && <p className="text-[12px] text-white/30">No comments yet.</p>}
            {task.comments.map(c => (
              <div key={c.id} className="rounded-lg bg-ink-900/50 p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/40">
                  <span>{nameOf(c.author_id)}</span><span>{fmtDate(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-[13px] text-white/75">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="input flex-1" placeholder="Add a note or comment" value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { run(() => repo.addTaskComment(task.id, user?.id ?? null, comment.trim())); setComment('') } }} />
            <button className="btn-ghost" disabled={!comment.trim() || busy}
              onClick={() => { run(() => repo.addTaskComment(task.id, user?.id ?? null, comment.trim())); setComment('') }}>
              <Send size={15} /> Post
            </button>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-600 pt-4">
          {isAssignee && task.status === 'open' && !closing && (
            <button className="btn-ghost" disabled={busy} onClick={() => run(() => repo.startTask(task.id))}>Start work</button>
          )}
          {isAssignee && (task.status === 'open' || task.status === 'in_progress') && !closing && (
            <button className="btn-primary" disabled={busy} onClick={openCloseOut}>
              <Send size={15} /> Mark done
            </button>
          )}
          {isRequester && task.status === 'submitted' && !returning && (
            <>
              {fmtMinutes(task.time_minutes) && (
                <span className="text-[12px] text-white/50">
                  {nameOf(task.assignee_id)} logged <span className="text-jade">{fmtMinutes(task.time_minutes)}</span>.
                </span>
              )}
              <button className="btn-primary" disabled={busy} onClick={() => run(() => repo.verifyTask(task.id))}>
                <CheckCircle2 size={15} /> Verify &amp; complete
              </button>
              <button className="btn-ghost" onClick={() => setReturning(true)}><CornerUpLeft size={15} /> Send back</button>
            </>
          )}
          {isAssignee && task.status === 'submitted' && (
            <span className="text-[12px] text-white/40">Awaiting {nameOf(task.requester_id)}'s verification.</span>
          )}
          {task.status === 'done' && (
            <span className="text-[12px] text-jade">
              Completed{task.verified_at ? ` · verified ${fmtDate(task.verified_at)}` : ''}
              {fmtMinutes(task.time_minutes) ? ` · ${fmtMinutes(task.time_minutes)} logged` : ''}.
            </span>
          )}
          {canManage && (
            <button className="ml-auto text-[12px] text-white/25 hover:text-flame" disabled={busy}
              onClick={() => run(async () => { await repo.deleteTask(task.id); onClose() })}>
              Delete task
            </button>
          )}
        </div>

        {/* Close-out: time taken is required before the task can be submitted. */}
        {closing && (
          <div className="rounded-lg border border-lime/40 bg-lime/5 p-3">
            <div className="flex items-center gap-2 text-[13px] text-white">
              <Clock size={15} className="text-lime" />
              How long did this take you?
            </div>
            <p className="mt-1 text-[12px] text-white/40">
              {task.time_minutes
                ? 'Adjust this to the total time on the task, including the work you have just redone.'
                : 'Required to close the task out. Your best estimate of total time spent is fine.'}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-[12px] text-white/50">
                Hours
                <input className="input mt-1 w-20" type="number" min={0} max={99} inputMode="numeric"
                  value={hrs} onChange={e => setHrs(e.target.value)} placeholder="0" />
              </label>
              <label className="text-[12px] text-white/50">
                Minutes
                <input className="input mt-1 w-20" type="number" min={0} max={59} inputMode="numeric"
                  value={mins} onChange={e => setMins(e.target.value)} placeholder="0" />
              </label>
              {totalMinutes > 0 && !minsInvalid && (
                <span className="pb-2 text-[12px] text-jade">= {fmtMinutes(totalMinutes)}</span>
              )}
              {minsInvalid && <span className="pb-2 text-[12px] text-flame">Minutes must be under 60 — use the hours box.</span>}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn-ghost" onClick={cancelCloseOut}>Cancel</button>
              <button className="btn-primary" disabled={!canSubmitCloseOut || busy}
                onClick={() => run(async () => { await repo.submitTask(task.id, totalMinutes); cancelCloseOut() })}>
                <Send size={15} /> {isRequester ? 'Log time & complete' : 'Log time & submit'}
              </button>
            </div>
          </div>
        )}

        {returning && (
          <div className="rounded-lg border border-ink-600 bg-ink-900/50 p-3">
            <textarea className="input min-h-[80px] w-full" placeholder="Reason for sending it back…"
              value={reason} onChange={e => setReason(e.target.value)} />
            <div className="mt-2 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setReturning(false); setReason('') }}>Cancel</button>
              <button className="btn-danger" disabled={!reason.trim() || busy}
                onClick={() => run(async () => { await repo.returnTask(task.id, reason.trim()); setReturning(false); setReason('') })}>
                Send back to {nameOf(task.assignee_id)}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Empty-state helper other task surfaces can import for consistency.
export function NoTasks({ text }: { text: string }) { return <Empty text={text} /> }
