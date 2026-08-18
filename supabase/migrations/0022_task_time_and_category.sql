-- 0022_task_time_and_category.sql
-- Internal Tasks, round 2 (requested by Hiten):
--   1. On close-out, the assignee must state how long the task took.
--   2. On raising a task, the requester must say what the task RELATES TO (a work-stream label,
--      e.g. Beneficiaries / Onboarding / Admin / Hearts Day) so the receiver has clear direction.
--
-- Additive & inert, per §9: both columns are NULLABLE with no default, so this is safe to apply
-- before the frontend that uses it ships, and existing rows stay valid. "Mandatory" is enforced in
-- the UI (the Assign button and the Mark-done button stay disabled until the field is filled) —
-- deliberately NOT a NOT NULL constraint, which would make the migration non-inert and would break
-- any close-out path that hasn't been updated yet.
--
-- `category` is free text on purpose: the team must be able to enter something Central has no concept
-- of. The frontend offers a suggestion list (a seed list merged with values already used on visible
-- tasks) so it converges on consistent labels without ever blocking a new one.

-- ---------- columns ----------
alter table public.internal_tasks
  add column if not exists time_minutes integer,
  add column if not exists category     text;

comment on column public.internal_tasks.time_minutes is
  'Total time the assignee spent on this task, in minutes. Captured on Mark done; on a re-submit after a send-back this is overwritten with the new running total (one task, one number).';
comment on column public.internal_tasks.category is
  'Free-text work-stream this task relates to (e.g. Beneficiaries, Onboarding, Admin, Hearts Day). Required by the UI at creation; free text so it can be something not modelled in Central.';

-- Guard against zero/negative logs without forcing a value onto open tasks.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'internal_tasks_time_minutes_check'
      and conrelid = 'public.internal_tasks'::regclass
  ) then
    alter table public.internal_tasks
      add constraint internal_tasks_time_minutes_check
      check (time_minutes is null or time_minutes > 0);
  end if;
end $$;

-- Category is filtered/grouped on the Internal Tasks page and the Exco dashboard rollup.
create index if not exists idx_internal_tasks_category on public.internal_tasks(category);

-- ---------- RLS / grants / realtime ----------
-- Nothing to do: column-level privileges are not used here, the existing table policies
-- (p_it_read / p_it_insert / p_it_update / p_it_delete from 0021) cover the new columns, and
-- internal_tasks is already in the supabase_realtime publication.

-- ---------- rollback (manual) ----------
-- alter table public.internal_tasks drop constraint if exists internal_tasks_time_minutes_check;
-- drop index if exists public.idx_internal_tasks_category;
-- alter table public.internal_tasks drop column if exists time_minutes;
-- alter table public.internal_tasks drop column if exists category;
