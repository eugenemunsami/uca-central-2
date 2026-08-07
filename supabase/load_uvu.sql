-- load_uvu.sql — UVU Animation programme (sponsor 'UVU'). 15 live Beneficiaries (diagnostic complete) + 5 Onboarding tickets (diagnostic in progress).
-- Held back: UVU-021 CJ Logistics (placeholder contact) & UVU-022 Simbart Drawings (possible duplicate). Owner: Callyn Josie (consultant).
begin;
with ben(name,cp,em) as (values
  ('Sian Touzel','Sian Touzel','sian.touzel@capaciti.org.za'),
  ('Ahmad Gierdien','Ahmad Gierdien','ahmad.gierdien@capaciti.org.za'),
  ('Avuyile Ntwanambi','Avuyile','avuyile.ntwanambi@capaciti.org.za'),
  ('Joshua Jacobs','Joshua Jacobs','joshua.jacobs@capaciti.org.za'),
  ('Ridhaa Damon','Ridhaa Damon','ridhaa.damon@capaciti.org.za'),
  ('Albert Dai','Albert Dai','albert.dai@capaciti.org.za'),
  ('We Art People','Sibusiso Mtoto','sibusiso.mtoto@capaciti.org.za'),
  ('TCI Business Solutions','Althea Jarvis','althea.jarvis@capaciti.org.za'),
  ('AFRIKAN MIND ANIMATION STUDIOS (Pty) Ltd','Wandile Williams','wandile.abrahamse@capaciti.org.za'),
  ('Alexander Dyers','Alexander Dyers','alexander.dyers@capaciti.org.za'),
  ('Ziyaad Rahman','Ziyaad Rahman','ziyaad.rahman@capaciti.org.za'),
  ('Masixole Mgqibandaba','Masixole','masixole.mgqibandaba@capaciti.org.za'),
  ('Gemma Piscopo','Gemma Piscopo','gemma.piscopo@capaciti.org.za'),
  ('AmphiArts','Mandisi Heshu','mandisi.heshu@capaciti.org.za'),
  ('SBK Estimators','Mkholisi Mene','mkholisi.mene@capaciti.org.za')
),
ins_ben as (
  insert into beneficiaries (name,sponsor_id,industry,contact_person,contact_email,directors,stage,lifecycle,project_manager_id,expected_completion,cycle,last_engagement_at)
  select name,'bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba','Media & Creative (ED track)',cp,em,'[]'::jsonb,'sow','active','7b2206bf-af98-49ea-a1c6-156de1813c2e','2026-07-20',1,'2026-07-01' from ben returning id,name
),
ins_iv as (
  insert into interventions (beneficiary_id,kind,custom_name,custom_kind,custom_motivation,consultant_id,status,completed_at,discovery_status,acknowledged,acknowledged_at)
  select b.id,'custom',s.cname,'other',s.cmot,'7b2206bf-af98-49ea-a1c6-156de1813c2e',s.st::iv_status,s.comp,'na',true,now()
  from ins_ben b cross join (values
    ('Ember360 diagnostic','Category: Diagnostics & Due Diligence','completed','2026-07-20'::timestamptz),
    ('Animation programme diagnostic report','Category: Reporting','not_started',null)
  ) as s(cname,cmot,st,comp) returning id,beneficiary_id,custom_name
),
note_src(name,note) as (values
  ('We Art People','First tranche of animation programme reports completed and sent. Reported position is 14 of 20 issued.'),
  ('AFRIKAN MIND ANIMATION STUDIOS (Pty) Ltd','Feedback call held with Riyanah and Bronwyn. UVU were happy with how the programme was handled this cohort.'),
  ('AmphiArts','Ember360 diagnostic invitations issued to the animation programme cohort, with UCA confirmed as the implementation partner for UVU on the programme.')
)
insert into weekly_updates (intervention_id,author_id,completed_work,in_progress,created_at)
select id,'7b2206bf-af98-49ea-a1c6-156de1813c2e'::uuid,'Ember360 diagnostic complete — all four canvases done.',null::text,'2026-07-20'::timestamptz from ins_iv where custom_name='Ember360 diagnostic'
union all
select iv.id,'7b2206bf-af98-49ea-a1c6-156de1813c2e'::uuid,null::text,n.note,'2026-07-24'::timestamptz from ins_iv iv join ins_ben b on b.id=iv.beneficiary_id join note_src n on n.name=b.name where iv.custom_name='Animation programme diagnostic report';

