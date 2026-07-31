-- 0014_user_hidden_sections.sql
-- Per-user section visibility switches (Admin). Option A: a visibility layer ON TOP of roles — an
-- admin can HIDE a section a user's role would otherwise see, but can never grant a section the role
-- doesn't permit. hidden_sections holds the section keys turned OFF for that user; empty = all
-- role-permitted sections visible. Managers/admins may already update any profile (p_profiles_admin).

alter table profiles add column if not exists hidden_sections text[] not null default '{}';
