-- =====================================================================
-- UCA CENTRAL - live backend schema (authoritative)
--
-- This is the schema the current app actually queries. It supersedes the
-- older 0001_init.sql (which pre-dates the ownership-baton escalations and
-- the events/notifications tables). It is ALREADY APPLIED to the live
-- "UCA Central" Supabase project; it's committed here for reproducibility.
--
-- Auth: accounts are created via the invite-user edge function (which uses the
-- service-role key). On first login the person sets their own password, which
-- flips profiles.status to 'active'.
-- =====================================================================
create extension if not exists "pgcrypto";

-- ------------------------- enums -------------------------
create type uca_role       as enum ('exco','manco','consultant','external');
create type bene_stage     as enum ('onboarding','diagnostic','sow','implementation','monitoring','completed');
create type rag            as enum ('green','amber','red');
create type iv_status      as enum ('not_started','in_progress','awaiting_beneficiary','on_hold','completed');
create type closeout_state as enum ('none','requested','confirmed');
create type iv_kind        as enum ('standard','custom');
create type custom_kind    as enum ('capex','opex','other');
create type comms_channel  as enum ('call','email','meeting','whatsapp','site_visit');
create type user_status    as enum ('pending','active','suspended','deactivated','invitation_expired');
create type esc_status     as enum ('with_manco','returned_to_consultant','with_sponsor','returned_to_manco','resolution_submitted','outcome_to_consultant','resolved');
create type owner_role     as enum ('consultant','manco','external');

