-- =====================================================================
-- Let escalation participants (including external sponsors) create the
-- notifications that a hand-off produces. The original policy only allowed
-- internal users to insert notifications, so when a sponsor declined or
-- resolved an escalation the ManCo alert was blocked by RLS.
-- =====================================================================
drop policy if exists p_ntf_write on notifications;
create policy p_ntf_write on notifications for insert with check (
  is_internal()
  or exists (
    select 1 from escalations e
    where e.id::text = notifications.escalation_id
      and auth.uid() = any(e.participants)
  )
);