with onb(name,cp,em,note) as (values
  ('Victoire Masson','Victoire Masson','victoire.masson@capaciti.org.za','Ember360 diagnostic outstanding — no assessments started. Chasing the beneficiary.'),
  ('Simbarashe Machona','Simbarashe','simbarashe.machona@capaciti.org.za','Ember360 diagnostic outstanding — no assessments started. Chasing the beneficiary.'),
  ('Zamile Mooi','Zamile Mooi','zamile.mooi@capaciti.org.za','Ember360 diagnostic outstanding — no assessments started. Chasing the beneficiary.'),
  ('Caryn Rania','Caryn Rania','caryn.rania@capaciti.org.za','Ember360 diagnostic outstanding — no assessments started. Chasing the beneficiary.'),
  ('Rizqah Soeker','Rizqah Soeker','rizqah.soeker@capaciti.org.za','Ember360 diagnostic partially complete (2 of 4 canvases) — chasing the remainder.')
),
ins_onb as (
  insert into onboardings (name,sponsor_id,industry,contact_person,contact_email,status,current_owner_role,current_owner_id,exco_id,manco_id,consultant_id,ember_applicable,participants,created_by,created_at,last_action_at)
  select name,'bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba','Media & Creative (ED track)',cp,em,'ember_loading','consultant','7b2206bf-af98-49ea-a1c6-156de1813c2e','64bb10de-f7ec-44cb-97f6-122420e7ea56','69effdfb-6c59-4138-94a4-ea037030a1ec','7b2206bf-af98-49ea-a1c6-156de1813c2e',true,array['7b2206bf-af98-49ea-a1c6-156de1813c2e','69effdfb-6c59-4138-94a4-ea037030a1ec','64bb10de-f7ec-44cb-97f6-122420e7ea56']::uuid[],'64bb10de-f7ec-44cb-97f6-122420e7ea56','2026-07-01',now() from onb returning id,name
)
insert into onboarding_events (onboarding_id,at,user_id,kind,to_status,text)
select id,'2026-07-01'::timestamptz,'64bb10de-f7ec-44cb-97f6-122420e7ea56'::uuid,'created','ember_loading','Loaded from the UVU animation tracker at the Ember360 diagnostic stage.' from ins_onb
union all
select o.id,now(),'7b2206bf-af98-49ea-a1c6-156de1813c2e'::uuid,'note',null::text,n.note from ins_onb o join onb n on n.name=o.name;

-- Freshen the 3 carried-over report notes so Central's 10-day staleness rule doesn't flag these
-- (tracker-green) beneficiaries red on load. The historical note text is preserved; only its timestamp moves.
update weekly_updates set created_at = now()
where in_progress is not null
  and intervention_id in (select i.id from interventions i join beneficiaries b on b.id=i.beneficiary_id
                          where b.sponsor_id='bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba');
commit;

-- ROLLBACK (UVU currently only has these rows):
-- delete from weekly_updates where intervention_id in (select i.id from interventions i join beneficiaries b on b.id=i.beneficiary_id where b.sponsor_id='bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba');
-- delete from interventions where beneficiary_id in (select id from beneficiaries where sponsor_id='bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba');
-- delete from beneficiaries where sponsor_id='bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba';
-- delete from onboarding_events where onboarding_id in (select id from onboardings where sponsor_id='bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba');
-- delete from onboardings where sponsor_id='bd0c11e8-cacc-4f25-bc10-1fd71b9cfaba';
