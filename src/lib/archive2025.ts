// ============================================================================
// 2025 ARCHIVE — fully isolated data module.
// This file stands alone: it does NOT import or touch repo.ts, useData, the
// realtime channel, or any other part of Central. It talks to the standalone
// `archive_2025_jobs` table directly (live) or an embedded in-memory seed (demo).
// Deleting this file + the Archive2025 page + its nav/route + `drop table
// archive_2025_jobs` removes the whole feature with zero impact on the app.
// ============================================================================
import { LIVE, supabase } from './supabase'
import seed from './archive2025.seed.json'

export type ArchStatus = 'Not Started' | 'In Progress' | 'Complete: To Send Report' | 'Closed'
export type ArchRag = 'green' | 'amber' | 'red'

export const ARCH_STATUSES: ArchStatus[] = ['Not Started', 'In Progress', 'Complete: To Send Report', 'Closed']
export const ARCH_RAGS: ArchRag[] = ['red', 'amber', 'green']

export interface ArchiveJob {
  id: string
  beneficiary_name: string
  beneficiary_key: string          // normalised grouping key — cards group on this
  category: string                 // intervention type (Brand Identity, Website, Finance, ...)
  invoice: string | null
  owner: string | null
  status: ArchStatus
  rag: ArchRag
  latest_comment: string | null
  comment_updated_at: string | null
  comment_updated_by: string | null
  source: string | null
  sort: number
}

type SeedRow = Omit<ArchiveJob, 'id' | 'comment_updated_at' | 'comment_updated_by'>

// Embedded seed powers DEMO mode (no backend). Production runs LIVE against the table.
let demoRows: ArchiveJob[] = (seed as unknown as SeedRow[]).map((s, i) => ({
  id: `arch-${i}`, comment_updated_at: null, comment_updated_by: null, ...s,
}))

export async function fetchArchiveJobs(): Promise<ArchiveJob[]> {
  if (!LIVE || !supabase) return [...demoRows].sort((a, z) => a.sort - z.sort)
  const { data, error } = await supabase.from('archive_2025_jobs').select('*').order('sort')
  if (error) throw error
  return (data ?? []) as ArchiveJob[]
}

// Update a single job's status / RAG / latest comment. Internal staff only (enforced by RLS too).
export async function updateArchiveJob(
  id: string,
  patch: { status?: ArchStatus; rag?: ArchRag; latest_comment?: string },
  actorId: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  if (!LIVE || !supabase) {
    demoRows = demoRows.map(j => j.id === id
      ? { ...j, ...patch, ...(patch.latest_comment !== undefined ? { comment_updated_at: now, comment_updated_by: actorId } : {}) }
      : j)
    return
  }
  const upd: Record<string, unknown> = { ...patch }
  if (patch.latest_comment !== undefined) { upd.comment_updated_at = now; upd.comment_updated_by = actorId }
  const { error } = await supabase.from('archive_2025_jobs').update(upd).eq('id', id)
  if (error) throw error
}
