-- =====================================================================
-- UCA CENTRAL - seed: the standard intervention catalogue
-- Source: "Interventions and Services" (UCA). Editable in the admin panel.
-- =====================================================================
insert into intervention_catalogue (category, name, description, est_delivery) values
-- Marketing / Branding
('Branding','Strategy & Auditing','Strategic audit report, marketing roadmap and executive presentation session.','3-4 weeks'),
('Branding','Logo Design (Standalone)','Logo refresh: 3 variations, 2 revisions, final file exports.','3 days'),
('Branding','Brand Essentials','Logo concept, variations, colour palette, typography set, final files.','1 week'),
('Branding','Brand Builder','Most popular. Expanded identity: logo system, colour usage guide, typography system, graphic elements.','1-1.5 weeks'),
('Branding','Brand Pro System','Full strategic identity: moodboard, full logo system, accessibility-checked palette, brand guidelines, application mockups.','2 weeks'),
('Branding','Social Media Kit','Branded profile pic, 4 highlight icons, 3 post templates.','3-5 days'),
('Branding','Email Signature Design','Clickable HTML or PNG layout.','2 days'),
('Branding','Business Card Design','Front/back card, print-ready file.','2-3 days'),
('Branding','Stationery Pack','Invoice, letterhead and quote template.','3-5 days'),
('Branding','Business Profile','Company profile document: basic (4pp), intermediate (8pp) or enterprise (12pp).','1-2 weeks'),
-- Web
('Web Development','Standard 5-Page Website','Responsive non-ecommerce site, copywriting, SEO basics, GA4, hosting and SSL setup, handover.','1-1.5 weeks'),
('Web Development','E-commerce Lite','B2C storefront add-on.','1-2 weeks'),
('Web Development','Website Maintenance (Monthly)','Ongoing B2C site maintenance.','Monthly'),
('Web Development','Speed Optimization','Performance tuning of an existing site.','3-5 days'),
('Web Development','Advanced SEO Setup','Beyond basic meta and indexing.','1 week'),
('Web Development','Multilingual Setup','Per-language setup.','1 week'),
('Web Development','Copywriting','Page and campaign copy.','3-5 days'),
('Web Development','WhatsApp Chat Plugin','Chat plugin integration.','1 day'),
-- Content
('Content Production','Videography','Basic (half-day shoot/edit) or advanced (full-day shoot/edit).','Package dependent'),
('Content Production','Photography','Basic (half-day shoot/edit) or advanced (full-day shoot/edit).','Package dependent'),
-- Print
('Print & Promotional','Print & Promotional Package','Branded physical assets for activations and expos: gazebo, banners, table kit. Basic to premium.','2-2.5 weeks'),
-- Social / Ads
('Social Media Management','Social Media Management','Basic (1 platform, 6 posts), standard (2 platforms, 8 posts + R1500 ad spend) or enterprise (4 platforms, 12 posts + R3000 ad spend).','Monthly'),
('Social Media Management','Campaign Management','LinkedIn campaign setup, targeting, creative, monitoring and end-of-month analytics. R3500 ad spend included.','1 month'),
('Google Ads','Google Ads Management','Starter, growth or enterprise: account setup, keyword research, campaigns, optimisation and reporting.','1 week + ongoing'),
('Business Insights','Business Surveys & Insights','Branded survey design, distribution and insights report. Basic (10q) to enterprise (30q + live dashboard).','Survey dependent'),
-- Finance
('Finance','Annual Financial Statements','AFS per the applicable SA reporting framework, for owners, financiers, SARS and statutory compliance.','2-4 weeks'),
('Finance','Monthly Management Accounts','P&L, balance sheet, cash flow summary, key ratios and management insights.','Monthly'),
('Finance','Monthly Budget Tracker','Budget vs actual, variances, spending trends and corrective actions.','Monthly'),
('Finance','Monthly Payroll','Salary calculations, statutory deductions, leave, payslips and payroll reports.','Monthly'),
('Finance','Financial Forecast','Projected income statement, cash flow and balance sheet for planning and funding.','2-3 weeks'),
('Finance','Cloud Accounting Training','Practical training on Xero, Sage, QuickBooks Online and similar platforms.','1-2 weeks'),
('Compliance','Compliance - Income Tax','Annual income tax returns, tax calculations and SARS submissions.','Per submission'),
('Compliance','Compliance - IRP5','Employee tax certificates and SARS employer reconciliation.','Per submission'),
('Compliance','Compliance - UIF','UIF registration, declarations and ongoing compliance.','Monthly'),
('Compliance','Compliance - PAYE','Monthly PAYE calculation, EMP201 submissions and reconciliation.','Monthly'),
('Compliance','Compliance - VAT','VAT returns, reconciliations and input/output verification.','Bi-monthly'),
('Compliance','Compliance - COIDA','Registration, Return of Earnings and ongoing COIDA compliance.','Annual'),
('Compliance','Compliance - CIPC Returns','CIPC annual returns and statutory good standing.','Annual'),
-- Coaching
('Coaching','Venture Building','Includes personal coaching sessions alongside venture build support.','Programme dependent'),
('Coaching','Business Leadership Coaching','Coaching from a business perspective only.','Programme dependent');
