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
  select id,'2026-07-29','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Funding Distress / Debt Arrears: Westbank loan 5+ months in arrears on R120,000 with truck security exposure; settlement discount offered but unanswered. Cash R3,000 at programme close. Tax clearance and PAYE unresolved, blocking three funding routes.' from e;

-- NED-009  Trash Converters  [Tranche 1 Complete -> monitoring, green, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Trash Converters','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Waste Management','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Budget, cash flow forecast, bank reconciliation','green'::rag,'Budget & cash flow forecast not delivered; bank reconciliation outstanding',1,'2026-07-27','2026-08-05') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 29 (ELIGIBLE). Weakest at baseline: Operational Capacity and Scalability (3). Province: Limpopo. Compliance: All current: CIPC, SARS, UIF, BEE Level 1, insurance, COID.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-08-05','na','2026-08-05',true,now(),'2026-08-05',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mark Frankel. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 6/10.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-27',null,'na','2026-08-05',true,now(),'2026-08-05',null,null,1 from b returning id)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','BS2 close-out. R150,000 funding secured (Standard Bank Basali R100k, Limpopo Kasi Summit R50k). COID compliance cleared. Concor rate renegotiation closed with vendor number secured.',null,'Reconcile coach-reported June revenue (~R1,484,000) against FY2026 AFS and bank statements','Rinaldo Josie','2026-07-27' from ivb;

-- NED-010  Makhabisi Recycling and Trading CC  [In Delivery -> implementation, red, 4/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Makhabisi Recycling and Trading CC','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Waste & Recycling','[]'::jsonb,'implementation','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Rates clearance blocked by R1m+ municipal debt; 4 Malawian work permits unverified','red'::rag,'Governance HIGH: property transfer stalled, liquidated before clearance by the Master of the High Court, title uncertain. Compliance HIGH: municipal rates debt over R1m blocks rates clearance; 4 Malawian work permits unverified. Seller''s attorney unresponsive since 15 May.',1,'2026-07-30','2026-08-05') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 19 (NOT ELIGIBLE / PRE-WORK). Weakest at baseline: Business Track Record (2). Compliance: COIDA, UIF and tax clearance current; DFFE permit site visit scheduled.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-08-05','na','2026-08-05',true,now(),'2026-08-05',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Matthew Emmanuel. 4 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 4 of 6 on file. Bankability 4/10. R150,000 from Polyco for electricity reinstatement - funds still held by the contractor. Bidvest in-kind: solar, truck (ESD), PPE, strapping machines, bale bags. HR contracts and policies signed by all 40 staff. Staff sleeping at the factory to protect stock - safety risk.','8957f6bb-9b23-4412-9c14-d25d3e2088de','in_progress',null,null,'na','2026-08-05',true,now(),'2026-08-05','red'::rag,'Governance HIGH: property transfer stalled, liquidated before clearance by the Master of the High Court, title uncertain. Compliance HIGH: municipal rates debt over R1m blocks rates clearance; 4 Malawian work permits unverified. Seller''s attorney unresponsive since 15 May.',1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','Session 4. R150,000 secured from Polyco for electricity reinstatement (funds held by contractor); Bidvest in-kind support delivered. New employment contracts and HR policies signed by all 40 staff. Bankability 3 to 4.',null,'ESCALATE: property transfer stalled and municipal rates debt over R1m; verify 4 Malawian work permits','Rinaldo Josie','2026-07-30' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Governance / Compliance','Property transfer stalled: council will not issue a rates clearance certificate and the property was liquidated before clearance by the Master of the High Court, leaving title uncertain. Municipal rates debt over R1m (only R13,175 written off). Seller''s attorney unresponsive since 15 May. Four Malawian work permits unverified.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-07-30','2026-07-30' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-07-30','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Governance / Compliance: Property transfer stalled: council will not issue a rates clearance certificate and the property was liquidated before clearance by the Master of the High Court, leaving title uncertain. Municipal rates debt over R1m (only R13,175 written off). Seller''s attorney unresponsive since 15 May. Four Malawian work permits unverified.' from e;

-- NED-011  Our Poultry Place  [Tranche 1 Complete -> monitoring, green, 6/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Our Poultry Place','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Agriculture - Poultry','[]'::jsonb,'monitoring','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Insurance unresolved after 6 sessions; COIDA registration unverified','green'::rag,'Insurance unresolved after 6 sessions; COIDA unverified; cash flow forecast contains acknowledged errors',1,'2026-07-22','2026-04-08') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 25.2 (ELIGIBLE). Weakest at baseline: Impact & Social Value (2.8). Compliance: CIPC and tax current.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-08','na','2026-04-08',true,now(),'2026-04-08',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Mark Frankel. 6 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 6 of 6 on file. Bankability 5/10.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-07-22',null,'na','2026-04-08',true,now(),'2026-04-08',null,null,1 from b returning id)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','BS2 close-out. 2 jobs created effective 20 July (branch administrator, flexi-timer); headcount 30 to 32. Cash recovered to ~R320,000 from R78,000.',null,'Insurance and COIDA registration remain unresolved after six sessions','Incoming coach','2026-07-22' from ivb;

-- NED-012  Wasteq  [In Delivery -> implementation, amber, 0/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Wasteq','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Waste Management','[]'::jsonb,'implementation','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','Session delivery not yet evidenced','amber'::rag,'No sessions evidenced. Assessed ELIGIBLE at DD (83%, 15 Apr 2026) - one of the two highest scores in the cohort - but no coaching delivery on record.',1,'2026-04-15','2026-04-15') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 29.2 (ELIGIBLE). Weakest at baseline: Operational Capacity and Scalability (3.7). Compliance: Assessed at DD.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-15','na','2026-04-15',true,now(),'2026-04-15',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Matthew Emmanuel. 0 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 0 of 6 on file. DD filed under the entity name Rokiwaste (Pty) Ltd; Wasteq is the cohort/trading name. In-person meeting being scheduled.','8957f6bb-9b23-4412-9c14-d25d3e2088de','not_started',null,null,'na','2026-04-15',true,now(),'2026-04-15','amber'::rag,'No sessions evidenced. Assessed ELIGIBLE at DD (83%, 15 Apr 2026) - one of the two highest scores in the cohort - but no coaching delivery on record.',1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de',null,'DD filed under the entity name Rokiwaste (Pty) Ltd; Wasteq is the cohort/trading name. In-person meeting being scheduled.','Schedule first coaching session and confirm coach capacity',null,'2026-08-05' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Non-Delivery','Assessed ELIGIBLE at DD (83%, 15 Apr 2026), one of the two highest scores in the cohort, but no coaching delivery on record. DD filed under the entity name Rokiwaste (Pty) Ltd; Wasteq is the cohort/trading name. In-person meeting being scheduled.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-08-05','2026-08-05' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-08-05','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Non-Delivery: Assessed ELIGIBLE at DD (83%, 15 Apr 2026), one of the two highest scores in the cohort, but no coaching delivery on record. DD filed under the entity name Rokiwaste (Pty) Ltd; Wasteq is the cohort/trading name. In-person meeting being scheduled.' from e;

-- NED-013  Benica Projects  [Escalated -> implementation, red, 0/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Benica Projects','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Projects','[]'::jsonb,'implementation','active','8957f6bb-9b23-4412-9c14-d25d3e2088de',null,'red'::rag,'NO SESSIONS DELIVERED. Documented pattern of re-engagement followed by unresponsiveness. Approaching final contact attempt, then formal notice.',1,'2026-08-05','2026-04-13') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 27.6 (ELIGIBLE). Weakest at baseline: Market Demand and Revenue Sustainability (3.5).','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-13','na','2026-04-13',true,now(),'2026-04-13',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Matthew Emmanuel. 0 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 0 of 6 on file. Non-engagement, not a booklet lag. Nil delivery against a 6-session allocation.','8957f6bb-9b23-4412-9c14-d25d3e2088de','awaiting_beneficiary',null,'2026-08-05','na','2026-04-13',true,now(),'2026-04-13','red'::rag,'NO SESSIONS DELIVERED. Documented pattern of re-engagement followed by unresponsiveness. Approaching final contact attempt, then formal notice.',1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','No sessions delivered. Non-engagement confirmed - this is nil delivery against a 6-session allocation, not a booklet lag.',null,'Final contact attempt, then formal notice','Rinaldo Josie','2026-08-05' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Non-Engagement','Documented pattern of re-engagement followed by unresponsiveness. Approaching final contact attempt, then formal notice.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-08-05','2026-08-05' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-08-05','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Non-Engagement: Documented pattern of re-engagement followed by unresponsiveness. Approaching final contact attempt, then formal notice.' from e;

-- NED-014  Tshegofentse Facilities and Engineering CC  [In Delivery -> implementation, amber, 3/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Tshegofentse Facilities and Engineering CC','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Facilities & Hazardous Waste','[]'::jsonb,'implementation','active','8957f6bb-9b23-4412-9c14-d25d3e2088de','S1, S5 and S6 booklets not evidenced','amber'::rag,'S1, S5 and S6 not evidenced in the booklet. Revenue static at R280k-R300k. No response from Roky Waste on equipment; Nedbank VAF introduction outstanding.',1,'2026-07-30','2026-05-15') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 25 (NOT ELIGIBLE / PRE-WORK). Weakest at baseline: Financial Discipline & Profitability (3). Compliance: Compliant.','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-05-15','na','2026-05-15',true,now(),'2026-05-15',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Matthew Emmanuel. 3 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 3 of 6 on file. Bankability 5/10. NRF three-year contract R400,000 secured; clients 4 to 5. German trade mission October (visa collected, DTIC prep scheduled). Booklet states cumulative jobs 8 - only the 2 intern placements are evidenced; the earlier 6 cannot be traced. Cumulative funding shown as R1.2m but R0 accessed during the programme.','8957f6bb-9b23-4412-9c14-d25d3e2088de','in_progress',null,null,'na','2026-05-15',true,now(),'2026-05-15','amber'::rag,'S1, S5 and S6 not evidenced in the booklet. Revenue static at R280k-R300k. No response from Roky Waste on equipment; Nedbank VAF introduction outstanding.',1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','Session 4. Three-year NRF contract worth R400,000 secured; clients 4 to 5. Two 12-month intern placements confirmed. German trade mission visa collected for October. Bankability 4 to 5.',null,'Confirm whether S1, S5 and S6 were delivered; query the cumulative jobs figure of 8 and the R1.2m cumulative funding','Rinaldo Josie','2026-07-30' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Non-Responsiveness','No response from Roky Waste on equipment requirements; Nedbank VAF introduction still outstanding. Flagged with escalation marked Yes at Session 4.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-07-30','2026-07-30' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-07-30','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Non-Responsiveness: No response from Roky Waste on equipment requirements; Nedbank VAF introduction still outstanding. Flagged with escalation marked Yes at Session 4.' from e;

-- NED-015  Mohau Innovate  [Onboarding -> implementation, amber, 0/6]
with b as (
  insert into beneficiaries (name,sponsor_id,industry,directors,stage,lifecycle,project_manager_id,outstanding_items,rag_override,rag_override_reason,cycle,last_engagement_at,created_at) values (
    'Mohau Innovate','28d8ffac-d2fb-4ddb-acd7-86c580c23091','Technology / Innovation','[]'::jsonb,'implementation','active','8957f6bb-9b23-4412-9c14-d25d3e2088de',null,'amber'::rag,'No sessions delivered yet. Beneficiary has re-engaged; sessions to be scheduled.',1,'2026-08-05','2026-04-23') returning id),
iva as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,cycle)
  select b.id,'custom','Ember360 diagnostic & Due Diligence assessment','other','Category: Diagnostics & Due Diligence. Baseline DD readiness 25.9 (ELIGIBLE). Weakest at baseline: Market Demand and Revenue Sustainability (2.8).','8957f6bb-9b23-4412-9c14-d25d3e2088de','completed','2026-04-23','na','2026-04-23',true,now(),'2026-04-23',1 from b),
ivb as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,awaiting_response_since,discovery_status,discovery_at,acknowledged,acknowledged_at,assigned_at,rag_override,rag_override_reason,cycle)
  select b.id,'custom','Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)','other','Category: Coaching & Mentorship. Coach: Matthew Emmanuel. 0 of 6 sessions delivered (F1-F4, BS1, BS2); booklets 0 of 6 on file. Earlier conflict between Nedbank-confirmed non-engagement and a recorded active session now resolved - beneficiary is back, delivery pending.','8957f6bb-9b23-4412-9c14-d25d3e2088de','not_started',null,null,'na','2026-04-23',true,now(),'2026-04-23','amber'::rag,'No sessions delivered yet. Beneficiary has re-engaged; sessions to be scheduled.',1 from b returning id)
, wu as (
  insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,next_action,blocker_owner,created_at)
  select id,'8957f6bb-9b23-4412-9c14-d25d3e2088de','Beneficiary has re-engaged after the earlier status conflict. No sessions delivered yet; delivery to be scheduled.',null,'Schedule Session 1 and confirm coach capacity','Rinaldo Josie','2026-08-05' from ivb returning 1),
e as (
  insert into escalations (intervention_id,beneficiary_id,reason,context,status,current_owner_id,current_owner_role,consultant_id,manco_id,sponsor_id,participants,raised_by,raised_at,last_action_at)
  select ivb.id,b.id,'Status Conflict','Nedbank-confirmed non-engagement conflicts with a recorded active coaching session. Unresolved.','with_sponsor',null,'external','8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec',null,array['8957f6bb-9b23-4412-9c14-d25d3e2088de','69effdfb-6c59-4138-94a4-ea037030a1ec']::uuid[],'69effdfb-6c59-4138-94a4-ea037030a1ec','2026-08-05','2026-08-05' from ivb,b returning id)
insert into escalation_events (escalation_id,at,user_id,kind,to_status,text)
  select id,'2026-08-05','69effdfb-6c59-4138-94a4-ea037030a1ec','raised','with_sponsor','Status Conflict: Nedbank-confirmed non-engagement conflicts with a recorded active coaching session. Unresolved.' from e;

select (select count(*) from beneficiaries where sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091') bens,(select count(*) from interventions i join beneficiaries b on b.id=i.beneficiary_id where b.sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091') ivs,(select count(*) from escalations e join beneficiaries b on b.id=e.beneficiary_id where b.sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091') escs,(select count(*) from weekly_updates wu join interventions i on i.id=wu.intervention_id join beneficiaries b on b.id=i.beneficiary_id where b.sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091') wus;
commit;

-- ROLLBACK (Nedbank SIU only):
-- delete from escalation_events where escalation_id in (select e.id from escalations e join beneficiaries b on b.id=e.beneficiary_id where b.sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091');
-- delete from escalations where beneficiary_id in (select id from beneficiaries where sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091');
-- delete from weekly_updates where intervention_id in (select i.id from interventions i join beneficiaries b on b.id=i.beneficiary_id where b.sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091');
-- delete from interventions where beneficiary_id in (select id from beneficiaries where sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091');
-- delete from beneficiaries where sponsor_id='28d8ffac-d2fb-4ddb-acd7-86c580c23091';