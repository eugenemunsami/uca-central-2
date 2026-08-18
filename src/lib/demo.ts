import type {
  Aggregator, Beneficiary, BeneficiaryEvent, CatalogueItem, Comm, Escalation, EscalationEvent,
  Intervention, Notification, Profile, RagOverride, Sponsor, UserEvent, WeeklyUpdate,
  Onboarding, OnboardingEvent, WelcomeParty, WelcomePartyInvite,
  InternalTask, InternalTaskSubtask, InternalTaskComment,
} from './types'

const now = new Date()
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString()
const day = (offset: number) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10)

const _profiles: Profile[] = [
  { id: 'u-hiten',   full_name: 'Hiten Keshave',    email: 'hiten@uca.co.za',    role: 'exco',       discipline: 'CEO',      is_admin: true,  active: true },
  { id: 'u-jameel',  full_name: 'Jameel Khan',      email: 'jameel@uca.co.za',   role: 'exco',       discipline: 'Director', is_admin: true,  active: true },
  { id: 'u-rinaldo', full_name: 'Rinaldo Josie',    email: 'rinaldo@uca.co.za',  role: 'manco',      discipline: 'COO',      is_admin: true,  active: true },
  { id: 'u-eugene',  full_name: 'Eugene Munsami',   email: 'eugene@uca.co.za',   role: 'manco',      discipline: 'CMO',      is_admin: true,  active: true },
  { id: 'u-shaun',   full_name: 'Shaun Munsami',    email: 'shaun@uca.co.za',    role: 'manco',      discipline: 'ManCo',    is_admin: true,  active: true },
  { id: 'u-boitumelo', full_name: 'Boitumelo Matobela', email: 'boitumelo@uca.co.za', role: 'manco', discipline: 'ManCo',   is_admin: false, active: true },
  { id: 'u-nqobile', full_name: 'Nqobile Jiyane',   email: 'nqobile@uca.co.za',  role: 'consultant', discipline: 'Finance',  is_admin: false, active: true },
  { id: 'u-britney', full_name: 'Britney Welcome',  email: 'britney@uca.co.za',  role: 'consultant', discipline: 'Graphic Design', is_admin: false, active: true },
  { id: 'u-kudzai',  full_name: 'Kudzai Muromba',   email: 'kudzai@uca.co.za',   role: 'consultant', discipline: 'Web & Digital',  is_admin: false, active: true },
  { id: 'u-katlego', full_name: 'Katlego Mantata',  email: 'katlego@uca.co.za',  role: 'consultant', discipline: 'Graphic Design', is_admin: false, active: true },
  { id: 'u-keanan',  full_name: 'Keanan Thaver',    email: 'keanan@uca.co.za',   role: 'consultant', discipline: 'Ember360 & Support', is_admin: false, active: true },
  { id: 'u-callyn',  full_name: 'Callyn Josie',     email: 'callyn@uca.co.za',   role: 'consultant', discipline: 'Project Analyst', is_admin: false, active: true },
  { id: 'u-schuyler', full_name: 'Schuyler',        email: 'schuyler@uca.co.za', role: 'consultant', discipline: 'Administrator', is_admin: false, active: true },
  { id: 'u-bee123',  full_name: 'BEE123 Programme Office', email: 'programmes@bee123.co.za', role: 'external', discipline: 'Aggregator', is_admin: false, active: true, external_client_id: 'ag-bee123' },
  { id: 'u-sponsor', full_name: 'Standard Bank ESD', email: 'esd@sponsor.co.za', role: 'external', discipline: 'Sponsor', is_admin: false, active: true, external_sponsor_id: 'sp-stdbank' },
  { id: 'u-bee-ops', full_name: 'BEE123 Operations', email: 'ops@bee123.co.za', role: 'external', discipline: 'Aggregator', is_admin: false, active: true, external_client_id: 'ag-bee123' },
  { id: 'u-sasol', full_name: 'Sasol ESD', email: 'esd@sasol.co.za', role: 'external', discipline: 'Sponsor', is_admin: false, active: true, external_sponsor_id: 'sp-sasol' },
]

export const profiles: Profile[] = [
  ..._profiles.map(p => ({
    status: 'active' as const,
    organisation: p.role === 'external' ? (p.discipline ?? 'Client') : 'Unconventional Capital & Advisory',
    job_title: p.discipline ?? null,
    activated_at: '2026-01-05T08:00:00.000Z',
    created_by: 'u-rinaldo',
    ...p,
  })),
  {
    id: 'u-pending', full_name: 'Thandeka Mbeki', email: 'thandeka@newco.co.za', role: 'consultant',
    discipline: 'Marketing Consultant', is_admin: false, active: false, status: 'pending',
    organisation: 'Unconventional Capital & Advisory', job_title: 'Marketing Consultant',
    invited_at: iso(1), invite_expires_at: day(2), created_by: 'u-shaun', temp_password: 'UCA-7HX2A9',
  },
]

