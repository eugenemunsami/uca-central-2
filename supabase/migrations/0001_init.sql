-- =====================================================================
-- UCA CENTRAL - initial schema (v2)
-- Entry point: a beneficiary enters the system when their SOW is signed.
-- Pre-SOW stages live in the separate onboarding system.
-- Beneficiaries group directly under a client/aggregator (which rolls up
-- to a sponsor) - there is no separate cohort layer.
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
create type esc_status     as enum ('open','acknowledged','resolved');
create type esc_trigger    as enum ('no_response_3_days','sow_unsigned_7_days','two_missed_welcome_parties','pre_vetting_failed','overdue','manual');

-- ------------------------- org tree -------------------------
-- Aggregators sit on top and pool funding from one or more sponsors.
create table aggregators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Sponsors fund cohorts. A sponsor may sit under an aggregator or stand alone.
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
  external_client_id uuid references aggregators(id) on delete set null,  -- aggregator scope
  external_sponsor_id uuid references sponsors(id) on delete set null,
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
  directors jsonb not null default '[]',      -- [{name,email,phone}, ...]
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
  lifecycle text not null default 'active',   -- active|pending_closeout|closeout_sent|concluded|archived
  cycle int not null default 1,
  closeout_report_url text,
  closeout_return_notes text,
  concluded_at timestamptz,
  archived_at timestamptz,
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

