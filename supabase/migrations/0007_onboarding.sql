-- =====================================================================
-- Onboarding module — the pre-SOW pipeline that feeds UCA Central.
--
-- A self-contained ownership-baton ticket (`onboardings`) runs the whole
-- process from invoice request to signed SOW. Nothing appears in the live
-- beneficiary tracker until the SOW is signed, at which point the ticket
-- CONVERTS into a real beneficiary (`app_convert_onboarding`) and Central
-- proceeds exactly as it does today. These tables are additive and inert
-- until the onboarding UI ships — the existing app never references them.
-- =====================================================================

-- A budget home on the beneficiary, carried over from onboarding at conversion.
alter table public.beneficiaries add column if not exists budget numeric;

-- ---- weekly welcome party (a dated event beneficiaries roll onto) --------
create table if not exists public.welcome_parties (
  id uuid primary key default gen_random_uuid(),
  party_date date not null,
  title text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---- the onboarding ticket ----------------------------------------------
create table if not exists public.onboardings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  budget numeric,
  invoice_number text,
  industry text,
  contact_person text,
  contact_email text,
  contact_phone text,
  status text not null default 'invoice_requested',
  current_owner_id uuid references public.profiles(id) on delete set null,
  current_owner_role text not null default 'exco',
  exco_id uuid references public.profiles(id) on delete set null,
  manco_id uuid references public.profiles(id) on delete set null,
  consultant_id uuid references public.profiles(id) on delete set null,
  needs_onsite boolean not null default false,
  ember_applicable boolean not null default true,
  ember360_report_url text,
  drive_folder_url text,
  sow_url text,
  sow_sent_at timestamptz,
  sow_signed_date date,
  welcome_party_id uuid references public.welcome_parties(id) on delete set null,
  missed_welcome_parties int not null default 0,
  participants uuid[] not null default '{}',
  withdrawn_reason text,
  converted_beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_action_at timestamptz not null default now()
);

-- ---- attendance link: which onboarding is on which party -----------------
create table if not exists public.welcome_party_invites (
  id uuid primary key default gen_random_uuid(),
  welcome_party_id uuid not null references public.welcome_parties(id) on delete cascade,
  onboarding_id uuid not null references public.onboardings(id) on delete cascade,
  status text not null default 'invited',       -- invited | attended | no_show
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (welcome_party_id, onboarding_id)
);

-- ---- immutable audit trail (mirrors escalation_events) -------------------
create table if not exists public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboardings(id) on delete cascade,
  at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  from_status text,
  to_status text,
  from_owner_id uuid,
  to_owner_id uuid,
  text text
);

create index if not exists idx_onboarding_events_oid on public.onboarding_events(onboarding_id);
create index if not exists idx_wpi_party on public.welcome_party_invites(welcome_party_id);
create index if not exists idx_wpi_onboarding on public.welcome_party_invites(onboarding_id);

-- ---- RLS: onboarding is internal-only (sponsors participate via internal
--      recording; the sponsor is shown as accountable owner). --------------
alter table public.welcome_parties        enable row level security;
alter table public.onboardings            enable row level security;
alter table public.welcome_party_invites  enable row level security;
alter table public.onboarding_events      enable row level security;

drop policy if exists p_wp_read   on public.welcome_parties;
drop policy if exists p_wp_write  on public.welcome_parties;
create policy p_wp_read  on public.welcome_parties for select using (is_internal());
create policy p_wp_write on public.welcome_parties for all using (is_manco()) with check (is_manco());

drop policy if exists p_onb_read   on public.onboardings;
drop policy if exists p_onb_insert on public.onboardings;
drop policy if exists p_onb_update on public.onboardings;
drop policy if exists p_onb_delete on public.onboardings;
create policy p_onb_read   on public.onboardings for select using (is_internal());
create policy p_onb_insert on public.onboardings for insert with check (is_manco());
create policy p_onb_update on public.onboardings for update using (is_internal()) with check (is_internal());
create policy p_onb_delete on public.onboardings for delete using (is_manco());

drop policy if exists p_wpi_read  on public.welcome_party_invites;
drop policy if exists p_wpi_write on public.welcome_party_invites;
create policy p_wpi_read  on public.welcome_party_invites for select using (is_internal());
create policy p_wpi_write on public.welcome_party_invites for all using (is_internal()) with check (is_internal());

drop policy if exists p_onbev_read  on public.onboarding_events;
drop policy if exists p_onbev_write on public.onboarding_events;
create policy p_onbev_read  on public.onboarding_events for select using (is_internal());
create policy p_onbev_write on public.onboarding_events for insert with check (is_internal());

-- ---- atomic conversion: signed SOW -> real beneficiary in Central --------
create or replace function public.app_convert_onboarding(p_onboarding uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.onboardings; new_ben uuid;
begin
  if not is_manco() then raise exception 'Only ManCo or Exco can convert an onboarding'; end if;
  select * into o from onboardings where id = p_onboarding;
  if o.id is null then raise exception 'Onboarding not found'; end if;
  if o.converted_beneficiary_id is not null then return o.converted_beneficiary_id; end if;

  insert into beneficiaries
    (name, sponsor_id, budget, project_manager_id, contact_person, contact_email, contact_phone,
     industry, needs_onsite, ember360_report_url, drive_folder_url, sow_url, sow_signed_date,
     missed_welcome_parties, stage, lifecycle, cycle)
  values
    (o.name, o.sponsor_id, o.budget, o.manco_id, o.contact_person, o.contact_email, o.contact_phone,
     o.industry, coalesce(o.needs_onsite,false), o.ember360_report_url, o.drive_folder_url, o.sow_url, o.sow_signed_date,
     coalesce(o.missed_welcome_parties,0), 'implementation', 'active', 1)
  returning id into new_ben;

  update onboardings
     set status = 'converted', converted_beneficiary_id = new_ben,
         current_owner_id = null, last_action_at = now()
   where id = p_onboarding;

  insert into onboarding_events (onboarding_id, user_id, kind, to_status, text)
  values (p_onboarding, auth.uid(), 'converted', 'converted',
          'SOW signed — beneficiary created in Central.');

  insert into beneficiary_events (beneficiary_id, user_id, kind, text)
  values (new_ben, auth.uid(), 'loaded', 'Onboarded from the onboarding pipeline (SOW signed).');

  return new_ben;
end $$;

revoke all on function public.app_convert_onboarding(uuid) from public, anon;
grant execute on function public.app_convert_onboarding(uuid) to authenticated;

-- ---- decorated read view (names resolved server-side; RLS via invoker) ----
create or replace view public.v_onboarding
with (security_invoker = on) as
select o.*,
  s.name as sponsor_name,
  coalesce(ag.name, s.name) as client_name,
  coalesce(ag.id, s.id) as client_id,
  ow.full_name as owner_name,
  coalesce(ow.organisation, ow.discipline) as owner_org,
  mc.full_name as manco_name,
  cons.full_name as consultant_name,
  wp.party_date as welcome_party_date,
  (o.status = 'red_no_show' or coalesce(o.missed_welcome_parties, 0) >= 2) as is_red
from public.onboardings o
left join public.sponsors s on s.id = o.sponsor_id
left join public.aggregators ag on ag.id = s.aggregator_id
left join public.profiles ow on ow.id = o.current_owner_id
left join public.profiles mc on mc.id = o.manco_id
left join public.profiles cons on cons.id = o.consultant_id
left join public.welcome_parties wp on wp.id = o.welcome_party_id;
