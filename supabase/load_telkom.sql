-- load_telkom.sql — Telkom FutureMakers ED programme (sponsor 'Telkom'). 8 live Beneficiaries in delivery (Post-Diagnostic).
-- Each: coaching (delivered) + needs-analysis call (in progress); ONEA & HOSEA also a marketing line (not started).
-- Owner/PM: Jameel Khan; marketing consultant: Eugene Munsami; coaching by an unnamed outsourced coach. HOSEA = red (Telkom approval pending).
begin;
with ben(name,cp,em) as (values
  ('ONEA AFRICA (Pty) Ltd','Neo Sikhitha','connect@onea.co.za'),
  ('Kopia Services','Scott Pitso','scott@miyfi.co.za'),
  ('Mokone Tumelo (Pty) Ltd','Gladys Gumede','mokonetumelotrading@gmail.com'),
  ('Hoffman ICT','Lincoln Hoffman','lincoln.hoffman67@gmail.com'),
  ('HOSEA (House of Software, Engineering and Automation)','Phogole','phogoleam@gmail.com'),
  ('Mogalakwena Valuers','Khethiwe Molefe','khethiwe@mogalakwenavaluers.co.za'),
  ('TT Deco','Thato Dibetle','thato@ttdeco.co.za'),
  ('Galaxy Palm','Phatudi','phatudi@galaxypalms.co.za')
),
ins_ben as (
  insert into beneficiaries (name,sponsor_id,industry,contact_person,contact_email,directors,stage,lifecycle,project_manager_id,outstanding_items,cycle,last_engagement_at)
  select name,'5615c998-c041-44da-9940-ac5824565b22','ED track',cp,em,'[]'::jsonb,'implementation','active','64bb10de-f7ec-44cb-97f6-122420e7ea56','Client contact: Thembi Mafunda (Telkom). All 6 coaching sessions complete; programme now in the needs-analysis phase.',1,'2026-08-04' from ben returning id,name
),
ins_iv as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,acknowledged,acknowledged_at)
  select b.id,'custom',s.cname,'other',s.cmot,'64bb10de-f7ec-44cb-97f6-122420e7ea56',s.st::iv_status,s.comp,'na',true,now()
  from ins_ben b cross join (values
    ('Business coaching and mentorship — 6 contracted sessions','Category: Coaching & Mentorship. Delivered by an outsourced coach; steered toward marketing & sales at Telkom''s request.','completed','2026-07-31'::timestamptz),
    ('Operational and marketing needs analysis call','Category: Diagnostics & Due Diligence. Output feeds the needs pack presented to Telkom for approval.','in_progress',null)
  ) as s(cname,cmot,st,comp) returning id,custom_name
)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,created_at)
select id,'64bb10de-f7ec-44cb-97f6-122420e7ea56'::uuid,'All 6 coaching sessions held. Steered toward marketing and sales at Telkom''s request.',null::text,'2026-07-31'::timestamptz from ins_iv where custom_name='Business coaching and mentorship — 6 contracted sessions'
union all
select id,'64bb10de-f7ec-44cb-97f6-122420e7ea56'::uuid,null::text,'Needs-analysis call in progress — output feeds the needs pack presented to Telkom for approval.',now() from ins_iv where custom_name='Operational and marketing needs analysis call';

insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,discovery_status,acknowledged,acknowledged_at)
select b.id,'custom',m.cname,'other',m.cmot,'096bcf09-5faf-41a6-9e5e-cd5711899f33','not_started','na',true,now()
from beneficiaries b join (values
  ('ONEA AFRICA (Pty) Ltd','Marketing proposal — Onea (Thembi request)','Category: Marketing & Brand. Part of the new proposal to Telkom alongside the marketing work.'),
  ('HOSEA (House of Software, Engineering and Automation)','Marketing interventions — Strategy & Auditing, Social Media Management, LinkedIn Campaign Management, Business Profile','Category: Marketing & Brand. Approx. R103,846 across 3 marketing interventions, per the HOSEA implementation report. Subject to Telkom approval.')
) as m(bname,cname,cmot) on b.name=m.bname where b.sponsor_id='5615c998-c041-44da-9940-ac5824565b22';

update beneficiaries set rag_override='red', rag_override_reason='Awaiting Telkom approval on the support request (intern stipend retention, operational support, testing devices, content-creation equipment, data connectivity).'
where sponsor_id='5615c998-c041-44da-9940-ac5824565b22' and name like 'HOSEA%';
commit;

-- ROLLBACK (Telkom currently only has these rows):
-- delete from weekly_updates where intervention_id in (select i.id from interventions i join beneficiaries b on b.id=i.beneficiary_id where b.sponsor_id='5615c998-c041-44da-9940-ac5824565b22');
-- delete from interventions where beneficiary_id in (select id from beneficiaries where sponsor_id='5615c998-c041-44da-9940-ac5824565b22');
-- delete from beneficiaries where sponsor_id='5615c998-c041-44da-9940-ac5824565b22';