-- ------------------------- the evidence trail -------------------------
create table weekly_updates (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  completed_work text,
  in_progress text,
  blocker text,
  blocker_owner text,
  next_action text,
  next_update_due date,
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
  email_text text,                            -- pasted copy of the written follow-up
  created_at timestamptz not null default now()
);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  intervention_id uuid references interventions(id) on delete cascade,
  trigger esc_trigger not null,
  reason text not null,
  next_steps text,
  owner_id uuid references profiles(id) on delete set null,     -- UCA person responsible
  expected_feedback_date date,
  effort_log text,
  status esc_status not null default 'open',
  raised_by uuid references profiles(id) on delete set null,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table rag_overrides (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  rag rag not null,
  reason text not null,
  effective_date date not null default current_date,
  logged_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table beneficiary_events (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  at timestamptz not null default now(),
  user_id uuid references profiles(id) on delete set null,
  kind text not null,
  text text
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  text text not null,
  escalation_id text,
  read boolean not null default false
);

create index on beneficiary_events (beneficiary_id, at desc);
create index on notifications (user_id, read);
create index on interventions (beneficiary_id);
create index on interventions (consultant_id);
create index on interventions (closeout_status) where closeout_status = 'requested';
create index on interventions (consultant_id) where acknowledged = false;
create index on weekly_updates (intervention_id, created_at desc);
create index on comms_log (beneficiary_id, occurred_at desc);
create index on rag_overrides (beneficiary_id, created_at desc);
create index on escalations (beneficiary_id) where status = 'open';

-- =====================================================================
-- SLA / RAG ENGINE  (mirrors src/lib/rag.ts)
-- =====================================================================
create or replace function working_days_since(ts timestamptz)
returns int language sql immutable as $$
  select case when ts is null then null else
    (select count(*)::int
     from generate_series(ts::date, current_date - 1, interval '1 day') d
     where extract(isodow from d) < 6)
  end;
$$;

create or replace view v_intervention_rag as
select
  i.*,
  b.sponsor_id,
  b.name as beneficiary_name,
  working_days_since(i.awaiting_response_since) as days_awaiting,
  (select max(created_at) from weekly_updates wu where wu.intervention_id = i.id) as last_update_at,
  case
    when i.rag_override is not null then i.rag_override
    when i.status = 'completed' then 'green'::rag
    when i.closeout_status = 'requested' then 'green'::rag
    when exists (select 1 from escalations e where e.intervention_id = i.id and e.status <> 'resolved') then 'red'::rag
    when i.response_extended_until is not null and i.response_extended_until > current_date then 'amber'::rag
    when working_days_since(i.awaiting_response_since) >= 3 then 'red'::rag
    when i.due_date is not null and i.due_date < current_date then 'red'::rag
    when coalesce((select max(created_at) from weekly_updates wu where wu.intervention_id = i.id), i.created_at)
         < now() - interval '10 days' then 'red'::rag
    when i.status in ('on_hold','awaiting_beneficiary') then 'amber'::rag
    when i.due_date is not null and i.due_date <= current_date + 3 then 'amber'::rag
    when coalesce((select max(created_at) from weekly_updates wu where wu.intervention_id = i.id), i.created_at)
         < now() - interval '7 days' then 'amber'::rag
    else 'green'::rag
  end as rag,
  case
    when i.rag_override is not null then i.rag_override_reason
    when i.closeout_status = 'requested' then 'Close-out awaiting ManCo confirmation'
    when exists (select 1 from escalations e where e.intervention_id = i.id and e.status <> 'resolved')
      then (select e.reason from escalations e where e.intervention_id = i.id and e.status <> 'resolved' order by raised_at desc limit 1)
    when working_days_since(i.awaiting_response_since) >= 3 then 'No beneficiary response in 3 working days'
    when i.due_date is not null and i.due_date < current_date then 'Past due date'
    when i.status = 'on_hold' then coalesce(i.hold_reason, 'On hold')
    when i.status = 'awaiting_beneficiary' then coalesce(i.hold_reason, 'Awaiting beneficiary')
    else null
  end as rag_reason
from interventions i
join beneficiaries b on b.id = i.beneficiary_id;

create or replace view v_beneficiary_rag as
select
  b.*,
  sp.name as sponsor_name,
  ag.id   as aggregator_id,
  ag.name as aggregator_name,
  coalesce(ag.id, sp.id)     as client_id,     -- top-level id
  coalesce(ag.name, sp.name) as client_name,   -- top-level label
  (select count(*) from interventions i where i.beneficiary_id = b.id) as intervention_count,
  (select count(*) from interventions i where i.beneficiary_id = b.id and i.status = 'completed') as completed_count,
  exists (select 1 from escalations e where e.beneficiary_id = b.id and e.status <> 'resolved') as escalated,
  (select e.reason from escalations e where e.beneficiary_id = b.id and e.status <> 'resolved' order by raised_at desc limit 1) as escalation_reason,
  coalesce(
    case
      when b.rag_override is not null then b.rag_override
      when exists (select 1 from v_intervention_rag v where v.beneficiary_id = b.id and v.rag = 'red')   then 'red'::rag
      when exists (select 1 from v_intervention_rag v where v.beneficiary_id = b.id and v.rag = 'amber') then 'amber'::rag
      else 'green'::rag
    end, 'green'::rag) as rag
from beneficiaries b
join sponsors sp on sp.id = b.sponsor_id
left join aggregators ag on ag.id = sp.aggregator_id;

-- Nightly escalation sweep. Schedule with pg_cron:
--   select cron.schedule('uca-sla','0 4 * * *','select raise_sla_escalations()');
create or replace function raise_sla_escalations()
returns int language plpgsql security definer as $$
declare n int := 0;
begin
  insert into escalations (beneficiary_id, intervention_id, trigger, reason)
  select i.beneficiary_id, i.id, 'no_response_3_days',
         'No beneficiary response in 3 working days on ' || coalesce(i.custom_name, cat.name, 'intervention')
  from interventions i
  left join intervention_catalogue cat on cat.id = i.catalogue_id
  where i.status <> 'completed'
    and i.closeout_status <> 'requested'
    and working_days_since(i.awaiting_response_since) >= 3
    and not exists (select 1 from escalations e where e.intervention_id = i.id and e.status <> 'resolved');
  get diagnostics n = row_count;

  insert into escalations (beneficiary_id, trigger, reason)
  select b.id, 'two_missed_welcome_parties', 'Beneficiary missed two welcome parties'
  from beneficiaries b
  where b.missed_welcome_parties >= 2
    and not exists (select 1 from escalations e where e.beneficiary_id = b.id and e.trigger = 'two_missed_welcome_parties' and e.status <> 'resolved');
  return n;
end; $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table aggregators            enable row level security;
alter table sponsors               enable row level security;
alter table clients                enable row level security;
alter table profiles               enable row level security;
alter table intervention_catalogue enable row level security;
alter table beneficiaries          enable row level security;
alter table interventions          enable row level security;
alter table weekly_updates         enable row level security;
alter table comms_log              enable row level security;
alter table escalations            enable row level security;
alter table rag_overrides          enable row level security;
alter table beneficiary_events     enable row level security;
alter table notifications          enable row level security;

create or replace function my_role() returns uca_role
language sql stable security definer as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_internal() returns boolean
language sql stable security definer as $$ select coalesce(my_role() in ('exco','manco','consultant'), false) $$;

create or replace function is_manco() returns boolean
language sql stable security definer as $$ select coalesce(my_role() in ('exco','manco'), false) $$;

create or replace function is_admin() returns boolean
language sql stable security definer as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

-- sponsors an external user may see: their own sponsor, or every sponsor under their aggregator.
create or replace function my_sponsors() returns setof uuid
language sql stable security definer as $$
  select s.id from sponsors s
  join profiles p on p.id = auth.uid()
  where p.external_sponsor_id = s.id or p.external_client_id = s.aggregator_id
$$;

create policy p_profiles_read   on profiles for select using (auth.uid() = id or is_internal());
create policy p_profiles_self   on profiles for update using (auth.uid() = id);
create policy p_profiles_admin  on profiles for all    using (is_admin()) with check (is_admin());

create policy p_agg_read  on aggregators for select using (is_internal() or exists (select 1 from profiles p where p.id = auth.uid() and p.external_client_id = aggregators.id));
create policy p_agg_manco on aggregators for all using (is_manco()) with check (is_manco());
create policy p_sp_read   on sponsors for select using (is_internal() or sponsors.id in (select my_sponsors()));
create policy p_sp_manco  on sponsors for all using (is_manco()) with check (is_manco());

create policy p_cat_read  on intervention_catalogue for select using (is_internal());
create policy p_cat_admin on intervention_catalogue for all using (is_admin() or is_manco()) with check (is_admin() or is_manco());

create policy p_ben_read  on beneficiaries for select using (is_internal() or sponsor_id in (select my_sponsors()));
create policy p_ben_write on beneficiaries for all using (is_manco()) with check (is_manco());

create policy p_iv_read on interventions for select using (
  is_internal() or beneficiary_id in (select id from beneficiaries where sponsor_id in (select my_sponsors()))
);
create policy p_iv_manco on interventions for all using (is_manco()) with check (is_manco());
create policy p_iv_consultant on interventions for update using (consultant_id = auth.uid()) with check (consultant_id = auth.uid());

-- weekly updates + comms are INTERNAL ONLY. Externals never see the trail.
create policy p_wu_read  on weekly_updates for select using (is_internal());
create policy p_wu_write on weekly_updates for insert with check (is_internal());
create policy p_wu_edit  on weekly_updates for update using (author_id = auth.uid() or is_manco());

create policy p_cm_read  on comms_log for select using (is_internal());
create policy p_cm_write on comms_log for insert with check (is_internal());
create policy p_cm_edit  on comms_log for update using (author_id = auth.uid() or is_manco());

-- overrides are internal record.
create policy p_ov_read  on rag_overrides for select using (is_internal());
create policy p_ov_write on rag_overrides for insert with check (is_manco());

-- beneficiary activity log: internal only.
create policy p_bev_read  on beneficiary_events for select using (is_internal());
create policy p_bev_write on beneficiary_events for insert with check (is_internal());

-- notifications: a user sees and updates only their own.
create policy p_ntf_read  on notifications for select using (user_id = auth.uid());
create policy p_ntf_write on notifications for insert with check (is_internal());
create policy p_ntf_edit  on notifications for update using (user_id = auth.uid());

-- escalations ARE visible to the client/sponsor - that is the point of the portal.
create policy p_esc_read  on escalations for select using (
  is_internal() or beneficiary_id in (select id from beneficiaries where sponsor_id in (select my_sponsors()))
);
create policy p_esc_write on escalations for insert with check (is_internal());
create policy p_esc_edit  on escalations for update using (is_manco());
