-- =====================================================================
-- Admin soft-hide for user profiles.
-- Mirrors the removed_at / removed_by pattern already on beneficiaries and
-- interventions: a hidden user disappears everywhere in the app (login,
-- assignment dropdowns, lists) but stays in the database and can be restored.
-- Permanent deletion is handled by the `delete-user` edge function, which
-- deletes the underlying auth user (cascading this profile row).
-- =====================================================================
alter table profiles add column if not exists removed_at timestamptz;
alter table profiles add column if not exists removed_by uuid references profiles(id) on delete set null;

create index if not exists idx_profiles_removed_at on profiles (removed_at) where removed_at is not null;
