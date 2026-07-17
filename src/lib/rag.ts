import type { Intervention, Rag, WeeklyUpdate, Escalation } from './types'

export const RAG_HEX: Record<Rag, string> = { green: '#9FD150', amber: '#F5B942', red: '#EE4823' }
export const RAG_LABEL: Record<Rag, string> = { green: 'Green', amber: 'Amber', red: 'Red' }

export function workingDaysSince(iso?: string | null): number | null {
  if (!iso) return null
  const start = new Date(iso)
  const today = new Date()
  let days = 0
  const d = new Date(start)
  d.setDate(d.getDate() + 1)
  while (d <= today) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days++
    d.setDate(d.getDate() + 1)
  }
  return days
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

/**
 * Client-side mirror of the v_intervention_rag SQL view.
 * Playbook timers: 3 working days for a beneficiary response, overdue due-date,
 * stale weekly update (7 days amber / 10 days red), on-hold => amber.
 */
export function computeRag(
  iv: Intervention,
  updates: WeeklyUpdate[],
  escalations: Escalation[],
): { rag: Rag; reason: string | null; daysAwaiting: number | null; lastUpdateAt: string | null } {
  const mine = updates.filter(u => u.intervention_id === iv.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const lastUpdateAt = mine[0]?.created_at ?? null
  const openEsc = escalations.find(e => e.intervention_id === iv.id && e.status !== 'resolved')
  const daysAwaiting = workingDaysSince(iv.awaiting_response_since)
  const now = new Date()
  const sinceUpdate = daysBetween(new Date(lastUpdateAt ?? iv.created_at), now)

  if (iv.rag_override) return { rag: iv.rag_override, reason: iv.rag_override_reason ?? 'Manual override', daysAwaiting, lastUpdateAt }
  if (iv.status === 'completed') return { rag: 'green', reason: null, daysAwaiting, lastUpdateAt }
  // Awaiting ManCo close-out confirmation: work is done, treat as on track.
  if (iv.closeout_status === 'requested') return { rag: 'green', reason: 'Close-out awaiting ManCo confirmation', daysAwaiting, lastUpdateAt }
  if (openEsc) return { rag: 'red', reason: openEsc.reason, daysAwaiting, lastUpdateAt }
  if (iv.response_extended_until && new Date(iv.response_extended_until) > now) {
    const until = new Date(iv.response_extended_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    return { rag: 'amber', reason: `Allowable delay granted until ${until}`, daysAwaiting, lastUpdateAt }
  }
  if (daysAwaiting !== null && daysAwaiting >= 3)
    return { rag: 'red', reason: `No beneficiary response in ${daysAwaiting} working days`, daysAwaiting, lastUpdateAt }
  if (iv.due_date && new Date(iv.due_date) < now)
    return { rag: 'red', reason: 'Past due date', daysAwaiting, lastUpdateAt }
  if (sinceUpdate >= 10)
    return { rag: 'red', reason: `No update logged in ${sinceUpdate} days`, daysAwaiting, lastUpdateAt }
  if (iv.status === 'on_hold')
    return { rag: 'amber', reason: iv.hold_reason ?? 'On hold', daysAwaiting, lastUpdateAt }
  if (iv.status === 'awaiting_beneficiary')
    return { rag: 'amber', reason: iv.hold_reason ?? 'Awaiting beneficiary', daysAwaiting, lastUpdateAt }
  if (iv.due_date && daysBetween(now, new Date(iv.due_date)) <= 3)
    return { rag: 'amber', reason: 'Due within 3 days', daysAwaiting, lastUpdateAt }
  if (sinceUpdate >= 7)
    return { rag: 'amber', reason: `No update logged in ${sinceUpdate} days`, daysAwaiting, lastUpdateAt }
  return { rag: 'green', reason: null, daysAwaiting, lastUpdateAt }
}

export function worst(rags: Rag[]): Rag {
  if (rags.includes('red')) return 'red'
  if (rags.includes('amber')) return 'amber'
  return 'green'
}
