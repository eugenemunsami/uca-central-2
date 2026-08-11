-- load_nedbank.sql  ·  Nedbank SIU SMME Investment Readiness Programme (sponsor 'Nedbank SIU').
-- CTE-per-SMME, DB-generated UUIDs. 15 beneficiaries (Ember360+DD complete); each: DD intervention (completed)
-- + 6-session coaching intervention. Owner: Boitumelo Matobela (manco); coaches preserved in history.
-- 10 open escalations raised with Nedbank SIU (9 Escalation Log + NED-012 master flag). Stage: Tranche 1 Complete
-- -> monitoring, else implementation. RAG pinned to the tracker via overrides.
begin;

-- NED-001  Bokamoso Farmers Academy  [Escalated -> implementation, red, 1/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Bokamoso Farmers Academy','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Agriculture / Training','[]'::jsonb,'implementation','active','8957f6bb-9b23-4412-9c14-d25d3e2088de',null,'red'::rag,'Attended 1 of 6 sessions while requesting funding. P1 escalation; meeting held with Hiten 28 July 2026.',1,'2026-08-05','2026-04-08') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 28.2 (NOT ELIGIBLE / PRE-WORK). Weakest at baseline: Funding Readiness and Debt Servicability (3). Province: Gauteng.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-08','na','2026-04-08',true,now(),'2026-04-08',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mark Frankel / Mohamed E. Tayob. 1 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 1 of 6 on file. Single session evidenced. Escalation ladder in place as fallback.','8957f6bb-9b23-4412-9c14-d25d3e2088de','in_progress',null,null,'na','2026-04-08',true,now(),'2026-04-08','red'::rag,'Attended 1 of 6 sessions while requesting funding. P1 escalation; meeting held with Hiten 28 July 2026.',1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','One session evidenced of six, while a funding request is in progress. Meeting held with Hiten 28 July.',null,'Confirm outcome of the Hiten meeting and whether remaining sessions will be scheduled','Rinaldo Josie','2026-08-05' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Low Session Attendance','Attended 1 of 6 sessions while requesting funding. P1 escalation; meeting held with Hiten 28 July 2026.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-08-05','2026-08-05' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-08-05','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Low Session Attendance: Attended 1 of 6 sessions while requesting funding. P1 escalation; meeting held with Hiten 28 July 2026.' from e;

-- NED-002  Shodulla 1 Construction CC  [Tranche 1 Complete -> monitoring, green, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Shodulla 1 Construction CC','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Waste & Recycling','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Debt schedule and management accounts outstanding (4th consecutive session)','green'::rag,'Debt schedule & management accounts outstanding (4th session); single-founder dependency',1,'2026-07-24','2025-04-01') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 22.7 (NOT ELIGIBLE / PRE-WORK). Weakest at baseline: Financial Discipline & Profitability (2.3). Province: Mpumalanga. Compliance: CIPC, tax and BEE current.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2025-04-01','na','2025-04-01',true,now(),'2025-04-01',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mark Frankel. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 4/10.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-24',null,'na','2025-04-01',true,now(),'2025-04-01',null,null,1 from b returning id)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','BS2 close-out. 3 new contracts (18 on The Hill, Amani, Sandriham); clients 83 to 86; revenue R672,396 vs R389k at BS1. Budget template completed.',null,'Obtain debt schedule and management accounts - outstanding a 4th consecutive session','Incoming coach','2026-07-24' from ivb;

-- NED-003  Lungile Poultry Farm  [Tranche 1 Complete -> monitoring, red, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Lungile Poultry Farm','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Agriculture - Poultry','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','No written proof of UIF / COIDA / BEE on file','red'::rag,'CRITICAL: bank balance R0 at close; 4 of 9 staff paid; personal loan sought for payroll; feed debt escalating. Funding distress & cash flow crisis HIGH, escalation required.',1,'2026-08-03','2026-08-05') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 27 (ELIGIBLE). Weakest at baseline: Banking Behaviour and Creditworthiness (3). Compliance: UIF, COIDA and BEE verbally confirmed only.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-08-05','na','2026-08-05',true,now(),'2026-08-05',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mohamed E. Tayob. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 4/10. Pre-programme funding R5.9m (monthly) - not programme-attributable. R1,505,000 UCH/Nedbank application drafted in session.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-08-03',null,'na','2026-08-05',true,now(),'2026-08-05',null,null,1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','Final session. Bank balance R0 - lowest of the programme. Only 4 of 9 staff paid; entrepreneur applying for a personal loan to cover payroll. UIF/COIDA/BEE verbally confirmed for the first time. R1,505,000 UCH/Nedbank application drafted in session.',null,'ESCALATE: funding distress and cash flow crisis both HIGH with escalation required','Rinaldo Josie','2026-08-03' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Funding Distress / Cash Flow Crisis','Bank balance R0 at final session (3 Aug 2026); only 4 of 9 staff paid; entrepreneur seeking a personal loan to cover payroll; feed debt escalating. Both risks HIGH, escalation marked Yes by the coach. R1,505,000 UCH/Nedbank application drafted in session.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-08-03','2026-08-03' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-08-03','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Funding Distress / Cash Flow Crisis: Bank balance R0 at final session (3 Aug 2026); only 4 of 9 staff paid; entrepreneur seeking a personal loan to cover payroll; feed debt escalating. Both risks HIGH, escalation marked Yes by the coach. R1,505,000 UCH/Nedbank application drafted in session.' from e;

-- NED-004  VEZ Technology  [Tranche 1 Complete -> monitoring, green, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'VEZ Technology','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Technology','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Staff files incomplete - ID copies and addresses','green'::rag,'Overdraft ~R340k at close; staff files incomplete (ID copies and addresses) - CCMA exposure',1,'2026-07-28','2026-08-05') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 26.5 (ELIGIBLE). Weakest at baseline: Financial Discipline & Profitability (3.5). Compliance: All current: BEE renewed, VAT, SARS, PAYE, staff contracts.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-08-05','na','2026-08-05',true,now(),'2026-08-05',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mohamed E. Tayob. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 5/10. BEE renewed after expiring at S1. 4 financial systems in active use at close. Pre-programme funding R510,000; R0 new during programme.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-28',null,'na','2026-08-05',true,now(),'2026-08-05',null,null,1 from b returning id)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','Final session. BEE certificate renewed after expiring at S1; all compliance gaps closed. Four financial systems in active use at close. Bankability 3 to 5 - largest movement in the cohort. One temporary worker added at S3 (13 July).',null,'Staff files incomplete (IDs and addresses) - CCMA exposure; working capital application not yet submitted','Incoming coach','2026-07-28' from ivb;

-- NED-005  Vultures Waste and Projects (Takuwauime Pty Ltd)  [Tranche 1 Complete -> monitoring, red, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Vultures Waste and Projects (Takuwauime Pty Ltd)','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Waste Management','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Written SARS / PAYE letter outstanding (2nd session)','red'::rag,'Non-responsiveness flagged HIGH - escalation marked Yes; written SARS/PAYE letter outstanding',1,'2026-07-24','2026-08-05') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 27 (ELIGIBLE). Weakest at baseline: Operational Capacity and Scalability (3). Compliance: Verbally confirmed.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-08-05','na','2026-08-05',true,now(),'2026-08-05',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mark Frankel. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 5/10.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-24',null,'na','2026-08-05',true,now(),'2026-08-05',null,null,1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','BS2 close-out. Driver and assistant driver completed spill control, first aid, dangerous goods and fire safety training. Bankability held at 5/10.',null,'Escalation: non-responsiveness flagged HIGH at close-out','Rinaldo Josie','2026-07-24' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Non-Responsiveness','Flagged HIGH at BS2 close-out with escalation marked Yes by the coach.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-07-24','2026-07-24' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-07-24','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Non-Responsiveness: Flagged HIGH at BS2 close-out with escalation marked Yes by the coach.' from e;

-- NED-006  Mmula Group 20 Trading and Projects  [Tranche 1 Complete -> monitoring, green, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Mmula Group 20 Trading and Projects','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Trading & Projects','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','DoL letter of good standing; budget and cash flow forecast','green'::rag,'Cash flow forecast & budget outstanding (3rd session); DoL letter of good standing outstanding',1,'2026-07-22','2026-04-07') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 24.7 (ELIGIBLE). Weakest at baseline: Market Demand and Revenue Sustainability (2.7). Compliance: UIF assessment completed and paid.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-07','na','2026-04-07',true,now(),'2026-04-07',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mark Frankel. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 6/10.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-22',null,'na','2026-04-07',true,now(),'2026-04-07',null,null,1 from b returning id)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','BS2 close-out. UIF assessment completed and paid. R3.5m HDEC/ABC Solar application submitted ahead of the 17 July deadline.',null,'Obtain written DoL letter of good standing; budget and cash flow forecast outstanding','Incoming coach','2026-07-22' from ivb;

-- NED-007  Matome Frans Construction and Projects CC  [Tranche 1 Complete -> monitoring, amber, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Matome Frans Construction and Projects CC','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Agriculture / Construction','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','S4 and S5 booklets; seasonal register needs verification','amber'::rag,'All 6 sessions delivered per programme records, but S4 and S5 booklets are NOT on file - a reporting gap, not a delivery gap; overdraft -R365k exhausted; debt consolidation requires legal review. Seasonal register contains duplicate names and one worker recorded as 16 years old - verify before use as evidence.',1,'2026-07-29','2026-04-02') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 29.9 (ELIGIBLE). Weakest at baseline: Operational Capacity and Scalability (3.8). Province: Limpopo. Compliance: Compiled management accounts to 31 May 2026 on file.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-02','na','2026-04-02',true,now(),'2026-04-02',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mohamed E. Tayob. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 4 of 6 on file. Bankability 5/10. 101 unique part-time seasonal workers engaged Feb 2026 (3-week harvest, R1,120/week); 33 return for the August picking season - no new individuals. Pepperdew International offtake sealed (Sept 2026 cycle). Standard Bank Limpopo Agribusiness Development Programme accepted, terms TBC. R1,344,000 UCH/Nedbank application in progress.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-29',null,'na','2026-04-02',true,now(),'2026-04-02',null,null,1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','All six sessions delivered. S4 and S5 booklets are not on file - documentation outstanding, not missed delivery. Pepperdew International offtake sealed for the September planting cycle. Standard Bank Limpopo Agribusiness Development Programme accepted, terms TBC. Bankability 4 to 5.',null,'Obtain the S4 and S5 booklets from the coach - sessions delivered but not written up','Rinaldo Josie','2026-07-29' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Governance / Funding Distress','Debt consolidation requires legal and financial review before UCH/Nedbank funding is used to buy out VKB and West Bank facilities. Overdraft -R365k exhausted. R1,344,000 application in progress, disbursement timeline unconfirmed.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-07-29','2026-07-29' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-07-29','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Governance / Funding Distress: Debt consolidation requires legal and financial review before UCH/Nedbank funding is used to buy out VKB and West Bank facilities. Overdraft -R365k exhausted. R1,344,000 application in progress, disbursement timeline unconfirmed.' from e;

-- NED-008  TWC Recycling  [Tranche 1 Complete -> monitoring, red, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'TWC Recycling','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Waste & Recycling','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Tax clearance and PAYE unresolved - blocking Petco, Polycore, Fibre Cycle','red'::rag,'Cash R3,000 at close; Westbank loan 5+ months arrears on R120k with truck security exposure; tax clearance and PAYE unresolved, blocking Petco / Polycore / Fibre Cycle',1,'2026-07-29','2026-04-01') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 24.5 (NOT ELIGIBLE / PRE-WORK). Weakest at baseline: Compliance, Governance & Legal Readiness (3.1). Compliance: Partially compliant.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-01','na','2026-04-01',true,now(),'2026-04-01',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mohamed E. Tayob. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 4/10. Pre-programme funding R350,000. Weekly budgeting embedded; product-level GP model operational.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-29',null,'na','2026-04-01',true,now(),'2026-04-01',null,null,1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','Final session. Cash R3,000. Westbank loan 5+ months in arrears on R120k with truck security exposure; settlement discount offered but unanswered. Weekly budgeting embedded and product-level GP model operational. Bankability 3 to 4.',null,'ESCALATE debt arrears; tax clearance and PAYE still blocking Petco, Polycore and Fibre Cycle','Rinaldo Josie','2026-07-29' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Funding Distress / Debt Arrears','Westbank loan 5+ months in arrears on R120,000 with truck security exposure; settlement discount offered but unanswered. Cash R3,000 at programme close. Tax clearance and PAYE unresolved, blocking three funding routes.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-07-29','2026-07-29' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-07-29','69effdfb-6c59-4138-94a4-ea037030a1 ec' from e;