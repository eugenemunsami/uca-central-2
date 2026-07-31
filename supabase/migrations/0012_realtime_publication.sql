-- 0012_realtime_publication.sql
-- Enable Supabase Realtime on the operational tables so every open client refreshes automatically
-- when data changes (no manual page refresh; nobody left on stale data). The app subscribes to
-- postgres_changes on these tables and triggers a debounced reload. RLS still applies to the change
-- stream. Idempotent: only adds a table if it isn't already in the supabase_realtime publication.

do $$
declare t text;
begin
  foreach t in array array[
    'beneficiaries','interventions','weekly_updates','comms_log','escalations','escalation_events',
    'beneficiary_events','user_events','notifications','rag_overrides','onboardings','onboarding_events',
    'welcome_parties','welcome_party_invites','profiles','intervention_catalogue'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
