-- 0018_notify_onb_sponsor.sql
-- When an onboarding ticket is escalated to the Aggregator/Sponsor (status esc_sponsor), the sponsor
-- ACCOUNT(s) must be notified — not just the internal participants. This SECURITY DEFINER helper
-- inserts an action-required notification for every external user linked to the ticket's sponsor
-- (directly via external_sponsor_id, or via the sponsor's aggregator via external_client_id). Mirrors
-- app_notify_client, but keyed off an onboarding row instead of a beneficiary. Additive.

create or replace function public.app_notify_onb_sponsor(p_onboarding uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into notifications (user_id, kind, text, action_required)
  select distinct p.id, 'onboarding', p_text, true
  from onboardings o
  join sponsors s on s.id = o.sponsor_id
  join profiles p on p.role = 'external'
    and coalesce(p.active, true) = true and p.removed_at is null
    and ( p.external_sponsor_id = o.sponsor_id
       or (s.aggregator_id is not null and p.external_client_id = s.aggregator_id) )
  where o.id = p_onboarding and p.id <> auth.uid();
end $$;

revoke all on function public.app_notify_onb_sponsor(uuid, text) from public;
grant execute on function public.app_notify_onb_sponsor(uuid, text) to authenticated;
revoke execute on function public.app_notify_onb_sponsor(uuid, text) from anon;
