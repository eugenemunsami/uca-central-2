-- 0019_archive_2025.sql
-- TEMPORARY, FULLY ISOLATED "2025 Archive" section. Stands entirely on its own: no existing table,
-- view, function, trigger, RLS policy or realtime publication is touched, so it cannot affect the rest
-- of UCA Central. To remove the whole feature later: `drop table archive_2025_jobs;` and delete the
-- Archive2025 page/route/nav (or just git-revert to the checkpoint branch `checkpoint-pre-2025-archive`).
--
-- Holds the BEE123 FY25 (2025) creative-recovery + finance jobs, one row per intervention, grouped in
-- the UI by beneficiary_key. Status + RAG + latest_comment are editable by internal staff; everyone
-- signed in (including aggregator/sponsor accounts) can read it for line-of-sight.

create table if not exists archive_2025_jobs (
  id uuid primary key default gen_random_uuid(),
  beneficiary_name text not null,
  beneficiary_key text not null,          -- normalised grouping key (cards group on this)
  category text not null,                 -- intervention type: Brand Identity, Website, Finance, ...
  invoice text,                           -- invoice month(s) from the tracker, e.g. "Apr-25"
  owner text,                             -- consultant / owner name as captured in the sheet
  status text not null default 'Not Started'
    check (status in ('Not Started','In Progress','Complete: To Send Report','Closed')),
  rag text not null default 'amber' check (rag in ('green','amber','red')),
  latest_comment text,
  comment_updated_at timestamptz,
  comment_updated_by uuid references profiles(id) on delete set null,
  source text,                            -- 'creative' | 'finance' (provenance of the row)
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table archive_2025_jobs enable row level security;

-- Read: every signed-in user, internal AND external (aggregator/sponsor) — line of sight for all.
create policy p_arch_read on archive_2025_jobs for select using (auth.uid() is not null);
-- Update (status / RAG / comment): internal staff only. External accounts view it read-only.
create policy p_arch_update on archive_2025_jobs for update using (is_internal()) with check (is_internal());
-- Structural insert/delete: managers only (the initial load runs as service and bypasses RLS anyway).
create policy p_arch_insert on archive_2025_jobs for insert with check (is_manco());
create policy p_arch_delete on archive_2025_jobs for delete using (is_manco());

create index if not exists archive_2025_key_idx on archive_2025_jobs(beneficiary_key);