export const userEvents: UserEvent[] = [
  { id: 'ue-1', target_user_id: 'u-pending', at: iso(1), by_user_id: 'u-shaun', kind: 'created', text: 'Invited as Consultant.' },
  { id: 'ue-2', target_user_id: 'u-pending', at: iso(1), by_user_id: 'u-shaun', kind: 'invite_sent', text: 'Onboarding email sent (expires in 72h).' },
]

// Internal tasks (staff-to-staff jobs) — demo seed.
export const internalTasks: InternalTask[] = [
  { id: 'it-1', title: 'Pull Q1 event attendee spreadsheet', detail: 'Full list of everyone who attended the BEE123 welcome parties this quarter, with contact details.', requester_id: 'u-eugene', assignee_id: 'u-keanan', priority: 'medium', status: 'in_progress', category: 'Hearts Day', due_date: day(2), submitted_at: null, time_minutes: null, verified_at: null, return_reason: null, created_at: iso(1), updated_at: iso(1) },
  { id: 'it-2', title: 'Update the consultant leave tracker', detail: 'Reconcile March leave against the shared tracker.', requester_id: 'u-rinaldo', assignee_id: 'u-schuyler', priority: 'low', status: 'submitted', category: 'Admin', due_date: day(-1), submitted_at: iso(0), time_minutes: 90, verified_at: null, return_reason: null, created_at: iso(3), updated_at: iso(0) },
  { id: 'it-3', title: 'Design the Q2 huddle deck cover', requester_id: 'u-shaun', assignee_id: 'u-katlego', priority: 'high', status: 'open', category: 'Events', due_date: day(4), submitted_at: null, time_minutes: null, verified_at: null, return_reason: null, created_at: iso(0), updated_at: iso(0) },
]
export const internalTaskSubtasks: InternalTaskSubtask[] = [
  { id: 'st-1', task_id: 'it-1', title: 'Export from MS Teams', done: true, sort_order: 0, created_at: iso(1) },
  { id: 'st-2', task_id: 'it-1', title: 'De-dupe and format', done: false, sort_order: 1, created_at: iso(1) },
]
export const internalTaskComments: InternalTaskComment[] = [
  { id: 'ct-1', task_id: 'it-1', author_id: 'u-keanan', body: 'On it — will have this to you by tomorrow.', created_at: iso(0) },
]

// Aggregators sit on top and pool funding from one or more sponsors.
export const aggregators: Aggregator[] = [
  { id: 'ag-bee123', name: 'BEE123' },
]

// Sponsors fund cohorts. A sponsor may sit under an aggregator, or stand alone.
// BEE123 also funds a cohort directly (its own self-funded sponsor entry).
export const sponsors: Sponsor[] = [
  { id: 'sp-stdbank', name: 'Standard Bank', aggregator_id: 'ag-bee123' },
  { id: 'sp-absa',    name: 'Absa',          aggregator_id: 'ag-bee123' },
  { id: 'sp-bee123',  name: 'BEE123 (direct)', aggregator_id: 'ag-bee123' },
  { id: 'sp-sasol',   name: 'Sasol',         aggregator_id: null },
]

// Back-compat alias used by a few callers.
export const clients = sponsors