-- ------------------------- org tree -------------------------
create table aggregators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create table sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aggregator_id uuid references aggregators(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------- people -------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role uca_role not null default 'consultant',
  discipline text,
  is_admin boolean not null default false,
  active boolean not null default true,
  external_client_id uuid references aggregators(id) on delete set null,
  external_sponsor_id uuid references sponsors(id) on delete set null,
  organisation text,
  job_title text,
  status user_status not null default 'active',
  invited_at timestamptz,
  activated_at timestamptz,
  invite_expires_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  temp_password text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------- catalogue -------------------------
create table intervention_catalogue (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  description text,
  est_delivery text,
  default_owner_id uuid references profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------- beneficiaries -------------------------
create table beneficiaries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sponsor_id uuid not null references sponsors(id) on delete restrict,
  industry text,
  contact_person text,
  contact_email text,
  contact_phone text,
  directors jsonb not null default '[]',
  stage bene_stage not null default 'implementation',
  project_manager_id uuid references profiles(id) on delete set null,
  ember360_report_url text,
  welcome_party_date date,
  missed_welcome_parties int not null default 0,
  sow_signed_date date,
  sow_url text,
  expected_completion date,
  last_engagement_at timestamptz,
  needs_onsite boolean not null default false,
  outstanding_items text,
  rag_override rag,
  rag_override_reason text,
  drive_folder_url text,
  lifecycle text not null default 'active',
  cycle int not null default 1,
  closeout_report_url text,
  closeout_return_notes text,
  concluded_at timestamptz,
  archived_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------- interventions -------------------------
create table interventions (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  kind iv_kind not null default 'standard',
  catalogue_id uuid references intervention_catalogue(id) on delete set null,
  custom_name text,
  custom_kind custom_kind,
  custom_budget numeric(12,2),
  custom_motivation text,
  consultant_id uuid references profiles(id) on delete set null,
  status iv_status not null default 'not_started',
  hold_reason text,
  start_date date,
  due_date date,
  completed_at timestamptz,
  awaiting_response_since timestamptz,
  closeout_status closeout_state not null default 'none',
  closeout_requested_by uuid references profiles(id) on delete set null,
  closeout_requested_at timestamptz,
  closeout_confirmed_by uuid references profiles(id) on delete set null,
  closeout_confirmed_at timestamptz,
  closeout_subfolder_url text,
  closeout_email_sent boolean not null default false,
  closeout_email_text text,
  response_extended_until date,
  cancelled boolean not null default false,
  removed_at timestamptz,
  removed_by uuid references profiles(id) on delete set null,
  cycle int not null default 1,
  assigned_at timestamptz default now(),
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  drive_folder_url text,
  poe_url text,
  closeout_report_url text,
  rag_override rag,
  rag_override_reason text,
  created_at timestamptz not null default now(),
  constraint iv_shape check (
    (kind = 'standard' and catalogue_id is not null) or
    (kind = 'custom'   and custom_name is not null)
  )
);

-- ------------------------- evidence trail -------------------------
create table weekly_updates (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  completed_work text, in_progress text, blocker text, blocker_owner text,
  next_action text, next_update_due date,
  created_at timestamptz not null default now()
);
create table comms_log (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  intervention_id uuid references interventions(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  channel comms_channel not null,
  occurred_at timestamptz not null default now(),
  context text not null,
  followed_up_by_email boolean not null default false,
  email_text text,
  created_at timestamptz not null default now()
);
create table escalations (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid references interventions(id) on delete cascade,
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  reason text not null,
  context text,
  status esc_status not null default 'with_manco',
  current_owner_id uuid references profiles(id) on delete set null,
  current_owner_role owner_role not null default 'manco',
  consultant_id uuid references profiles(id) on delete set null,
  manco_id uuid references profiles(id) on delete set null,
  sponsor_id uuid references profiles(id) on delete set null,
  participants uuid[] not null default '{}',
  raised_by uuid references profiles(id) on delete set null,
  raised_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  resolved_at timestamptz
);
create table escalation_events (
  id uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references escalations(id) on delete cascade,
  at timestamptz not null default now(),
  user_id uuid references profiles(id) on delete set null,
  kind text not null,
  from_status text, to_status text,
  from_owner_id uuid references profiles(id) on delete set null,
  to_owner_id uuid references profiles(id) on delete set null,
  text text
);
create table rag_overrides (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  rag rag not null, reason text not null,
  effective_date date not null default current_date,
  logged_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table beneficiary_events (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  at timestamptz not null default now(),
  user_id uuid references profiles(id) on delete set null,
  kind text not null, text text
);
create table user_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null default now(),
  by_user_id uuid references profiles(id) on delete set null,
  kind text not null, text text
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null, text text not null,
  escalation_id text,
  action_required boolean not null default false,
  read boolean not null default false
);

create index on beneficiary_events (beneficiary_id, at desc);
create index on escalation_events (escalation_id, at desc);
create index on user_events (target_user_id, at desc);
create index on notifications (user_id, read);
create index on interventions (beneficiary_id);
create index on interventions (consultant_id);
create index on weekly_updates (intervention_id, created_at desc);
create index on comms_log (beneficiary_id, occurred_at desc);
create index on rag_overrides (beneficiary_id, created_at desc);
create index on escalations (beneficiary_id);
create index on escalations (intervention_id);
create index on beneficiaries (removed_at) where removed_at is not null;
create index on interventions (removed_at) where removed_at is not null;

-- =====================================================================
-- RAG engine + views  (mirrors src/lib/rag.ts and the client decorators)
-- =====================================================================
create or replace function working_days_since(ts timestamptz)
returns int language sql immutable set search_path = public as $$
  select case when ts is null then null else
    (select count(*)::int from generate_series(ts::date + 1, current_date, interval '1 day') d
     where extract(isodow from d) < 6) end;
$$;

create or replace view v_intervention_rag as
select
  i.*, b.sponsor_id as _sponsor_id,
  (case when i.kind='custom' then coalesce(i.custom_name,'Custom intervention') else coalesce(cat.name,'Intervention') end) as title,
  (case when i.kind='custom' then 'Custom · ' || coalesce(i.custom_kind::text,'other') else coalesce(cat.category,'-') end) as category,
  cons.full_name as consultant_name,
  b.name as beneficiary_name,
  working_days_since(i.awaiting_response_since) as days_awaiting,
  (select max(created_at) from weekly_updates wu where wu.intervention_id = i.id) as last_update_at,
  case
    when i.rag_override is not null then i.rag_override
    when i.status='completed' then 'green'::rag
    when i.closeout_status='requested' then 'green'::rag
    when exists (select 1 from escalations e where e.intervention_id=i.id and e.status<>'resolved') then 'red'::rag
    when i.response_extended_until is not null and i.response_extended_until>current_date then 'amber'::rag
    when working_days_since(i.awaiting_response_since)>=3 then 'red'::rag
    when i.due_date is not null and i.due_date<current_date then 'red'::rag
    when coalesce((select max(created_at) from weekly_updates wu where wu.intervention_id=i.id), i.created_at) < now()-interval '10 days' then 'red'::rag
    when i.status='on_hold' then 'amber'::rag
    when i.status='awaiting_beneficiary' then 'amber'::rag
    when i.due_date is not null and i.due_date<=current_date+3 then 'amber'::rag
    when coalesce((select max(created_at) from weekly_updates wu where wu.intervention_id=i.id), i.created_at) < now()-interval '7 days' then 'amber'::rag
    else 'green'::rag end as rag,
  case
    when i.rag_override is not null then i.rag_override_reason
    when i.closeout_status='requested' then 'Close-out awaiting ManCo confirmation'
    when exists (select 1 from escalations e where e.intervention_id=i.id and e.status<>'resolved')
      then (select e.reason from escalations e where e.intervention_id=i.id and e.status<>'resolved' order by raised_at desc limit 1)
    when i.response_extended_until is not null and i.response_extended_until>current_date then 'Allowable delay granted until ' || to_char(i.response_extended_until,'DD Mon')
    when working_days_since(i.awaiting_response_since)>=3 then 'No beneficiary response in ' || working_days_since(i.awaiting_response_since) || ' working days'
    when i.due_date is not null and i.due_date<current_date then 'Past due date'
    when i.status='on_hold' then coalesce(i.hold_reason,'On hold')
    when i.status='awaiting_beneficiary' then coalesce(i.hold_reason,'Awaiting beneficiary')
    else null end as rag_reason
from interventions i
join beneficiaries b on b.id=i.beneficiary_id
left join intervention_catalogue cat on cat.id=i.catalogue_id
left join profiles cons on cons.id=i.consultant_id;

create or replace view v_beneficiary_rag as
with cur as (
  select v.* from v_intervention_rag v
  join beneficiaries bb on bb.id=v.beneficiary_id
  where coalesce(v.cancelled,false)=false and v.removed_at is null and coalesce(v.cycle,1)=coalesce(bb.cycle,1)
)
select
  b.*, sp.name as sponsor_name, ag.id as aggregator_id, ag.name as aggregator_name,
  coalesce(ag.id, sp.id) as client_id, coalesce(ag.name, sp.name) as client_name,
  pm.full_name as pm_name,
  (select count(*) from cur where cur.beneficiary_id=b.id) as intervention_count,
  (select count(*) from cur where cur.beneficiary_id=b.id) as active_intervention_count,
  (select count(*) from cur where cur.beneficiary_id=b.id and cur.status='completed') as completed_count,
  (select count(*)>0 and bool_and(cur.closeout_status='confirmed') from cur where cur.beneficiary_id=b.id) as all_interventions_closed,
  coalesce(array(select p.id from profiles p where p.role='external'
    and (p.external_sponsor_id=b.sponsor_id or (ag.id is not null and p.external_client_id=ag.id))), '{}') as recipient_ids,
  exists (select 1 from escalations e where e.beneficiary_id=b.id and e.status<>'resolved') as escalated,
  (select e.reason from escalations e where e.beneficiary_id=b.id and e.status<>'resolved' order by raised_at desc limit 1) as escalation_reason,
  (select wu.next_action from weekly_updates wu join cur on cur.id=wu.intervention_id and cur.beneficiary_id=b.id order by wu.created_at desc limit 1) as next_action,
  (select max(wu.created_at) from weekly_updates wu join cur on cur.id=wu.intervention_id and cur.beneficiary_id=b.id) as last_update_at,
  coalesce(case
    when b.rag_override is not null then b.rag_override
    when exists (select 1 from cur where cur.beneficiary_id=b.id and cur.rag='red') then 'red'::rag
    when exists (select 1 from cur where cur.beneficiary_id=b.id and cur.rag='amber') then 'amber'::rag
    else 'green'::rag end, 'green'::rag) as rag
from beneficiaries b
join sponsors sp on sp.id=b.sponsor_id
left join aggregators ag on ag.id=sp.aggregator_id
left join profiles pm on pm.id=b.project_manager_id;

create or replace view v_escalation as
select
  e.*, b.name as beneficiary_name,
  (case when iv.kind='custom' then coalesce(iv.custom_name,'Custom intervention')
        when iv.id is not null then coalesce(cat.name,'Intervention') else 'Intervention' end) as intervention_title,
  coalesce(ag.id, sp.id) as client_id,
  own.full_name as owner_name,
  coalesce(own.organisation, own.discipline) as owner_org,
  cons.full_name as consultant_name,
  case when e.resolved_at is not null then greatest(0, round(extract(epoch from (e.resolved_at-e.raised_at))/86400.0))::int else null end as time_to_resolve_days
from escalations e
join beneficiaries b on b.id=e.beneficiary_id
left join sponsors sp on sp.id=b.sponsor_id
left join aggregators ag on ag.id=sp.aggregator_id
left join interventions iv on iv.id=e.intervention_id
left join intervention_catalogue cat on cat.id=iv.catalogue_id
left join profiles own on own.id=e.current_owner_id
left join profiles cons on cons.id=e.consultant_id;

-- Views run with the querying user's rights so base-table RLS applies.
alter view v_intervention_rag set (security_invoker = on);
alter view v_beneficiary_rag  set (security_invoker = on);
alter view v_escalation       set (security_invoker = on);

-- =====================================================================
-- Row level security
-- =====================================================================
create or replace function my_role() returns uca_role
language sql stable security definer set search_path = public as $$ select role from profiles where id=auth.uid() $$;
create or replace function is_internal() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(my_role() in ('exco','manco','consultant'), false) $$;
create or replace function is_manco() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(my_role() in ('exco','manco'), false) $$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select is_admin from profiles where id=auth.uid()), false) $$;
create or replace function my_sponsors() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from sponsors s join profiles p on p.id=auth.uid()
  where p.external_sponsor_id=s.id or p.external_client_id=s.aggregator_id $$;

-- non-admins cannot escalate their own role / scope on self-update
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_manco() or is_admin() then return new; end if;
  new.role := old.role; new.is_admin := old.is_admin;
  new.external_client_id := old.external_client_id; new.external_sponsor_id := old.external_sponsor_id;
  new.created_by := old.created_by;
  return new;
end $$;
create trigger trg_guard_profile before update on profiles for each row execute function guard_profile_update();

alter table aggregators enable row level security;
alter table sponsors enable row level security;
alter table profiles enable row level security;
alter table intervention_catalogue enable row level security;
alter table beneficiaries enable row level security;
alter table interventions enable row level security;
alter table weekly_updates enable row level security;
alter table comms_log enable row level security;
alter table escalations enable row level security;
alter table escalation_events enable row level security;
alter table rag_overrides enable row level security;
alter table beneficiary_events enable row level security;
alter table user_events enable row level security;
alter table notifications enable row level security;

create policy p_profiles_read  on profiles for select using (auth.uid()=id or is_internal());
create policy p_profiles_self  on profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy p_profiles_admin on profiles for all using (is_manco() or is_admin()) with check (is_manco() or is_admin());

create policy p_agg_read  on aggregators for select using (is_internal() or exists (select 1 from profiles p where p.id=auth.uid() and p.external_client_id=aggregators.id));
create policy p_agg_manco on aggregators for all using (is_manco()) with check (is_manco());
create policy p_sp_read   on sponsors for select using (is_internal() or sponsors.id in (select my_sponsors()));
create policy p_sp_manco  on sponsors for all using (is_manco()) with check (is_manco());

create policy p_cat_read  on intervention_catalogue for select using (is_internal());
create policy p_cat_admin on intervention_catalogue for all using (is_admin() or is_manco()) with check (is_admin() or is_manco());

create policy p_ben_read  on beneficiaries for select using (is_internal() or sponsor_id in (select my_sponsors()));
create policy p_ben_write on beneficiaries for all using (is_manco()) with check (is_manco());

create policy p_iv_read on interventions for select using (is_internal() or beneficiary_id in (select id from beneficiaries where sponsor_id in (select my_sponsors())));
create policy p_iv_manco on interventions for all using (is_manco()) with check (is_manco());
create policy p_iv_consultant on interventions for update using (consultant_id=auth.uid()) with check (consultant_id=auth.uid());

create policy p_wu_read  on weekly_updates for select using (is_internal());
create policy p_wu_write on weekly_updates for insert with check (is_internal());
create policy p_wu_edit  on weekly_updates for update using (author_id=auth.uid() or is_manco());

create policy p_cm_read  on comms_log for select using (is_internal());
create policy p_cm_write on comms_log for insert with check (is_internal());
create policy p_cm_edit  on comms_log for update using (author_id=auth.uid() or is_manco());

create policy p_ov_read  on rag_overrides for select using (is_internal());
create policy p_ov_write on rag_overrides for insert with check (is_manco());

create policy p_bev_read  on beneficiary_events for select using (is_internal());
create policy p_bev_write on beneficiary_events for insert with check (is_internal());

create policy p_uev_read  on user_events for select using (is_internal());
create policy p_uev_write on user_events for insert with check (is_internal());

create policy p_ntf_read  on notifications for select using (user_id=auth.uid());
create policy p_ntf_write on notifications for insert with check (is_internal());
create policy p_ntf_edit  on notifications for update using (user_id=auth.uid());

create policy p_esc_read on escalations for select using (is_internal() or beneficiary_id in (select id from beneficiaries where sponsor_id in (select my_sponsors())));
create policy p_esc_write on escalations for insert with check (is_internal());
create policy p_esc_edit on escalations for update
  using (is_internal() or current_owner_id=auth.uid() or auth.uid()=any(participants))
  with check (is_internal() or current_owner_id=auth.uid() or auth.uid()=any(participants));
create policy p_esc_del on escalations for delete using (is_manco());

create policy p_eev_read on escalation_events for select using (is_internal() or exists (select 1 from escalations e where e.id=escalation_id and auth.uid()=any(e.participants)));
create policy p_eev_write on escalation_events for insert with check (is_internal() or exists (select 1 from escalations e where e.id=escalation_id and auth.uid()=any(e.participants)));
