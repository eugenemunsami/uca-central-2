-- 0008_beneficiary_company.sql
-- A real beneficiary (company) can be funded by several sponsors/invoices. Each beneficiary row is
-- one funding line; rows sharing company_id are the same company. Consultants see one card per
-- company (all interventions together); Exco/ManCo/funders see the lines separately.
-- Additive + inert: existing single-sponsor beneficiaries (company_id null) are a company of one.

alter table beneficiaries add column if not exists company_id uuid;
alter table beneficiaries add column if not exists invoice_number text;

-- Backfill the invoice each live beneficiary was converted from.
update beneficiaries b
   set invoice_number = o.invoice_number
  from onboardings o
 where o.converted_beneficiary_id = b.id
   and b.invoice_number is null;

-- Merge the two Farmers Hope funding lines (INV-337 primary + INV-338) into one company.
update beneficiaries set company_id = '41272ac8-0c3d-4edf-a2d8-cd9c1ece351c'
 where id in ('41272ac8-0c3d-4edf-a2d8-cd9c1ece351c','2fb6fb5e-601e-4dd1-a5d7-4276cfa93a44');

-- Carry the invoice number forward on future conversions.
create or replace function public.app_convert_onboarding(p_onboarding uuid)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare o public.onboardings; new_ben uuid;
begin
  if not is_manco() then raise exception 'Only ManCo or Exco can convert an onboarding'; end if;
  select * into o from onboardings where id = p_onboarding;
  if o.id is null then raise exception 'Onboarding not found'; end if;
  if o.converted_beneficiary_id is not null then return o.converted_beneficiary_id; end if;

  insert into beneficiaries
    (name, sponsor_id, budget, invoice_number, project_manager_id, contact_person, contact_email, contact_phone,
     industry, needs_onsite, ember360_report_url, drive_folder_url, sow_url, sow_signed_date,
     missed_welcome_parties, stage, lifecycle, cycle)
  values
    (o.name, o.sponsor_id, o.budget, o.invoice_number, o.manco_id, o.contact_person, o.contact_email, o.contact_phone,
     o.industry, coalesce(o.needs_onsite,false), o.ember360_report_url, o.drive_folder_url, o.sow_url, o.sow_signed_date,
     coalesce(o.missed_welcome_parties,0), 'implementation', 'active', 1)
  returning id into new_ben;

  update onboardings
     set status='converted', converted_beneficiary_id=new_ben, current_owner_id=null, last_action_at=now()
   where id = p_onboarding;

  insert into onboarding_events (onboarding_id, user_id, kind, to_status, text)
  values (p_onboarding, auth.uid(), 'converted', 'converted', 'SOW signed — beneficiary created in Central.');

  insert into beneficiary_events (beneficiary_id, user_id, kind, text)
  values (new_ben, auth.uid(), 'loaded', 'Onboarded from the onboarding pipeline (SOW signed).');

  return new_ben;
end $function$;

-- Expose company_id + invoice_number on the RAG view the app reads from.
create or replace view v_beneficiary_rag with (security_invoker=on) as
 WITH cur AS (
   SELECT v.id, v.beneficiary_id, v.status, v.closeout_status, v.cancelled, v.removed_at, v.cycle, v.rag
     FROM v_intervention_rag v
     JOIN beneficiaries bb ON bb.id = v.beneficiary_id
    WHERE COALESCE(v.cancelled,false)=false AND v.removed_at IS NULL AND COALESCE(v.cycle,1)=COALESCE(bb.cycle,1)
 )
 SELECT b.id, b.name, b.sponsor_id, b.industry, b.contact_person, b.contact_email, b.contact_phone,
    b.directors, b.stage, b.project_manager_id, b.ember360_report_url, b.welcome_party_date,
    b.missed_welcome_parties, b.sow_signed_date, b.sow_url, b.expected_completion, b.last_engagement_at,
    b.needs_onsite, b.outstanding_items, b.rag_override, b.rag_override_reason, b.drive_folder_url,
    b.lifecycle, b.cycle, b.closeout_report_url, b.closeout_return_notes, b.concluded_at, b.archived_at,
    b.removed_at, b.removed_by, b.created_at,
    sp.name AS sponsor_name, ag.id AS aggregator_id, ag.name AS aggregator_name,
    COALESCE(ag.id, sp.id) AS client_id, COALESCE(ag.name, sp.name) AS client_name,
    pm.full_name AS pm_name,
    (SELECT count(*) FROM cur WHERE cur.beneficiary_id=b.id) AS intervention_count,
    (SELECT count(*) FROM cur WHERE cur.beneficiary_id=b.id) AS active_intervention_count,
    (SELECT count(*) FROM cur WHERE cur.beneficiary_id=b.id AND cur.status='completed'::iv_status) AS completed_count,
    (SELECT count(*)>0 AND bool_and(cur.closeout_status='confirmed'::closeout_state) FROM cur WHERE cur.beneficiary_id=b.id) AS all_interventions_closed,
    COALESCE(ARRAY(SELECT p.id FROM profiles p WHERE p.role='external'::uca_role AND (p.external_sponsor_id=b.sponsor_id OR ag.id IS NOT NULL AND p.external_client_id=ag.id)),'{}'::uuid[]) AS recipient_ids,
    (EXISTS (SELECT 1 FROM escalations e WHERE e.beneficiary_id=b.id AND e.status<>'resolved'::esc_status)) AS escalated,
    (SELECT e.reason FROM escalations e WHERE e.beneficiary_id=b.id AND e.status<>'resolved'::esc_status ORDER BY e.raised_at DESC LIMIT 1) AS escalation_reason,
    (SELECT wu.next_action FROM weekly_updates wu JOIN cur ON cur.id=wu.intervention_id AND cur.beneficiary_id=b.id ORDER BY wu.created_at DESC LIMIT 1) AS next_action,
    (SELECT max(wu.created_at) FROM weekly_updates wu JOIN cur ON cur.id=wu.intervention_id AND cur.beneficiary_id=b.id) AS last_update_at,
    COALESCE(CASE
        WHEN b.rag_override IS NOT NULL THEN b.rag_override
        WHEN (EXISTS (SELECT 1 FROM cur WHERE cur.beneficiary_id=b.id AND cur.rag='red'::rag)) THEN 'red'::rag
        WHEN (EXISTS (SELECT 1 FROM cur WHERE cur.beneficiary_id=b.id AND cur.rag='amber'::rag)) THEN 'amber'::rag
        ELSE 'green'::rag END, 'green'::rag) AS rag,
    b.company_id,
    b.invoice_number
   FROM beneficiaries b
     JOIN sponsors sp ON sp.id=b.sponsor_id
     LEFT JOIN aggregators ag ON ag.id=sp.aggregator_id
     LEFT JOIN profiles pm ON pm.id=b.project_manager_id;
