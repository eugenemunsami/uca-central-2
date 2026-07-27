-- =====================================================================
-- Wire the notification bell, the activity timeline, and the background
-- sweeps for LIVE mode.
--
-- Until now these side-effects only ran against the in-memory demo store,
-- so in production the bell stayed silent, the beneficiary/user history
-- looked empty, and nothing auto-flagged. This migration adds:
--
--   1. SECURITY DEFINER helpers the client calls to write notifications /
--      audit events. They bypass RLS in a controlled way so that even an
--      EXTERNAL client (acknowledging or returning a close-out) can trigger
--      the internal alerts — which the row-level policies would otherwise
--      block (they require is_internal()). Every helper refuses to run for
--      an unauthenticated caller and never lets the actor notify themselves.
--
--   2. A trigger that moves a beneficiary into the ManCo close-out queue and
--      alerts them exactly once, the moment its last intervention is
--      confirmed closed (replaces the demo's on-read sweep, race-free).
--
--   3. Two pg_cron sweeps: expire stale invitations, and raise an internal
--      early-warning when an intervention goes red with no active escalation.
-- =====================================================================

-- ---- 1. notification / audit-event helpers -------------------------------

-- Notify a set of known users. action_owner (if given) gets action_required.
create or replace function public.app_notify(
  recipient_ids uuid[], p_kind text, p_text text,
  p_action_owner uuid default null, p_esc text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into notifications (user_id, kind, text, escalation_id, action_required)
  select distinct u, p_kind, p_text, p_esc, (u = p_action_owner)
  from unnest(recipient_ids) as u
  where u is not null and u <> auth.uid();
end $$;

-- Notify the external client watchers (sponsor / aggregator) of a beneficiary.
create or replace function public.app_notify_client(p_ben uuid, p_kind text, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into notifications (user_id, kind, text, action_required)
  select distinct p.id, p_kind, p_text, false
  from profiles p
  join beneficiaries b on b.id = p_ben
  left join sponsors s on s.id = b.sponsor_id
  where p.role = 'external'
    and coalesce(p.active, true) = true and p.removed_at is null
    and ( p.external_sponsor_id = b.sponsor_id
       or (s.aggregator_id is not null and p.external_client_id = s.aggregator_id) )
    and p.id <> auth.uid();
end $$;

-- Notify every active ManCo / Exco.
create or replace function public.app_notify_manco(p_kind text, p_text text, p_action boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into notifications (user_id, kind, text, action_required)
  select p.id, p_kind, p_text, p_action
  from profiles p
  where p.role in ('manco','exco')
    and coalesce(p.active, true) = true and p.removed_at is null
    and p.id <> auth.uid();
end $$;

-- Append a beneficiary-timeline event.
create or replace function public.app_log_ben_event(p_ben uuid, p_user uuid, p_kind text, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into beneficiary_events (beneficiary_id, user_id, kind, text)
  values (p_ben, p_user, p_kind, p_text);
end $$;

-- Append a user-history event.
create or replace function public.app_log_user_event(p_target uuid, p_by uuid, p_kind text, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into user_events (target_user_id, by_user_id, kind, text)
  values (p_target, p_by, p_kind, p_text);
end $$;

revoke all on function public.app_notify(uuid[],text,text,uuid,text) from public;
revoke all on function public.app_notify_client(uuid,text,text) from public;
revoke all on function public.app_notify_manco(text,text,boolean) from public;
revoke all on function public.app_log_ben_event(uuid,uuid,text,text) from public;
revoke all on function public.app_log_user_event(uuid,uuid,text,text) from public;
grant execute on function public.app_notify(uuid[],text,text,uuid,text) to authenticated;
grant execute on function public.app_notify_client(uuid,text,text) to authenticated;
grant execute on function public.app_notify_manco(text,text,boolean) to authenticated;
grant execute on function public.app_log_ben_event(uuid,uuid,text,text) to authenticated;
grant execute on function public.app_log_user_event(uuid,uuid,text,text) to authenticated;

-- ---- 2. auto-flag: beneficiary ready for close-out -----------------------
-- Fires the instant an intervention's close-out is confirmed (or the set of
-- active interventions changes). When every current-cycle, non-cancelled,
-- non-hidden intervention is confirmed, move the beneficiary to the ManCo
-- close-out queue and alert them — once (guarded by the lifecycle flip).
create or replace function public.fn_ben_closeout_ready() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_life text; v_cycle int; v_total int; v_confirmed int;
begin
  select name, lifecycle, cycle into v_name, v_life, v_cycle
    from beneficiaries where id = new.beneficiary_id;
  if v_name is null or v_life <> 'active' then return new; end if;
  select count(*), count(*) filter (where closeout_status = 'confirmed')
    into v_total, v_confirmed
    from interventions
    where beneficiary_id = new.beneficiary_id
      and cancelled = false and removed_at is null and cycle = v_cycle;
  if v_total > 0 and v_total = v_confirmed then
    update beneficiaries set lifecycle = 'pending_closeout'
      where id = new.beneficiary_id and lifecycle = 'active';
    if found then
      insert into beneficiary_events (beneficiary_id, user_id, kind, text)
        values (new.beneficiary_id, null, 'note',
                'All interventions closed out — ready for beneficiary close-out.');
      insert into notifications (user_id, kind, text, action_required)
        select id, 'beneficiary_closeout_ready',
               v_name || ' is ready for beneficiary close-out.', true
          from profiles
         where role in ('manco','exco') and coalesce(active,true) = true and removed_at is null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ben_closeout_ready on interventions;
create trigger trg_ben_closeout_ready
after insert or update of closeout_status, cancelled, removed_at, cycle on interventions
for each row execute function public.fn_ben_closeout_ready();

-- ---- 3. background sweeps -------------------------------------------------

-- Expire invitations whose 72h window has elapsed.
create or replace function public.sweep_invite_expiry() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set status = 'invitation_expired'
   where status = 'pending'
     and invite_expires_at is not null
     and invite_expires_at < now();
end $$;

-- Early warning: an intervention is red, with no active escalation and no
-- prior warning yet -> alert the consultant + PM internally (once each).
create or replace function public.sweep_early_warning() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, text, escalation_id, action_required)
  select distinct t.uid, 'sla_breach_internal',
         'SLA breach on ' || vr.beneficiary_name || ' — act before it escalates.',
         'sla:' || vr.id::text, true
    from v_intervention_rag vr
    join beneficiaries b on b.id = vr.beneficiary_id
    cross join lateral (values (vr.consultant_id), (b.project_manager_id)) as t(uid)
   where vr.rag = 'red'
     and vr.cancelled = false and vr.removed_at is null
     and vr.status <> 'completed' and vr.closeout_status <> 'requested'
     and t.uid is not null
     and not exists (select 1 from escalations e
                      where e.intervention_id = vr.id and e.status <> 'resolved')
     and not exists (select 1 from notifications n
                      where n.escalation_id = 'sla:' || vr.id::text);
end $$;

-- Schedule both sweeps every 15 minutes (idempotent re-schedule).
create extension if not exists pg_cron;
select cron.unschedule(jobname)
  from cron.job where jobname in ('uca-invite-expiry','uca-early-warning');
select cron.schedule('uca-invite-expiry', '*/15 * * * *', $$select public.sweep_invite_expiry();$$);
select cron.schedule('uca-early-warning', '*/15 * * * *', $$select public.sweep_early_warning();$$);

-- ---- 4. lock down function grants ---------------------------------------
-- App helpers: signed-in users only (guarded internally anyway; anon is a no-op).
revoke execute on function public.app_notify(uuid[],text,text,uuid,text) from anon;
revoke execute on function public.app_notify_client(uuid,text,text) from anon;
revoke execute on function public.app_notify_manco(text,text,boolean) from anon;
revoke execute on function public.app_log_ben_event(uuid,uuid,text,text) from anon;
revoke execute on function public.app_log_user_event(uuid,uuid,text,text) from anon;
-- Sweeps + close-out trigger fn are cron/trigger machinery — never API-callable.
revoke all on function public.sweep_invite_expiry() from public, anon, authenticated;
revoke all on function public.sweep_early_warning() from public, anon, authenticated;
revoke all on function public.fn_ben_closeout_ready() from public, anon, authenticated;
