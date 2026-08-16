-- 0020_external_updates_comms.sql
-- Aggregator-linked external accounts get full progress + evidence-trail visibility on their OWN
-- beneficiaries: the weekly updates AND the communication/evidence log, scoped to my_sponsors().
-- Additive: the internal read stays is_internal(); the external scope is OR'd into the same SELECT
-- policy (same pattern as 0016). The DB scope is the standard my_sponsors() slice, so a partner only
-- ever sees their own beneficiaries. (The UI restricts the richer beneficiary view + Huddle to
-- aggregator accounts; sponsor-only externals have no page that renders these, so this is harmless
-- for them.)

-- Weekly updates: internal see all; external see updates for interventions under their sponsor(s).
drop policy if exists p_wu_read on public.weekly_updates;
create policy p_wu_read on public.weekly_updates for select
  using (is_internal() or intervention_id in (
    select i.id from public.interventions i
    join public.beneficiaries b on b.id = i.beneficiary_id
    where b.sponsor_id in (select my_sponsors())));

-- Communication / evidence log: internal see all; external see comms for their beneficiaries.
drop policy if exists p_cm_read on public.comms_log;
create policy p_cm_read on public.comms_log for select
  using (is_internal() or beneficiary_id in (
    select id from public.beneficiaries where sponsor_id in (select my_sponsors())));
