-- 0010_rag_reason_completed.sql
-- Fix: a completed intervention returned rag='green' but its rag_reason still fell through to
-- 'Past due date' (the reason CASE had no completed branch), so verified/closed work displayed
-- "past due". Add a `status = 'completed' -> NULL` branch to the rag_reason CASE, mirroring the
-- rag value CASE. (Recreates v_intervention_rag with security_invoker=on; columns unchanged so the
-- dependent v_beneficiary_rag stays valid.)

create or replace view v_intervention_rag with (security_invoker=on) as
 SELECT i.id, i.beneficiary_id, i.kind, i.catalogue_id, i.custom_name, i.custom_kind, i.custom_budget,
    i.custom_motivation, i.consultant_id, i.status, i.hold_reason, i.start_date, i.due_date, i.completed_at,
    i.awaiting_response_since, i.closeout_status, i.closeout_requested_by, i.closeout_requested_at,
    i.closeout_confirmed_by, i.closeout_confirmed_at, i.closeout_subfolder_url, i.closeout_email_sent,
    i.closeout_email_text, i.response_extended_until, i.cancelled, i.removed_at, i.removed_by, i.cycle,
    i.assigned_at, i.acknowledged, i.acknowledged_at, i.drive_folder_url, i.poe_url, i.closeout_report_url,
    i.rag_override, i.rag_override_reason, i.created_at,
    b.sponsor_id AS _sponsor_id,
    CASE WHEN i.kind = 'custom'::iv_kind THEN COALESCE(i.custom_name, 'Custom intervention'::text)
         ELSE COALESCE(cat.name, 'Intervention'::text) END AS title,
    CASE WHEN i.kind = 'custom'::iv_kind THEN 'Custom · '::text || COALESCE(i.custom_kind::text, 'other'::text)
         ELSE COALESCE(cat.category, '-'::text) END AS category,
    cons.full_name AS consultant_name,
    b.name AS beneficiary_name,
    working_days_since(i.awaiting_response_since) AS days_awaiting,
    ( SELECT max(wu.created_at) FROM weekly_updates wu WHERE wu.intervention_id = i.id) AS last_update_at,
    CASE
        WHEN i.rag_override IS NOT NULL THEN i.rag_override
        WHEN i.status = 'completed'::iv_status THEN 'green'::rag
        WHEN i.closeout_status = 'requested'::closeout_state THEN 'green'::rag
        WHEN (EXISTS ( SELECT 1 FROM escalations e WHERE e.intervention_id = i.id AND e.status <> 'resolved'::esc_status)) THEN 'red'::rag
        WHEN i.response_extended_until IS NOT NULL AND i.response_extended_until > CURRENT_DATE THEN 'amber'::rag
        WHEN working_days_since(i.awaiting_response_since) >= 3 THEN 'red'::rag
        WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE THEN 'red'::rag
        WHEN COALESCE(( SELECT max(wu.created_at) FROM weekly_updates wu WHERE wu.intervention_id = i.id), i.created_at) < (now() - '10 days'::interval) THEN 'red'::rag
        WHEN i.status = 'on_hold'::iv_status THEN 'amber'::rag
        WHEN i.status = 'awaiting_beneficiary'::iv_status THEN 'amber'::rag
        WHEN i.due_date IS NOT NULL AND i.due_date <= (CURRENT_DATE + 3) THEN 'amber'::rag
        WHEN COALESCE(( SELECT max(wu.created_at) FROM weekly_updates wu WHERE wu.intervention_id = i.id), i.created_at) < (now() - '7 days'::interval) THEN 'amber'::rag
        ELSE 'green'::rag
    END AS rag,
    CASE
        WHEN i.rag_override IS NOT NULL THEN i.rag_override_reason
        WHEN i.status = 'completed'::iv_status THEN NULL::text
        WHEN i.closeout_status = 'requested'::closeout_state THEN 'Close-out awaiting ManCo confirmation'::text
        WHEN (EXISTS ( SELECT 1 FROM escalations e WHERE e.intervention_id = i.id AND e.status <> 'resolved'::esc_status)) THEN ( SELECT e.reason FROM escalations e WHERE e.intervention_id = i.id AND e.status <> 'resolved'::esc_status ORDER BY e.raised_at DESC LIMIT 1)
        WHEN i.response_extended_until IS NOT NULL AND i.response_extended_until > CURRENT_DATE THEN 'Allowable delay granted until '::text || to_char(i.response_extended_until::timestamp with time zone, 'DD Mon'::text)
        WHEN working_days_since(i.awaiting_response_since) >= 3 THEN ('No beneficiary response in '::text || working_days_since(i.awaiting_response_since)) || ' working days'::text
        WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE THEN 'Past due date'::text
        WHEN i.status = 'on_hold'::iv_status THEN COALESCE(i.hold_reason, 'On hold'::text)
        WHEN i.status = 'awaiting_beneficiary'::iv_status THEN COALESCE(i.hold_reason, 'Awaiting beneficiary'::text)
        ELSE NULL::text
    END AS rag_reason
   FROM interventions i
     JOIN beneficiaries b ON b.id = i.beneficiary_id
     LEFT JOIN intervention_catalogue cat ON cat.id = i.catalogue_id
     LEFT JOIN profiles cons ON cons.id = i.consultant_id;
