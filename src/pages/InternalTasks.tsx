import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, MessageSquare, ListChecks, Inbox, Send } from 'lucide-react'
import { useData } from '../lib/useData'
import { useAuth } from '../context/AuthContext'
import { repo } from '../lib/repo'
import {
  TASK_STATUS_LABEL, TASK_PRIORITY_LABEL, TASK_PRIORITIES, TASK_ACTIVE_STATUSES,
  type InternalTaskView, type TaskStatus, type TaskPriority,
} from '../lib/types'
import { Modal, Field, Empty, fmtDate } from '../components/ui'
import InternalTaskDetail from '../components/InternalTaskDetail'

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
const prank = (p: TaskPriority) => TASK_PRIORITIES.indexOf(p)

// A compact task card, reused across the Internal Tasks page and My Work.
export function TaskCard({ task, nameOf, onOpen, delay = 0 }: {
  task: InternalTaskView; nameOf: (id?: string | null) => string; onOpen: () => void; delay?: number
}) {
  const doneSubs = task.subtasks.filter(s => s.done).length
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(delay, 0.2) }}
      onClick={onOpen}
      className="card card-hover w-full p-4 text-left">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm text-white">{task.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_CLS[task.status]}`}>{TASK_STATUS_LABEL[task.status]}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
        <span className={`rounded-full px-1.5 py-0.5 ${PRIORITY_CLS[task.priority]}`}>{TASK_PRIORITY_LABEL[task.priority]}</span>
        <span>{nameOf(task.requester_id)} → {nameOf(task.assignee_id)}</span>
        {task.due_date && <span>· Due {fmtDate(task.due_date)}</span>}
        {task.subtasks.length > 0 && <span className="inline-flex items-center gap-1"><ListChecks size={12} /> {doneSubs}/{task.subtasks.length}</span>}
        {task.comments.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {task.comments.length}</span>}
      </div>
    </motion.button>
  )
}

export default function InternalTasks() {
  const { tasks, people, loading } = useData()
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [q, setQ] = useState('')

  const nameOf = (id?: string | null) => people.find(p => p.id === id)?.full_name ?? '—'
  const isExco = user?.role === 'exco'

  // Own + raised for everyone; Exco sees the whole team's tasks. (Live RLS enforces the same;
  // this keeps demo mode and the Exco-all view consistent.)
  const mine = useMemo(
    () => tasks.filter(t => isExco || t.requester_id === user?.id || t.assignee_id === user?.id),
    [tasks, isExco, user?.id])

  const visible = useMemo(() => mine.filter(t => {
    if (assigneeFilter !== 'all' && t.assignee_id !== assigneeFilter) return false
    if (q.trim() && !t.title.toLowerCase().includes(q.trim().toLowerCase())) return false
    return true
  }), [mine, assigneeFilter, q])

  const active = useMemo(
    () => visible.filter(t => TASK_ACTIVE_STATUSES.includes(t.status))
      .sort((a, z) => prank(a.priority) - prank(z.priority) || (a.due_date ?? '9999').localeCompare(z.due_date ?? '9999')),
    [visible])
  const requestedDone = useMemo(() => visible.filter(t => t.status === 'done' && t.requester_id === user?.id), [visible, user?.id])
  const executedDone = useMemo(() => visible.filter(t => t.status === 'done' && t.assignee_id === user?.id), [visible, user?.id])

  const internalPeople = people.filter(p => p.role !== 'external' && p.active !== false)

  if (loading) return <div className="text-white/40">Loading…</div>

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl text-white"><ClipboardList size={22} className="text-lime" /> Internal Tasks</h1>
          <p className="mt-1 text-sm text-white/40">Ad-hoc jobs the team assigns to each other — separate from beneficiary and onboarding work.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New task</button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-56" placeholder="Search tasks" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
          <option value="all">Everyone</option>
          {internalPeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-lime" />
          <h2 className="text-sm text-white">Active</h2>
          <span className="text-[12px] text-white/40">{active.length}</span>
        </div>
        {active.length === 0
          ? <Empty text="No active tasks. Raise one with “New task”." />
          : <div className="grid gap-2 md:grid-cols-2">{active.map((t, i) => <TaskCard key={t.id} task={t} nameOf={nameOf} onOpen={() => setViewId(t.id)} delay={i * 0.03} />)}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Send size={15} className="text-white/40" />
            <h2 className="text-sm text-white">Completed · Requested by me</h2>
            <span className="text-[12px] text-white/40">{requestedDone.length}</span>
          </div>
          {requestedDone.length === 0
            ? <Empty text="Nothing here yet." />
            : <div className="space-y-2 opacity-80">{requestedDone.map(t => <TaskCard key={t.id} task={t} nameOf={nameOf} onOpen={() => setViewId(t.id)} />)}</div>}
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks size={15} className="text-white/40" />
            <h2 className="text-sm text-white">Completed · Executed by me</h2>
            <span className="text-[12px] text-white/40">{executedDone.length}</span>
          </div>
          {executedDone.length === 0
            ? <Empty text="Nothing here yet." />
            : <div className="space-y-2 opacity-80">{executedDone.map(t => <TaskCard key={t.id} task={t} nameOf={nameOf} onOpen={() => setViewId(t.id)} />)}</div>}
        </div>
      </section>

      {creating && <CreateTaskModal onClose={() => setCreating(false)} />}
      {viewId && <InternalTaskDetail taskId={viewId} onClose={() => setViewId(null)} />}
    </div>
  )
}

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const { people } = useData()
  const { user } = useAuth()
  const internalPeople = people.filter(p => p.role !== 'external' && p.active !== false)

  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [due, setDue] = useState('')
  const [subs, setSubs] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!title.trim() || !assignee || !user) return
    setBusy(true)
    try {
      await repo.addTask({
        title: title.trim(), detail: detail.trim() || null, assignee_id: assignee, requester_id: user.id,
        priority, due_date: due || null,
        subtasks: subs.split('\n').map(s => s.trim()).filter(Boolean),
      })
      onClose()
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="New task">
      <Field label="What needs doing? (required)">
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pull Q1 event attendee spreadsheet" />
      </Field>
      <Field label="Detail">
        <textarea className="input min-h-[80px]" value={detail} onChange={e => setDetail(e.target.value)} placeholder="Any context, links or specifics" />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Assign to (required)">
          <select className="input" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">Choose a colleague…</option>
            {internalPeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="input" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Due date">
        <input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} />
      </Field>
      <Field label="Sub-tasks (optional — one per line)" hint="A checklist of steps within this task.">
        <textarea className="input min-h-[70px]" value={subs} onChange={e => setSubs(e.target.value)} placeholder={'Export from Teams\nDe-dupe and format'} />
      </Field>
      <div className="mt-2 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!title.trim() || !assignee || busy} onClick={save}>Assign task</button>
      </div>
    </Modal>
  )
}
