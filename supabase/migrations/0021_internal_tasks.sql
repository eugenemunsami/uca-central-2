-- 0021_internal_tasks.sql
-- Internal Tasks: ad-hoc staff-to-staff jobs, separate from beneficiary delivery and onboarding.
-- Fully self-contained — no FKs into beneficiaries/onboardings, no shared views/policies touched.
-- Additive & inert: safe to apply before the frontend that uses it ships.
--
-- Visibility: internal only. A person sees tasks they raised or are assigned; Exco sees all.
-- Close-out loop lives in app logic (status: open -> in_progress -> submitted -> done, with send-back).

-- ---------- tables ----------
create table if not exists public.internal_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  detail        text,
  requester_id  uuid not null references public.profiles(id),
  assignee_id   uuid not null references public.profiles(id),
  priority      text not null default 'medium' check (priority in ('low','medium','high')),
  status        text not null default 'open'   check (status in ('open','in_progress','submitted','done')),
  due_date      date,
  submitted_at  timestamptz,
  verified_at   timestamptz,
  return_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_internal_tasks_assignee  on public.internal_tasks(assignee_id);
create index if not exists idx_internal_tasks_requester on public.internal_tasks(requester_id);
create index if not exists idx_internal_tasks_status    on public.internal_tasks(status);

create table if not exists public.internal_task_subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.internal_tasks(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_internal_task_subtasks_task on public.internal_task_subtasks(task_id);

create table if not exists public.internal_task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.internal_tasks(id) on delete cascade,
  author_id  uuid references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_internal_task_comments_task on public.internal_task_comments(task_id);

-- ---------- grants (RLS still gates every row) ----------
grant select, insert, update, delete on public.internal_tasks          to authenticated;
grant select, insert, update, delete on public.internal_task_subtasks  to authenticated;
grant select, insert, update, delete on public.internal_task_comments  to authenticated;

-- ---------- RLS ----------
alter table public.internal_tasks         enable row level security;
alter table public.internal_task_subtasks enable row level security;
alter table public.internal_task_comments enable row level security;

-- internal_tasks: internal only; own + raised, Exco sees all.
drop policy if exists p_it_read   on public.internal_tasks;
drop policy if exists p_it_insert on public.internal_tasks;
drop policy if exists p_it_update on public.internal_tasks;
drop policy if exists p_it_delete on public.internal_tasks;

create policy p_it_read on public.internal_tasks for select
  using (is_internal() and (my_role() = 'exco' or requester_id = auth.uid() or assignee_id = auth.uid()));

create policy p_it_insert on public.internal_tasks for insert
  with check (is_internal() and requester_id = auth.uid());

create policy p_it_update on public.internal_tasks for update
  using (is_internal() and (my_role() = 'exco' or requester_id = auth.uid() or assignee_id = auth.uid()))
  with check (is_internal() and (my_role() = 'exco' or requester_id = auth.uid() or assignee_id = auth.uid()));

create policy p_it_delete on public.internal_tasks for delete
  using (is_internal() and (my_role() = 'exco' or requester_id = auth.uid()));

-- Helper predicate reused by children: can I see the parent task?
--   (inlined per policy since Postgres RLS can't share a subquery macro)
-- internal_task_subtasks: follows the parent task's visibility; requester/assignee/Exco may edit.
drop policy if exists p_its_read   on public.internal_task_subtasks;
drop policy if exists p_its_write  on public.internal_task_subtasks;
drop policy if exists p_its_update on public.internal_task_subtasks;
drop policy if exists p_its_delete on public.internal_task_subtasks;

create policy p_its_read on public.internal_task_subtasks for select
  using (exists (select 1 from public.internal_tasks t where t.id = task_id
    and (my_role() = 'exco' or t.requester_id = auth.uid() or t.assignee_id = auth.uid())));

create policy p_its_write on public.internal_task_subtasks for insert
  with check (exists (select 1 from public.internal_tasks t where t.id = task_id
    and (my_role() = 'exco' or t.requester_id = auth.uid() or t.assignee_id = auth.uid())));

create policy p_its_update on public.internal_task_subtasks for update
  using (exists (select 1 from public.internal_tasks t where t.id = task_id
    and (my_role() = 'exco' or t.requester_id = auth.uid() or t.assignee_id = auth.uid())));

create policy p_its_delete on public.internal_task_subtasks for delete
  using (exists (select 1 from public.internal_tasks t where t.id = task_id
    and (my_role() = 'exco' or t.requester_id = auth.uid() or t.assignee_id = auth.uid())));

-- internal_task_comments: same read scope; author inserts own; author or Exco deletes.
drop policy if exists p_itc_read   on public.internal_task_comments;
drop policy if exists p_itc_insert on public.internal_task_comments;
drop policy if exists p_itc_delete on public.internal_task_comments;

create policy p_itc_read on public.internal_task_comments for select
  using (exists (select 1 from public.internal_tasks t where t.id = task_id
    and (my_role() = 'exco' or t.requester_id = auth.uid() or t.assignee_id = auth.uid())));

create policy p_itc_insert on public.internal_task_comments for insert
  with check (author_id = auth.uid() and exists (select 1 from public.internal_tasks t where t.id = task_id
    and (my_role() = 'exco' or t.requester_id = auth.uid() or t.assignee_id = auth.uid())));

create policy p_itc_delete on public.internal_task_comments for delete
  using (author_id = auth.uid() or my_role() = 'exco');

-- ---------- realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'internal_tasks') then
    execute 'alter publication supabase_realtime add table public.internal_tasks';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'internal_task_subtasks') then
    execute 'alter publication supabase_realtime add table public.internal_task_subtasks';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'internal_task_comments') then
    execute 'alter publication supabase_realtime add table public.internal_task_comments';
  end if;
end $$;

-- ---------- rollback (manual) ----------
-- drop table if exists public.internal_task_comments cascade;
-- drop table if exists public.internal_task_subtasks cascade;
-- drop table if exists public.internal_tasks cascade;
