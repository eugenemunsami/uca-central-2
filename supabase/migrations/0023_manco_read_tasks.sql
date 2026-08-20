-- 0023_manco_read_tasks.sql
-- Let ManCo (not just Exco) read ALL internal tasks, so the Dashboard "Internal tasks" workload
-- view is org-wide for them too (used for resource planning). Additive & inert: only widens read.
-- Write access is unchanged (ManCo still only creates/updates/deletes their own + raised; Exco all).
drop policy if exists p_it_read on public.internal_tasks;
create policy p_it_read on public.internal_tasks for select
  using (is_internal() and (my_role() in ('exco','manco') or requester_id = auth.uid() or assignee_id = auth.uid()));
