-- 0016_external_aggregator_access.sql
-- Aggregator-linked external users (e.g. BEE123) get an expanded, scoped workspace: read access to
-- the onboarding pipeline for their programme, plus the ability to ACT at the two stages the model
-- already hands to the sponsor (red no-show — remove / request a site visit, and a sponsor-owned
-- escalation). Beneficiary read access is already scoped by my_sponsors() from 0003, so no change is
-- needed there. Everything here is strictly scoped to the caller's own sponsors via my_sponsors().
-- Additive: internal policies are preserved; external gets its own scoped grants.

-- Onboardings: internal see all; external see the tickets under their sponsor(s).
drop policy if exists p_onb_read on public.onboardings;
create policy p_onb_read on public.onboardings for select
  using (is_internal() or sponsor_id in (select my_sponsors()));

-- External may UPDATE a ticket only while it is currently sponsor-owned AND within their scope; the
-- row must remain in their scope afterwards (these actions never move the ticket to another sponsor).
-- Internal keep their existing full-update policy (p_onb_update); permissive policies OR together.
drop policy if exists p_onb_ext_update on public.onboardings;
create policy p_onb_ext_update on public.onboardings for update
  using (sponsor_id in (select my_sponsors()) and current_owner_role::text = 'external')
  with check (sponsor_id in (select my_sponsors()));

-- Onboarding events: read + insert scoped to tickets the caller can see.
drop policy if exists p_onbev_read on public.onboarding_events;
create policy p_onbev_read on public.onboarding_events for select
  using (is_internal() or onboarding_id in (
    select id from public.onboardings where sponsor_id in (select my_sponsors())));

drop policy if exists p_onbev_write on public.onboarding_events;
create policy p_onbev_write on public.onboarding_events for insert
  with check (is_internal() or onboarding_id in (
    select id from public.onboardings where sponsor_id in (select my_sponsors())));

-- Welcome parties are event shells (date / title / Teams link). Visible to internal and to any
-- aggregator-linked external so the onboarding page's parties strip renders for them.
drop policy if exists p_wp_read on public.welcome_parties;
create policy p_wp_read on public.welcome_parties for select
  using (is_internal() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'external' and p.external_client_id is not null));

-- Welcome-party invites: scoped to the caller's own tickets (so their attendance counts show).
drop policy if exists p_wpi_read on public.welcome_party_invites;
create policy p_wpi_read on public.welcome_party_invites for select
  using (is_internal() or onboarding_id in (
    select id from public.onboardings where sponsor_id in (select my_sponsors())));
