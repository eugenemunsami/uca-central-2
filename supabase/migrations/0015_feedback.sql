-- 0015_feedback.sql
-- Central Hub -> "Bugs & Lightbulbs". Any signed-in user (internal OR external) can log a bug report
-- or a suggestion ("lightbulb"). Managers (ManCo/Exco) triage them from the Admin review list: set
-- priority, star favourites, change status, add a triage note, or delete. Everyone can see and delete
-- their OWN submissions; managers see and manage all. Added to supabase_realtime so the admin list and
-- each user's own list update live. Additive & inert - safe to apply before the frontend that uses it.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'bug' check (kind in ('bug','lightbulb')),
  title text not null,
  detail text,
  area text,                                   -- optional: which part of the app it relates to
  status text not null default 'open' check (status in ('open','in_progress','resolved','dismissed')),
  priority text not null default 'none' check (priority in ('none','low','medium','high')),
  favourite boolean not null default false,
  author_id uuid references profiles(id) on delete set null,
  author_name text,                            -- snapshot: survives author deletion, shown without a join
  author_role uca_role,
  admin_note text,                             -- optional manager triage note
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- Everyone sees their own submissions; managers see all.
create policy p_fb_read   on feedback for select using (author_id = auth.uid() or is_manco());
-- Any authenticated user (external included) may log feedback, but only as themselves.
create policy p_fb_insert on feedback for insert with check (author_id = auth.uid());
-- Managers triage everything; a user may also withdraw (delete) their own submission.
create policy p_fb_update on feedback for update using (is_manco()) with check (is_manco());
create policy p_fb_delete on feedback for delete using (is_manco() or author_id = auth.uid());

create index if not exists feedback_author_idx  on feedback(author_id);
create index if not exists feedback_created_idx on feedback(created_at desc);

-- Live sync: keep the admin list and each user's own list fresh with no manual refresh.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'feedback'
  ) then
    execute 'alter publication supabase_realtime add table public.feedback';
  end if;
end $$;
