-- =====================================================================
-- UCA CENTRAL - admin hide / permanent-delete for beneficiaries & interventions
--
-- Adds the ability (in the Admin -> Beneficiaries tab) for ManCo / Exco to:
--   * HIDE a beneficiary or a single assigned intervention  -> soft, reversible
--   * DELETE a beneficiary or a single assigned intervention -> permanent
--
-- This migration is ADDITIVE and IDEMPOTENT. It only introduces the soft-hide
-- flag. Permanent delete needs nothing new: the schema already has ON DELETE
-- CASCADE on the child tables (interventions, weekly_updates, comms_log,
-- escalations, rag_overrides, beneficiary_events), and the existing row-level
-- security policies p_ben_write and p_iv_manco are declared FOR ALL USING
-- (is_manco()) -- and is_manco() covers both ManCo and Exco -- so DELETE is
-- already permitted for exactly the roles we want.
--
-- The application reads the soft-hide flag from these base-table columns (not
-- from the v_*_rag views), so this migration deliberately does NOT touch the
-- views. If you later want the views to carry removed_at explicitly, add it to
-- their own definitions; the app does not require it.
-- =====================================================================

alter table beneficiaries add column if not exists removed_at timestamptz;
alter table beneficiaries add column if not exists removed_by uuid references profiles(id) on delete set null;

alter table interventions add column if not exists removed_at timestamptz;
alter table interventions add column if not exists removed_by uuid references profiles(id) on delete set null;

-- Small partial indexes: hidden rows are rare, so index only those.
create index if not exists idx_beneficiaries_removed on beneficiaries (removed_at) where removed_at is not null;
create index if not exists idx_interventions_removed on interventions (removed_at) where removed_at is not null;