const cat = (category: string, name: string, est: string, owner?: string, description?: string): CatalogueItem => ({
  id: `cat-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  category, name, est_delivery: est, default_owner_id: owner ?? null,
  description: description ?? null, active: true,
})

export const catalogue: CatalogueItem[] = [
  cat('Branding', 'Strategy & Auditing', '3-4 weeks', 'u-eugene', 'Strategic audit report, marketing roadmap, executive presentation.'),
  cat('Branding', 'Logo Design (Standalone)', '3 days', 'u-katlego', '3 variations, 2 revisions, final exports.'),
  cat('Branding', 'Brand Essentials', '1 week', 'u-britney', 'Logo concept, variations, palette, typography, final files.'),
  cat('Branding', 'Brand Builder', '1-1.5 weeks', 'u-katlego', 'Expanded identity system with graphic elements and usage guide.'),
  cat('Branding', 'Brand Pro System', '2 weeks', 'u-britney', 'Full strategic identity, brand guidelines and application mockups.'),
  cat('Branding', 'Social Media Kit', '3-5 days', 'u-britney', 'Profile pic, 4 highlight icons, 3 post templates.'),
  cat('Branding', 'Email Signature Design', '2 days', 'u-katlego', 'Clickable HTML or PNG layout.'),
  cat('Branding', 'Business Card Design', '2-3 days', 'u-katlego', 'Front/back, print-ready.'),
  cat('Branding', 'Stationery Pack', '3-5 days', 'u-britney', 'Invoice, letterhead, quote template.'),
  cat('Branding', 'Business Profile', '1-2 weeks', 'u-britney', 'Basic 4pp / intermediate 8pp / enterprise 12pp.'),
  cat('Web Development', 'Standard 5-Page Website', '1-1.5 weeks', 'u-kudzai', 'Responsive site, copy, SEO basics, GA4, hosting, handover.'),
  cat('Web Development', 'E-commerce Lite', '1-2 weeks', 'u-kudzai', 'B2C storefront add-on.'),
  cat('Web Development', 'Website Maintenance (Monthly)', 'Monthly', 'u-kudzai', 'Ongoing B2C maintenance.'),
  cat('Web Development', 'Speed Optimization', '3-5 days', 'u-kudzai', 'Performance tuning.'),
  cat('Web Development', 'Advanced SEO Setup', '1 week', 'u-kudzai', 'Beyond basic meta and indexing.'),
  cat('Content Production', 'Videography', 'Package dependent', 'u-britney', 'Basic or advanced shoot and edit.'),
  cat('Content Production', 'Photography', 'Package dependent', 'u-katlego', 'Basic or advanced shoot and edit.'),
  cat('Print & Promotional', 'Print & Promotional Package', '2-2.5 weeks', 'u-britney', 'Gazebo, banners, table kit. Basic to premium.'),
  cat('Social Media Management', 'Social Media Management', 'Monthly', 'u-kudzai', 'Basic, standard or enterprise package.'),
  cat('Social Media Management', 'Campaign Management', '1 month', 'u-kudzai', 'LinkedIn campaign setup, targeting, creative, reporting.'),
  cat('Google Ads', 'Google Ads Management', '1 week + ongoing', 'u-kudzai', 'Starter, growth or enterprise.'),
  cat('Business Insights', 'Business Surveys & Insights', 'Survey dependent', 'u-callyn', 'Branded survey, distribution, insights report.'),
  cat('Finance', 'Annual Financial Statements', '2-4 weeks', 'u-nqobile', 'AFS per the applicable SA reporting framework.'),
  cat('Finance', 'Monthly Management Accounts', 'Monthly', 'u-nqobile', 'P&L, balance sheet, cash flow, ratios.'),
  cat('Finance', 'Monthly Budget Tracker', 'Monthly', 'u-nqobile', 'Budget vs actual and variance analysis.'),
  cat('Finance', 'Monthly Payroll', 'Monthly', 'u-nqobile', 'Salaries, deductions, payslips, reports.'),
  cat('Finance', 'Financial Forecast', '2-3 weeks', 'u-nqobile', 'Projected income, cash flow, balance sheet.'),
  cat('Finance', 'Cloud Accounting Training', '1-2 weeks', 'u-nqobile', 'Xero, Sage, QuickBooks Online.'),
  cat('Compliance', 'Compliance - Income Tax', 'Per submission', 'u-nqobile', 'Returns, calculations, SARS submissions.'),
  cat('Compliance', 'Compliance - VAT', 'Bi-monthly', 'u-nqobile', 'VAT returns and reconciliations.'),
  cat('Compliance', 'Compliance - PAYE', 'Monthly', 'u-nqobile', 'EMP201 submissions and reconciliation.'),
  cat('Compliance', 'Compliance - UIF', 'Monthly', 'u-nqobile', 'Declarations and compliance.'),
  cat('Compliance', 'Compliance - COIDA', 'Annual', 'u-nqobile', 'Return of Earnings and compliance.'),
  cat('Compliance', 'Compliance - CIPC Returns', 'Annual', 'u-nqobile', 'Annual returns and good standing.'),
  cat('Coaching', 'Venture Building', 'Programme dependent', 'u-rinaldo', 'Includes personal coaching sessions.'),
  cat('Coaching', 'Business Leadership Coaching', 'Programme dependent', 'u-rinaldo', 'Business-perspective coaching only.'),
]

const b = (
  id: string, name: string, sponsor_id: string, industry: string, pm: string,
  extra: Partial<Beneficiary> = {},
): Beneficiary => ({
  id, name, sponsor_id, industry, project_manager_id: pm,
  contact_person: extra.contact_person ?? 'Owner',
  contact_email: extra.contact_email ?? `info@${id}.co.za`,
  contact_phone: extra.contact_phone ?? '+27 82 000 0000',
  directors: extra.directors ?? [{ name: 'Director', email: `director@${id}.co.za`, phone: '+27 82 111 2222' }],
  stage: extra.stage ?? 'implementation',
  missed_welcome_parties: extra.missed_welcome_parties ?? 0,
  needs_onsite: extra.needs_onsite ?? false,
  sow_signed_date: extra.sow_signed_date ?? day(-30),
  ember360_report_url: 'https://ember360.example/report',
  welcome_party_date: day(-35),
  expected_completion: extra.expected_completion ?? day(30),
  last_engagement_at: extra.last_engagement_at ?? iso(2),
  outstanding_items: extra.outstanding_items ?? null,
  rag_override: extra.rag_override ?? null,
  rag_override_reason: extra.rag_override_reason ?? null,
  drive_folder_url: 'https://drive.google.com/drive/folders/' + id,
  lifecycle: extra.lifecycle ?? 'active',
  cycle: extra.cycle ?? 1,
  closeout_report_url: extra.closeout_report_url ?? null,
  closeout_return_notes: extra.closeout_return_notes ?? null,
  concluded_at: extra.concluded_at ?? null,
  archived_at: extra.archived_at ?? null,
  created_at: iso(30),
})

export const beneficiaries: Beneficiary[] = [
  b('thabo', 'Thabo Logistics', 'sp-stdbank', 'Transport & Logistics', 'u-rinaldo', {
    contact_person: 'Thabo Nkosi', last_engagement_at: iso(8),
    outstanding_items: 'Company registration docs, brand assets',
    directors: [
      { name: 'Thabo Nkosi', email: 'thabo@thabologistics.co.za', phone: '+27 82 445 1200' },
      { name: 'Grace Nkosi', email: 'grace@thabologistics.co.za', phone: '+27 83 220 9910' },
    ],
  }),
  b('nomsa', 'Nomsa Foods', 'sp-absa', 'Food & Beverage', 'u-boitumelo', {
    contact_person: 'Nomsa Dlamini', last_engagement_at: iso(9), needs_onsite: true, missed_welcome_parties: 2,
  }),
  b('zenzele', 'Zenzele Trading', 'sp-stdbank', 'Retail', 'u-shaun', {
    contact_person: 'Sipho Zulu', last_engagement_at: iso(1),
    directors: [
      { name: 'Sipho Zulu', email: 'sipho@zenzele.co.za', phone: '+27 84 660 3321' },
      { name: 'Lindiwe Zulu', email: 'lindiwe@zenzele.co.za', phone: '+27 82 900 1145' },
    ],
  }),
  b('lerato', 'Lerato Consulting', 'sp-bee123', 'Professional Services', 'u-eugene', {
    contact_person: 'Lerato Mokoena', stage: 'monitoring', last_engagement_at: iso(0),
  }),
  b('kasi', 'Kasi Print Co', 'sp-sasol', 'Printing', 'u-rinaldo', {
    contact_person: 'Musa Khumalo', last_engagement_at: iso(4), needs_onsite: true,
  }),
  b('amandla', 'Amandla Cleaning', 'sp-sasol', 'Cleaning Services', 'u-boitumelo', {
    contact_person: 'Zanele Mahlangu', last_engagement_at: iso(1),
  }),
  b('siyakha', 'Siyakha Engineering', 'sp-sasol', 'Engineering', 'u-shaun', {
    contact_person: 'Andile Peters', last_engagement_at: iso(3),
  }),
  b('vuka', 'Vuka Coffee', 'sp-sasol', 'Hospitality', 'u-eugene', {
    contact_person: 'Naledi Sithole', stage: 'completed', last_engagement_at: iso(6), expected_completion: day(-3),
    lifecycle: 'concluded', concluded_at: iso(3), closeout_report_url: 'https://drive.google.com/drive/folders/vuka/closeout-report',
  }),
]

const iv = (
  id: string, beneficiary_id: string, catalogue_id: string, consultant_id: string,
  status: Intervention['status'], due: number, extra: Partial<Intervention> = {},
): Intervention => ({
  id, beneficiary_id, kind: 'standard', catalogue_id, consultant_id, status,
  start_date: day(-20), due_date: day(due),
  completed_at: status === 'completed' ? iso(2) : null,
  awaiting_response_since: extra.awaiting_response_since ?? null,
  hold_reason: extra.hold_reason ?? null,
  closeout_status: extra.closeout_status ?? (status === 'completed' ? 'confirmed' : 'none'),
  closeout_requested_by: extra.closeout_requested_by ?? null,
  closeout_requested_at: extra.closeout_requested_at ?? null,
  closeout_confirmed_by: extra.closeout_confirmed_by ?? null,
  closeout_confirmed_at: extra.closeout_confirmed_at ?? null,
  closeout_subfolder_url: extra.closeout_subfolder_url ?? null,
  closeout_email_sent: extra.closeout_email_sent ?? false,
  closeout_email_text: extra.closeout_email_text ?? null,
  response_extended_until: extra.response_extended_until ?? null,
  cancelled: extra.cancelled ?? false,
  cycle: extra.cycle ?? 1,
  assigned_at: extra.assigned_at ?? iso(20),
  acknowledged: extra.acknowledged ?? true,
  acknowledged_at: extra.acknowledged_at ?? iso(20),
  rag_override: extra.rag_override ?? null,
  rag_override_reason: extra.rag_override_reason ?? null,
  poe_url: extra.poe_url ?? null,
  closeout_report_url: extra.closeout_report_url ?? null,
  drive_folder_url: 'https://drive.google.com/drive/folders/example',
  custom_name: null, custom_kind: null, custom_budget: null, custom_motivation: null,
  created_at: iso(20),
})

export const interventions: Intervention[] = [
  iv('iv-1', 'thabo', 'cat-standard-5-page-website', 'u-kudzai', 'awaiting_beneficiary', 2, { awaiting_response_since: iso(8), hold_reason: 'No sign-off on homepage copy' }),
  iv('iv-2', 'thabo', 'cat-brand-builder', 'u-katlego', 'in_progress', 9),
  iv('iv-3', 'nomsa', 'cat-monthly-management-accounts', 'u-nqobile', 'on_hold', 14, { hold_reason: 'Waiting on 3 months of bank statements' }),
  iv('iv-4', 'nomsa', 'cat-brand-essentials', 'u-britney', 'in_progress', -2),
  iv('iv-5', 'zenzele', 'cat-brand-builder', 'u-katlego', 'in_progress', 8),
  iv('iv-6', 'zenzele', 'cat-standard-5-page-website', 'u-kudzai', 'awaiting_beneficiary', 15, { awaiting_response_since: iso(2), hold_reason: 'Awaiting logo files and product images' }),
  { ...iv('iv-7', 'zenzele', 'cat-brand-builder', 'u-callyn', 'in_progress', 21), id: 'iv-7', kind: 'custom', catalogue_id: null, custom_name: 'POS hardware + till system', custom_kind: 'capex', custom_budget: 40000, custom_motivation: 'Sponsor allocated capex outside standard BDS scope.' },
  iv('iv-8', 'lerato', 'cat-financial-forecast', 'u-nqobile', 'in_progress', 12),
  iv('iv-9', 'lerato', 'cat-social-media-management', 'u-kudzai', 'in_progress', 25),
  iv('iv-10', 'kasi', 'cat-print-promotional-package', 'u-britney', 'in_progress', 6, { closeout_status: 'requested', closeout_requested_by: 'u-britney', closeout_requested_at: iso(1), closeout_subfolder_url: 'https://drive.google.com/drive/folders/kasi/print', closeout_email_sent: true, closeout_email_text: 'Hi Musa, your print and promotional package is complete. Files attached in your Drive folder.' }),
  iv('iv-11', 'kasi', 'cat-compliance-vat', 'u-nqobile', 'not_started', 20),
  iv('iv-12', 'amandla', 'cat-brand-essentials', 'u-britney', 'completed', -3, { closeout_status: 'confirmed', closeout_confirmed_by: 'u-boitumelo', closeout_confirmed_at: iso(2), closeout_subfolder_url: 'https://drive.google.com/drive/folders/amandla/brand', closeout_email_sent: true, poe_url: 'https://drive.google.com/poe' }),
  iv('iv-13', 'amandla', 'cat-monthly-payroll', 'u-nqobile', 'completed', -1, { closeout_status: 'confirmed', closeout_confirmed_by: 'u-boitumelo', closeout_confirmed_at: iso(1), closeout_subfolder_url: 'https://drive.google.com/drive/folders/amandla/payroll', closeout_email_sent: true, poe_url: 'https://drive.google.com/poe' }),
  iv('iv-14', 'siyakha', 'cat-annual-financial-statements', 'u-nqobile', 'in_progress', 18),
  iv('iv-15', 'siyakha', 'cat-business-profile', 'u-britney', 'in_progress', 11),
  iv('iv-16', 'vuka', 'cat-standard-5-page-website', 'u-kudzai', 'completed', -5, { poe_url: 'https://drive.google.com/poe', closeout_report_url: 'https://drive.google.com/closeout', closeout_confirmed_by: 'u-eugene', closeout_confirmed_at: iso(4) }),
  iv('iv-17', 'vuka', 'cat-brand-builder', 'u-katlego', 'completed', -8, { poe_url: 'https://drive.google.com/poe', closeout_confirmed_by: 'u-eugene', closeout_confirmed_at: iso(7) }),
  // Just assigned by ManCo today, not yet acknowledged by the owner:
  iv('iv-18', 'siyakha', 'cat-google-ads-management', 'u-kudzai', 'not_started', 20, { assigned_at: iso(0), acknowledged: false, acknowledged_at: null }),
  iv('iv-19', 'lerato', 'cat-compliance-vat', 'u-nqobile', 'not_started', 25, { assigned_at: iso(0), acknowledged: false, acknowledged_at: null }),
]

const wu = (id: string, intervention_id: string, author_id: string, daysAgo: number, o: Partial<WeeklyUpdate>): WeeklyUpdate => ({
  id, intervention_id, author_id, created_at: iso(daysAgo),
  completed_work: o.completed_work ?? null, in_progress: o.in_progress ?? null,
  blocker: o.blocker ?? null, blocker_owner: o.blocker_owner ?? null,
  next_action: o.next_action ?? null, next_update_due: o.next_update_due ?? day(7),
})

export const weeklyUpdates: WeeklyUpdate[] = [
  wu('wu-1', 'iv-1', 'u-kudzai', 9, { completed_work: 'Sitemap approved, 5 pages of copy drafted', in_progress: 'Homepage build', blocker: 'No sign-off on homepage copy', blocker_owner: 'Beneficiary', next_action: 'Escalate to client if no reply', next_update_due: day(-2) }),
  wu('wu-2', 'iv-2', 'u-katlego', 2, { completed_work: 'Logo concept + 2 refinements delivered', in_progress: 'Colour palette and typography system', blocker: null, blocker_owner: null, next_action: 'Send brand sheet for review' }),
  wu('wu-3', 'iv-3', 'u-nqobile', 4, { completed_work: 'Chart of accounts reviewed', in_progress: 'Nothing - blocked', blocker: 'Waiting on 3 months of bank statements', blocker_owner: 'Beneficiary', next_action: 'Site visit Thursday to collect docs' }),
  wu('wu-4', 'iv-5', 'u-katlego', 1, { completed_work: 'Moodboard signed off', in_progress: 'Logo refinement round 2', blocker: null, blocker_owner: null, next_action: 'Deliver logo variations' }),
  wu('wu-5', 'iv-6', 'u-kudzai', 2, { completed_work: 'Sitemap + copy for 3 pages', in_progress: 'Homepage build', blocker: 'No logo files or product images', blocker_owner: 'Beneficiary', next_action: 'Site visit to collect assets' }),
  wu('wu-6', 'iv-8', 'u-nqobile', 3, { completed_work: '12-month cash flow model built', in_progress: 'Scenario testing', blocker: null, blocker_owner: null, next_action: 'Review session with director' }),
  wu('wu-7', 'iv-10', 'u-britney', 5, { completed_work: 'Gazebo and banner artwork approved, printed and delivered', in_progress: 'Final sign-off', blocker: null, blocker_owner: null, next_action: 'Request close-out' }),
  wu('wu-8', 'iv-12', 'u-britney', 1, { completed_work: 'Discovery questionnaire returned', in_progress: 'Logo concepts', blocker: null, blocker_owner: null, next_action: 'Present 1 concept' }),
]

export const comms: Comm[] = [
  { id: 'cm-1', beneficiary_id: 'thabo', intervention_id: 'iv-1', author_id: 'u-kudzai', channel: 'email', occurred_at: iso(9), context: 'Sent homepage copy for sign-off, 3 working day deadline stated.', followed_up_by_email: true, email_text: null },
  { id: 'cm-2', beneficiary_id: 'thabo', intervention_id: 'iv-1', author_id: 'u-kudzai', channel: 'call', occurred_at: iso(8), context: 'No answer. Voicemail left requesting sign-off.', followed_up_by_email: true, email_text: 'Hi Thabo, following our call just now — please review and sign off the homepage copy by Thursday so we can proceed with the build. Link attached.' },
  { id: 'cm-3', beneficiary_id: 'zenzele', intervention_id: 'iv-6', author_id: 'u-kudzai', channel: 'call', occurred_at: iso(3), context: 'Asked for logo files and product images. Promised Monday.', followed_up_by_email: true, email_text: 'Hi Sipho, confirming our call — we need the logo files and product images by Monday to keep the website on track.' },
  { id: 'cm-5', beneficiary_id: 'nomsa', intervention_id: 'iv-3', author_id: 'u-nqobile', channel: 'site_visit', occurred_at: iso(6), context: 'Beneficiary is non-tech-savvy. Arranged office meeting to collect statements.', followed_up_by_email: true, email_text: 'Hi Nomsa, thank you for meeting us. As discussed, please have the three months of bank statements ready for collection on our next visit.' },
]

export const escalations: Escalation[] = [
  // 1) With ManCo — Rinaldo must review (consultant Kudzai escalated the website)
  {
    id: 'esc-1', intervention_id: 'iv-1', beneficiary_id: 'thabo',
    reason: 'Beneficiary unresponsive after two contact attempts on the website sign-off.',
    context: 'Called 11 Jul and emailed 14 Jul, no reply. Homepage build is blocked.',
    status: 'with_manco', current_owner_id: 'u-rinaldo', current_owner_role: 'manco',
    consultant_id: 'u-kudzai', manco_id: 'u-rinaldo', sponsor_id: null,
    participants: ['u-kudzai', 'u-rinaldo'],
    raised_by: 'u-kudzai', raised_at: iso(2), last_action_at: iso(2), resolved_at: null,
  },
  // 2) With Aggregator/Sponsor — BEE123 must review (ManCo Shaun escalated up)
  {
    id: 'esc-2', intervention_id: 'iv-6', beneficiary_id: 'zenzele',
    reason: 'Beneficiary not supplying logo files and product images.',
    context: 'Two attempts logged. ManCo unable to unblock; needs client intervention.',
    status: 'with_sponsor', current_owner_id: 'u-bee123', current_owner_role: 'external',
    consultant_id: 'u-kudzai', manco_id: 'u-shaun', sponsor_id: 'u-bee123',
    participants: ['u-kudzai', 'u-shaun', 'u-bee123'],
    raised_by: 'u-kudzai', raised_at: iso(6), last_action_at: iso(1), resolved_at: null,
  },
  // 3) Returned to consultant — Boitumelo declined; Nqobile must accept or re-escalate
  {
    id: 'esc-3', intervention_id: 'iv-3', beneficiary_id: 'nomsa',
    reason: 'Beneficiary not providing bank statements for the management accounts.',
    context: 'Non-tech-savvy beneficiary; site visit attempted.',
    status: 'returned_to_consultant', current_owner_id: 'u-nqobile', current_owner_role: 'consultant',
    consultant_id: 'u-nqobile', manco_id: 'u-boitumelo', sponsor_id: null,
    participants: ['u-nqobile', 'u-boitumelo'],
    raised_by: 'u-nqobile', raised_at: iso(5), last_action_at: iso(1), resolved_at: null,
  },
]

const ev = (id: string, escalation_id: string, daysAgo: number, kind: EscalationEvent['kind'], user_id: string | null, text?: string, from?: string, to?: string): EscalationEvent => ({
  id, escalation_id, at: iso(daysAgo), kind, user_id,
  from_status: (from ?? null) as never, to_status: (to ?? null) as never,
  from_owner_id: null, to_owner_id: null, text: text ?? null,
})

export const escalationEvents: EscalationEvent[] = [
  ev('eev-1', 'esc-1', 2, 'escalated_to_manco', 'u-kudzai', 'Beneficiary unresponsive after two contact attempts.', undefined, 'with_manco'),
  ev('eev-2', 'esc-2', 6, 'escalated_to_manco', 'u-kudzai', 'Beneficiary not supplying assets.', undefined, 'with_manco'),
  ev('eev-3', 'esc-2', 1, 'escalated_to_sponsor', 'u-shaun', 'Escalated to BEE123 — expected action: nudge beneficiary for assets.', 'with_manco', 'with_sponsor'),
  ev('eev-4', 'esc-3', 5, 'escalated_to_manco', 'u-nqobile', 'Bank statements outstanding.', undefined, 'with_manco'),
  ev('eev-5', 'esc-3', 1, 'declined_to_consultant', 'u-boitumelo', 'Declined: please attempt a follow-up call.\nSuggested way forward: arrange an office visit to collect statements.', 'with_manco', 'returned_to_consultant'),
]

export const notifications: Notification[] = [
  { id: 'nt-1', user_id: 'u-rinaldo', at: iso(2), kind: 'escalation_released', text: 'Escalation to review: Thabo Logistics.', escalation_id: 'esc-1', action_required: true, read: false },
  { id: 'nt-2', user_id: 'u-bee123', at: iso(1), kind: 'escalation_released', text: 'Escalation to review: Zenzele Trading.', escalation_id: 'esc-2', action_required: true, read: false },
  { id: 'nt-3', user_id: 'u-nqobile', at: iso(1), kind: 'escalation_released', text: 'Escalation returned to you: Nomsa Foods.', escalation_id: 'esc-3', action_required: true, read: false },
  { id: 'nt-4', user_id: 'u-kudzai', at: iso(1), kind: 'escalation_released', text: 'Zenzele Trading escalation is now with BEE123.', escalation_id: 'esc-2', action_required: false, read: false },
]

const be = (id: string, beneficiary_id: string, daysAgo: number, kind: BeneficiaryEvent['kind'], user_id: string | null, text?: string): BeneficiaryEvent => ({
  id, beneficiary_id, at: iso(daysAgo), kind, user_id, text: text ?? null,
})

export const beneficiaryEvents: BeneficiaryEvent[] = [
  // Amandla — both interventions closed out, now ready for beneficiary close-out
  be('be-1', 'amandla', 30, 'loaded', 'u-boitumelo'),
  be('be-2', 'amandla', 4, 'closeout_requested', 'u-britney', 'Brand Essentials — files uploaded, close-out email sent.'),
  be('be-3', 'amandla', 2, 'closeout_confirmed', 'u-boitumelo', 'Brand Essentials verified and confirmed.'),
  be('be-4', 'amandla', 2, 'closeout_requested', 'u-nqobile', 'Monthly Payroll — files uploaded, close-out email sent.'),
  be('be-5', 'amandla', 1, 'closeout_confirmed', 'u-boitumelo', 'Monthly Payroll verified and confirmed.'),
  // Vuka — full close-out completed and concluded
  be('be-6', 'vuka', 30, 'loaded', 'u-eugene'),
  be('be-7', 'vuka', 8, 'closeout_confirmed', 'u-eugene', 'Website confirmed.'),
  be('be-8', 'vuka', 7, 'closeout_confirmed', 'u-eugene', 'Brand Builder confirmed.'),
  be('be-9', 'vuka', 5, 'closeout_report_sent', 'u-eugene', 'POE/close-out report produced and sent to Sasol ESD.'),
  be('be-10', 'vuka', 3, 'concluded', 'u-sasol', 'Client acknowledged the close-out.'),
]

export const ragOverrides: RagOverride[] = []

// ---- Onboarding pipeline (pre-SOW) ----
export const welcomeParties: WelcomeParty[] = [
  { id: 'wp-1', party_date: day(3), title: 'Welcome Party — this week', notes: null, created_by: 'u-shaun', created_at: iso(5) },
  { id: 'wp-2', party_date: day(10), title: 'Welcome Party — next week', notes: null, created_by: 'u-shaun', created_at: iso(2) },
]

export const onboardings: Onboarding[] = [
  {
    id: 'onb-1', name: 'Mbali Textiles', sponsor_id: 'sp-stdbank', budget: 150000,
    industry: 'Textiles', contact_person: 'Mbali Ndlovu', contact_email: 'mbali@mbalitextiles.co.za', contact_phone: '+27 82 111 2233',
    status: 'invoice_requested', current_owner_role: 'exco', current_owner_id: 'u-hiten', exco_id: 'u-hiten', created_by: 'u-hiten',
    needs_onsite: false, ember_applicable: true, missed_welcome_parties: 0, participants: ['u-hiten'],
    created_at: iso(2), last_action_at: iso(2),
  },
  {
    id: 'onb-2', name: 'Sizwe Auto', sponsor_id: 'sp-absa', budget: 200000, industry: 'Automotive', contact_person: 'Sizwe Dube',
    status: 'with_manco', current_owner_role: 'manco', current_owner_id: 'u-rinaldo',
    exco_id: 'u-jameel', manco_id: 'u-rinaldo', invoice_number: 'INV-2041', created_by: 'u-jameel',
    needs_onsite: false, ember_applicable: true, missed_welcome_parties: 0, participants: ['u-jameel', 'u-rinaldo'],
    created_at: iso(6), last_action_at: iso(1),
  },
  {
    id: 'onb-3', name: 'Palesa Bakery', sponsor_id: 'sp-sasol', budget: 90000, industry: 'Food & Beverage', contact_person: 'Palesa Mokoena',
    status: 'ember_loading', current_owner_role: 'consultant', current_owner_id: 'u-keanan',
    exco_id: 'u-hiten', manco_id: 'u-eugene', consultant_id: 'u-keanan', invoice_number: 'INV-2039', created_by: 'u-hiten',
    needs_onsite: true, ember_applicable: true, missed_welcome_parties: 0, participants: ['u-hiten', 'u-eugene', 'u-keanan'],
    created_at: iso(9), last_action_at: iso(2),
  },
  {
    id: 'onb-4', name: 'Thandi Cosmetics', sponsor_id: 'sp-stdbank', budget: 120000, industry: 'Cosmetics', contact_person: 'Thandi Zulu',
    status: 'welcome_invited', current_owner_role: 'external', current_owner_id: null,
    exco_id: 'u-jameel', manco_id: 'u-shaun', consultant_id: 'u-keanan', invoice_number: 'INV-2035',
    ember_applicable: true, ember360_report_url: 'https://drive.google.com/thandi/ember', drive_folder_url: 'https://drive.google.com/thandi',
    welcome_party_id: 'wp-1', needs_onsite: false, missed_welcome_parties: 0, participants: ['u-jameel', 'u-shaun', 'u-keanan'], created_by: 'u-jameel',
    created_at: iso(14), last_action_at: iso(1),
  },
  {
    id: 'onb-5', name: 'Bongani Logistics', sponsor_id: 'sp-sasol', budget: 180000, industry: 'Logistics', contact_person: 'Bongani Khumalo',
    status: 'red_no_show', current_owner_role: 'external', current_owner_id: null,
    exco_id: 'u-hiten', manco_id: 'u-rinaldo', consultant_id: 'u-keanan', invoice_number: 'INV-2028',
    ember_applicable: true, welcome_party_id: 'wp-1', needs_onsite: true, missed_welcome_parties: 2,
    participants: ['u-hiten', 'u-rinaldo', 'u-keanan'], created_by: 'u-hiten',
    created_at: iso(28), last_action_at: iso(3),
  },
]

export const welcomePartyInvites: WelcomePartyInvite[] = [
  { id: 'wpi-1', welcome_party_id: 'wp-1', onboarding_id: 'onb-4', status: 'invited', created_at: iso(1) },
  { id: 'wpi-2', welcome_party_id: 'wp-1', onboarding_id: 'onb-5', status: 'no_show', recorded_by: 'u-shaun', recorded_at: iso(3), created_at: iso(10) },
]

export const onboardingEvents: OnboardingEvent[] = [
  { id: 'oe-1', onboarding_id: 'onb-1', at: iso(2), user_id: 'u-hiten', kind: 'created', to_status: 'invoice_requested', text: 'Onboarding opened for Mbali Textiles.' },
  { id: 'oe-2', onboarding_id: 'onb-2', at: iso(6), user_id: 'u-jameel', kind: 'created', to_status: 'invoice_requested', text: 'Onboarding opened for Sizwe Auto.' },
  { id: 'oe-3', onboarding_id: 'onb-2', at: iso(1), user_id: 'u-jameel', kind: 'invoice_sent', from_status: 'invoice_requested', to_status: 'with_manco', to_owner_id: 'u-rinaldo', text: 'Invoice INV-2041 sent to the sponsor. Budget recorded.' },
  { id: 'oe-4', onboarding_id: 'onb-3', at: iso(2), user_id: 'u-eugene', kind: 'assigned_ember', from_status: 'with_manco', to_status: 'ember_loading', to_owner_id: 'u-keanan', text: 'Flagged as possibly non-tech-savvy; may need a site visit.' },
  { id: 'oe-5', onboarding_id: 'onb-4', at: iso(1), user_id: 'u-shaun', kind: 'added_to_party', from_status: 'welcome_ready', to_status: 'welcome_invited', text: 'Added to the welcome party list.' },
  { id: 'oe-6', onboarding_id: 'onb-5', at: iso(3), user_id: 'u-shaun', kind: 'no_show', from_status: 'welcome_invited', to_status: 'red_no_show', text: 'Second consecutive no-show — now red.' },
]
