-- seed_2025_archive.sql — one-off data load for the removable 2025 Archive. Regenerated from the two BEE123 FY25 tracker spreadsheets.
delete from archive_2025_jobs;
insert into archive_2025_jobs (beneficiary_name,beneficiary_key,category,invoice,owner,status,rag,latest_comment,source,sort) values
('Trouve Solutions (Pty) Ltd','trouve solutions','Brand Identity','Apr-25','Britney','In Progress','red','Informed SME throught email and call about close off and sent final files = No response and no  files link download','creative',0),
('Vikeleka Clothing','vikeleka clothing','Brand Identity','Apr-25','Britney','In Progress','amber','Inform client (BEE123) that the project is closed','creative',1),
('Tautona Mash (Pty) Ltd','tautona mash','Brand Identity','Apr-25','','Not Started','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',2),
('Mailagofenywa Construction (Pty) Ltd','mailagofenywa construction','Brand Identity','Apr-25, May-25','','Not Started','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',3),
('PMO','pmo','Website','Mar-25','Contractor – Shaylin, Kudzai','In Progress','amber','Completed','creative',4),
('Mbheleme Business','mbheleme business','Website','Apr-25','','Not Started','amber','Completed','creative',5),
('Vuka Jobe (Pty) Ltd','vuka jobe','Website','Mar-25','','Not Started','amber','COMPLETED','creative',6),
('Tautona Mash (Pty) Ltd','tautona mash','Website','Apr-25','','Not Started','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',7),
('Mailagofenywa Construction (Pty) Ltd','mailagofenywa construction','Website','Apr-25, May-25','','Not Started','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',8),
('Vikeleka Clothing','vikeleka clothing','Website','Apr-25','Kudzai','In Progress','amber','Completed','creative',9),
('Yellowman Distributors','yellowman distributors','Website','Mar-25, Apr-25, May-25','','Not Started','amber','Completed','creative',10),
('Shoreline','shoreline','Print Design','Apr-25','Britney','In Progress','amber','Closed and handed over','creative',11),
('Vuka Jobe (Pty) Ltd','vuka jobe','Print Design','Mar-25','','In Progress','amber','Closed and handed over','creative',12),
('Tautona Mash (Pty) Ltd','tautona mash','Print Design','Apr-25','','Not Started','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',13),
('B''s Kitchen','b s kitchen','Print Design','Dec-24, Jan-25','','Not Started','amber','Closed and handed over','creative',14),
('Mailagofenywa Construction (Pty) Ltd','mailagofenywa construction','Print Design','Apr-25, May-25','','Not Started','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',15),
('Culture Water','culture water','Print Design','Apr-25','Britney','In Progress','amber','Closed and handed over','creative',16),
('Waste X','waste x','Print Design','Sept-25','Britney','In Progress','amber','Closed and handed over','creative',17),
('Maggz Zenate','maggz zenate','Print Design','Nov-24, Dec-24','Britney','In Progress','amber','Closed and handed over','creative',18),
('Maggz Zenate','maggz zenate','Print Promo','Nov-24, Dec-24','Eugene','In Progress','amber','Closed and delivered','creative',19),
('Yellowman Distributors','yellowman distributors','Print Promo','Mar-25, Apr-25, May-25','Britney','In Progress','amber','Sent office delivery quote to Rinaldo
= Waiting for payment','creative',20),
('Darman Tech','darman tech','Print Promo','Apr-25','Britney','In Progress','amber','Closed and delivered','creative',21),
('B''s Kitchen','b s kitchen','Print Promo','Dec-24, Jan-25','Britney','Not Started','amber','Closed and delivered','creative',22),
('Bhebesi Refrigeration','bhebesi refrigeration','Print Promo','Apr-25','Britney','In Progress','amber','Closed and delivered','creative',23),
('KGG Tradings','kgg tradings','Print Promo','Apr-25','Britney','In Progress','amber','Closed and delivered','creative',24),
('Kefiloe OHS','kefiloe ohs','Print Promo','Dec-24','Britney','In Progress','amber','Closed and delivered','creative',25),
('Waste X','waste x','Google Ads','Sept-25','Kudzai','In Progress','amber','Completed','creative',26),
('Tlobusiphu Decor','tlobusiphu decor','Google Ads','Mar-25','Kudzai','In Progress','amber','Completed','creative',27),
('Simkhaza Civil and Construction (Pty) Ltd','simkhaza constructions','Google Ads','Apr-25','Kudzai','In Progress','amber','Email sent and ad is live as we wait for a change in SOW.','creative',28),
('Culture Water','culture water','Google Ads','Apr-25','Kudzai','In Progress','amber','Completed','creative',29),
('RBG Solutions','rbg solutions','Google Ads','Apr-25','Kudzai','In Progress','amber','Completed','creative',30),
('Shoreline','shoreline','Google Ads','Apr-25','Kudzai','In Progress','amber','Completed','creative',31),
('SA Labels Printers','sa labels printers','Google Ads','Apr-25','Kudzai','In Progress','amber','Completed','creative',32),
('Naledzi Technologies (Pty) Ltd','naledzi technologies','Google Ads','Dec-24','Kudzai','In Progress','amber','Add to weekly report to BEE123','creative',33),
('PMO','pmo','Google Ads','Mar-25','Kudzai','In Progress','amber','Report Completed and sent to client','creative',34),
('Vikeleka Clothing','vikeleka clothing','Google Ads','Apr-25','Kudzai','Not Started','amber','Ad is running','creative',35),
('B''s Kitchen','b s kitchen','Photography','Dec-24, Jan-25','','Not Started','amber','Sending out Thursday 11 June for final review. Project to be closed Friday 19 June','creative',36),
('Berrie Coulis','berrie coulis','Brand Survey','May-25','Eugene','In Progress','amber','Inform SME that the project is closed automatically due to non response.
Add to weekly report to BEE123','creative',37),
('Lavisa Tech','lavisa tech','Brand Survey','N/A','Eugene','In Progress','amber','Inform client that 30 day period is over. Close out','creative',38),
('GoCloud Technologies','gocloud','Brand Survey','Dec-24','Eugene','In Progress','amber','Propose new intervention , Until end of June','creative',39),
('SF Consortium','sf consortium','Brand Survey','Dec-24, Apr-25','','Not Started','amber','Propose new intervention , Until end of June','creative',40),
('RBG Solutions','rbg solutions','Brand Survey','Apr-25','','Not Started','amber','Propose new intervention , Until end of June','creative',41),
('RBG Solutions','rbg solutions','Social Media','Apr-25','Britney','Complete: To Send Report','red','Schuyler did follow-up call after email boosting strategy follow-up email
= no response to call or email to date','creative',42),
('Kefiloe OHS','kefiloe ohs','Social Media','Dec-24','Britney','In Progress','amber','Boosted 4 posts on the 23 June till 29 June.
Analytics will follow in the next 2 days and i will then run the last 2 boosts','creative',43),
('Marang Dot Tech','marang dot tech','Social Media','Apr-25','Britney','In Progress','red','Schuyler did follow-up call after email boosting strategy follow-up email
= no response to call or email to date','creative',44),
('EasyFind','easyfind','Social Media','Dec-24','','In Progress','red','No response after close out email.','creative',45),
('B''s Kitchen','b s kitchen','Social Media','Dec-24, Jan-25','','Not Started','amber','2 more posts to go out in the 25 June & 29 June. 
After this all month will be complete and analytics and boosting strategy will follow 3 days after.','creative',46),
('Bhebesi Refrigeration','bhebesi refrigeration','Social Media','Apr-25','Britney','In Progress','amber','2 more posts to go out in the 25 June & 29 June. 
After this all month will be complete and analytics and boosting strategy will follow 3 days after.','creative',47),
('Zippy Press','zippy press','Campaign Management','Sept-25','Britney','In Progress','amber','Waiting on Sushil to give me the new messaging for
their Meta campaign now that we are only posting on Meta','creative',48),
('Marvel Resolutions (Pty) Ltd','marvel resolutions','Campaign Management','Dec-24','','In Progress','amber','Rinaldo is sending mail to client to inform project has now been closed off 
= Britney waiting for response to send close off email','creative',49),
('Yellowman Distributors','yellowman distributors','Campaign Management','Mar-25, Apr-25, May-25','','In Progress','amber','Should be removed from this list','creative',50),
('GoCloud Technologies','gocloud','Brand Audit','Dec-24','Eugene','In Progress','amber','Propose new intervention , Until end of June','creative',51),
('Vuka Jobe (Pty) Ltd','vuka jobe','Finance','','','In Progress','red','ESCALATED — On hold pending go-ahead from BEE123; no work commenced. Has been on hold since the previous financial year and was proposed for formal close-off in the BEE123 close-off thread (6 Jul 2026). Re-mapped from ''On Hold'', which falls away under the new status set.','finance',52),
('Tlobusiphu Decor','tlobusiphu decor','Finance','','','In Progress','amber','Financial intervention, cloud-based accounting system and compliance all complete. AFS in review and near completion (due 7 Aug 2026). Meeting still to be held with beneficiary on balance sheet elements.','finance',53),
('Mukhakamotebo Investments & Projects','mukhakamotebo investments projects','Finance','','','Complete: To Send Report','green','Financial intervention and cloud-based accounting system complete. Payroll support (9 months): Months 1 and 4-9 complete. Awaiting beneficiary to send updated payroll register before the engagement can be closed.','finance',54),
('Autocore','autocore','Finance','','','Complete: To Send Report','green','Autocore: onboarding and cashflow projections complete close-out report underway','finance',55),
('Classic Pipeline & Fabricators','classic pipeline fabricators','Finance','','','Complete: To Send Report','green','Classic Pipeline & Fabricators: invoice/quotation training complete, 12-month licence still in progress. Held at in-progress until the Classic Pipeline licence completes.','finance',56),
('RBKMG Squared & Company (Pty) Ltd','rbkmg squared company','Finance','','','In Progress','amber','Financial intervention, cloud-based accounting system and compliance complete. AFS in review and near completion (due 7 Aug 2026).','finance',57),
('Simkhaza Civil and Construction (Pty) Ltd','simkhaza constructions','Finance','','','In Progress','red','ESCALATED — Beneficiary has already sent documents via email; awaiting processing on our side.','finance',58),
('Thankadimpho Trading (Pty) Ltd','thankadimpho trading','Finance','','','Complete: To Send Report','green','Financial intervention (accounting) and cloud-based accounting system deployment complete. Close-out report underway, not yet issued.','finance',59),
('Bakwena Innovation Den','bakwena innovation den','Finance','','','Complete: To Send Report','green','Financial intervention (accounting) complete. Close-out report underway, not yet issued.','finance',60),
('Marvel Resolutions (Pty) Ltd','marvel resolutions','Finance','','','Complete: To Send Report','green','Financial intervention (accounting) complete. Close-out report underway, not yet issued. Note: also listed for formal project close-off on the marketing side (BEE123 close-off thread, 6 Jul 2026).','finance',61),
('1Mbrella Catering and Events (Pty) Ltd','1mbrella catering and events','Finance','','','Complete: To Send Report','green','Financial intervention (accounting) complete. Close-out report is the only open item.','finance',62),
('Alchemy Health','alchemy health','Finance','','','Complete: To Send Report','green','Payroll support (15 months) and accounting software deployment both complete; final payroll period ended 30 Jun 2026. Close-out report underway, not yet issued.','finance',63),
('Xitshavani Industrial Supply Services (Pty) Ltd','xitshavani industrial supply services','Finance','','','In Progress','red','ESCALATED — Flagged as an escalation on the board. Payroll (EMP201s) 13-month engagement: Months 1-2 complete, Month 3 in progress, Months 4-13 outstanding. Review documents requested from beneficiary for Jan 2026.','finance',64),
('Above Normal','above normal','Finance','','','In Progress','red','ESCALATED — Beneficiary had an electricity issue but confirmed he would send documents soon. Overdue since 30 Jan 2026. Listed as unresponsive after escalation and proposed for formal close-off (BEE123 close-off thread, 6 Jul 2026).','finance',65),
('Golden Aspects ICT Solutions (Pty) Ltd','golden aspects ict solutions','Finance','','','In Progress','red','ESCALATED — Beneficiary indicated they would send their documents via email. Listed as unresponsive after escalation and proposed for formal close-off (BEE123 close-off thread, 6 Jul 2026).','finance',66),
('Tautona Mash (Pty) Ltd','tautona mash','Finance','','','In Progress','red','ESCALATED — Call went to voicemail; follow-up calls continuing. Listed as unresponsive after escalation and proposed for formal close-off on both the finance and marketing sides (BEE123 close-off thread, 6 Jul 2026).','finance',67),
('Mailagofenywa Construction (Pty) Ltd','mailagofenywa construction','Finance','','','In Progress','red','ESCALATED — Julia confirmed documents would be sent on Monday. Listed as unresponsive after escalation and proposed for formal close-off on both the finance and marketing sides (BEE123 close-off thread, 6 Jul 2026).','finance',68),
('Naledzi Technologies (Pty) Ltd','naledzi technologies','Finance','','','In Progress','red','ESCALATED — Beneficiary confirmed he would send his documents early next week. Listed as unresponsive after escalation and proposed for formal close-off (BEE123 close-off thread, 6 Jul 2026).','finance',69);
