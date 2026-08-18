# UCA Central — Project Checkpoint & Context

> **This file is the single source of truth for context.** Any new session should read it first.
> It is committed to the repo root so a fresh Claude Code / Cowork session opening this repo loads it
> automatically. Last updated at the "app is live with current data" milestone.
>
> **New team member?** See **`TEAM_START.md`** in the repo root for the shared-account setup, the
> per-session initiation message, and the coordination rules (one `main`, one DB — flag structural work).

---

## 1. What this is

UCA Central is the internal operations app for **The Unconventional CA (UCA)**, which runs
Enterprise & Supplier Development (ESD/SD) programmes. It tracks SMME beneficiaries from a
sponsor's invoice request, through onboarding and a signed Scope of Works (SOW), into live
delivery of interventions, escalations, and close-out/reporting — across **aggregators**
(e.g. BEE123) and the **sponsors** (funders) beneath them.

**Status: LIVE in production with actual, current data and real users.**

## 2. Stack & infrastructure

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + framer-motion + react-router-dom +
  lucide-react + recharts + @supabase/supabase-js.
- **Repo:** GitHub `eugenemunsami/uca-central-2`, default branch `main`. (Local `/root/uca` git is a
  stale "baseline snapshot" — **source of truth is GitHub `main` + the live Supabase DB**, not local git.)
- **Hosting:** Netlify site **`ucacentral`** (site id `a6a94f9d-e305-410d-954f-688f3ef12911`),
  URL **https://ucacentral.netlify.app**. Auto-builds from `main`. Build: `tsc -b --noCheck && vite build`.
  No service worker (only a PWA `manifest.webmanifest`), so no aggressive caching — a hard refresh gets latest.
- **Backend:** Supabase project **"UCA Central"**, ref **`xdsssfkkfytxjwnijkqm`** (eu-central-1, Postgres 17).
  RLS enabled everywhere. `pgcrypto` lives in the **`extensions`** schema (use `extensions.crypt` / `extensions.gen_salt`).
- **DEMO vs LIVE:** `LIVE = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`. repo.ts has an in-memory
  `db` for demo; production runs LIVE against Supabase. Every repo method must handle both branches.

## 3. Auth, roles & the email problem

- **Auth:** Supabase Auth (email + password). `profiles.id == auth.users.id` (1:1, verified).
- **Roles:** `exco`, `manco`, `consultant`, `external`. `can('manage')` = manco **or** exco.
  Routing (`src/App.tsx`): `external` → Portal + ClientWork; internal → Dashboard, Beneficiaries,
  Onboarding, My Work, Huddle, Escalations, Admin. A `status='pending'` profile is forced to the
  **Set-Password** screen on login (choose own password + accept terms → `active`).
- **Invite flow:** `createUser` → `invite-user` edge function (creates auth user + profile + sends email).
- **KNOWN ISSUE — invite/reset/login-code emails are NOT delivered** (project still on Supabase's
  built-in, rate-limited email; corporate filters block it). **Workaround** used repeatedly: set a temp
  password directly and have the user set their own on first login (emails are already confirmed):
  ```sql
  update auth.users set encrypted_password = extensions.crypt('<temp-pw>', extensions.gen_salt('bf')),
    updated_at = now() where id = '<auth-user-id>';
  ```
  Accounts activated this way: **Hiten Keshave, Jameel Khan** (exco); **Shereka Padayachi, Abie Seiso,
  Fikile Khuzwayo** (external/BEE123). **TODO: configure real SMTP** so invites/resets/codes deliver.

## 4. Data model (essentials)

- **Org:** `aggregators` (BEE123, …) → `sponsors` (`aggregator_id` nullable; a sponsor may stand alone) →
  beneficiaries.
- **Beneficiaries = per-invoice "funding lines".** A real business can be funded by several
  sponsors/invoices. Each `beneficiaries` row is one funding line; rows sharing **`company_id`** are the
  same business (null `company_id` = a company of one, keyed by its own id — helper `companyKey(b)=b.company_id ?? b.id`).
  `invoice_number` is on the beneficiary. **Consultants see one collapsed card per business** (all
  interventions together, each tagged by funder); **Exco/ManCo/funders see the lines separately.**
  Manual link/unlink lives on the beneficiary detail "Funding lines" panel; SOW conversion has an
  "attach to existing beneficiary" picker. (Migration **0008**.)
- **Interventions:** attach to `beneficiary_id`, assigned to a `consultant_id`, RAG computed.
  Close-out chain: consultant **requestCloseout** → ManCo **confirmCloseout** (verify) or
  **returnCloseout** (send back with reason). When *all* a beneficiary's interventions are confirmed,
  lifecycle → `pending_closeout` → ManCo "Produce & send close-out" (POE report) → client acknowledges
  → `concluded` → `archived`. Re-onboard bumps `cycle`.
- **Onboarding module (pre-SOW pipeline):** ownership-baton tickets, owner moves
  Exco → ManCo → Consultant → Aggregator/Sponsor and back. Stages: invoice → intake → Ember360
  (loading/review/revision) → welcome party (weekly `welcome_parties` + invites, attendance recorded by
  ManCo/Exco) → attended → SOW sent → **signed → converts to a beneficiary** (`app_convert_onboarding`,
  carries invoice_number). Red at 2 missed parties → sponsor removes or requests a site visit;
  escalations reuse the existing Escalations queue. (Migration **0007**; import template + explainer doc
  generated; Dashboard has an Onboarding summary tab.)
- **Escalations:** per-intervention ownership-baton state machine (owner + status + audit events + notifications).
- **Notifications / activity:** SECURITY DEFINER helpers `app_notify`, `app_notify_manco`,
  `app_notify_client`, `app_log_ben_event`, `app_log_user_event` (all require `auth.uid()` — they no-op
  from raw SQL/service context). pg_cron sweeps create `sla_breach_internal`, invite-expiry, early-warning
  (Migration **0006**). Live UI refresh runs on **Supabase Realtime** (migration 0012 — repo.ts subscribes to
  `postgres_changes` and debounce-`ping()`s a reload; **24 tables** in the `supabase_realtime` publication as of 0021). See §12 Batch C.
- **Views (all `security_invoker=on`):** `v_intervention_rag`, `v_beneficiary_rag`, `v_escalation`,
  `v_onboarding`. Adding a beneficiary column means also adding it to `v_beneficiary_rag`.

## 5. Migrations (in `/supabase/migrations`, applied live)

`0002` admin delete · `0003` live backend · `0004` user soft delete · `0005` escalation notifications ·
`0006` live notifications/events/sweeps · `0007` onboarding · `0008` beneficiary company (funding lines) ·
`0009` welcome-party Teams URL · `0010` rag reason on completed · `0011` onboarding esc return ·
`0012` realtime publication · `0013` discovery gate · `0014` user hidden_sections · `0015` feedback (Bugs & Ideas) ·
`0016` external aggregator access (scoped onboarding read + sponsor-act; onboarding/party RLS relaxed to my_sponsors) ·
`0017` intervention_catalogue readable by external (so v_intervention_rag can label titles/categories in the client view) ·
`0018` app_notify_onb_sponsor (notify the Aggregator/Sponsor account(s) when an onboarding ticket is escalated to them) ·
`0019` archive_2025_jobs (TEMPORARY, fully isolated "2025 Archive" table — see §13) ·
`0020` external updates+comms read (relax `p_wu_read`/`p_cm_read` to `is_internal() or my_sponsors()`-scoped, so aggregator accounts get full progress + evidence-trail visibility on their own beneficiaries — see §15) ·
`0021` internal tasks (self-contained staff-to-staff module: `internal_tasks` + `internal_task_subtasks` + `internal_task_comments`; own+raised RLS with Exco-sees-all; added to realtime — see §16).

## 6. Key files

`src/lib/repo.ts` (data layer, demo+live — the big one), `src/lib/types.ts`,
`src/pages/{Dashboard,Beneficiaries,BeneficiaryDetail,Onboarding,MyWork,Escalations,Huddle,Admin,Portal,ClientWork,Login,SetPassword}.tsx`,
`src/components/{Layout,OnboardingDetail,EscalationDetail,ui}.tsx`, `src/context/AuthContext.tsx`, `src/App.tsx`.

## 7. Live data state

BEE123 onboarding pipeline loaded from the CEO's + COO (Rinaldo's) enriched file: 37 onboarding cases,
8 signed-SOW conversions plus additional past-SOW beneficiaries (~20 beneficiary rows / ~18 businesses live).
Corrections made: **Thokoman SD** — Farmers Hope INV-337 + INV-338 merged into one business; Ncego (INV-339);
Exodus Digital Media (INV-340, contact Dinia Makhuvele). **Foskor "ED & SD"** ticket deleted.
**PolyCo ESD Programme** renamed to **Mohau Innovate** (sponsor PolyCo / BEE123 / INV-341).
A throwaway **"Test"** beneficiary (BEE123 Recurring) is intentionally left in the approve queue for now.

## 8. Integrations connected

GitHub, Supabase, Netlify, Google Drive, ClickUp, Jotform, Make, and **PandaDoc**. PandaDoc has one
template, **"Scope of Works Agreement — UCA"**; the actual scope/service items live in PandaDoc's
**Content Library**, which this connector does NOT expose — they must be exported/pasted to load into
Central's `intervention_catalogue`.

## 9. How we work (conventions)

- **Code changes:** edit in `/root/uca` → `npx tsc --noEmit` (real typecheck; the build script uses
  `--noCheck`) → `npm run build` → push **whole files** to `main` via the GitHub MCP `push_files`,
  verifying byte-for-byte with `git hash-object` (a subagent is used for large/multi-file pushes) →
  Netlify auto-deploys → verify deploy `state:"ready"` and `commit_ref`.
- **DB changes:** apply to live via Supabase `execute_sql`/`apply_migration` **and** commit the `.sql` to
  `/supabase/migrations`. Keep migrations **additive & inert** so they're safe to apply before the
  frontend that uses them ships; make data conversions **idempotent**.
- **Big features:** align on the logic first (use AskUserQuestion), then build.
- **Supabase `execute_sql` returns only the LAST statement's rows** — put the verification SELECT last,
  or run separate calls.

## 10. Open items / backlog

- **Configure real SMTP** (Supabase auth email delivery is broken).
- **Load the intervention catalogue** from PandaDoc Content Library scope items (needs an export); also
  normalise the duplicate `Marketing` vs `Marketing ` (trailing space) category.
- Optional: unify company-level fields (contact / industry / drive folder) across a business's funding lines.
- **Foskor** R8.88m combined ED&SD budget → per-ticket split (the combined ticket was deleted; may need
  fresh tickets).
- Remove the **"Test"** beneficiary when no longer needed.
- **Incoming: a large list of feedback-driven updates** (some large) — to be triaged and batched.

## 11. Recently shipped this milestone

Multi-sponsor beneficiary funding lines (consultant single-card view + manual link + attach-at-conversion);
"Beneficiary Google Drive folder" field on the add form + always-shown Drive link in the detail panel;
a **Return**-with-reason action added to the ManCo "Close-out requests" queue in My Work. The full
close-out request → verify → beneficiary-level close-out pipeline is confirmed working end-to-end in live.

## 12. Update round "Central Update 1" — status

Source: `Central Update 1.pdf`. Triaged into Batch A (quick UI), Batch B (medium), Batch C (big).

**Decisions locked (from the user):**
- Live updates → **Supabase Realtime** (instant push). Batch C.
- **Central Hub** (interactive help manual + "Bugs & Lightbulbs" logging → admin list w/ delete/prioritise/favourite) → **deferred to its own dedicated pass** after the rest.
- Admin per-user section switches → **Option A: visibility layer on top of roles** (can only hide sections a role already permits; role stays the ceiling). Batch C.
- **Discovery links** = Google-Form links embedded in the SOW, one per intervention where applicable. The My Work acknowledge step becomes: consultant confirms whether the beneficiary filled that form (or marks Not Applicable). **SLA/RAG timers for an intervention start only AFTER its discovery-link phase clears.** Batch C.

**Batch A — DONE & deployed (4 slices):**
1. "Exco dashboard" → **Central Dashboard**; sub-title commentary stripped across internal spaces; client filter moved above the charts.
2. Modals render via a **portal to body** (open in view — fixes the scroll-to-find-popup issue); **Onboarding search**; **Drive folder button before Confirm** on close-out verify; beneficiary cards get a pulsing **green tick when all interventions complete** + clearer "X of Y complete" progress + "No interventions assigned yet" state.
3. Welcome parties: **MS Teams registration link** (captured on create/edit, shown on card) + **ManCo edit/delete** (migration **0009**).
4. Close-out email logged as an **email communication** (shows in Comms Log) + **comms folded into the beneficiary Activity timeline**.

**Batch B — NEXT (not started):** dashboard open-interventions-by-type chart + beneficiaries-with-no-interventions count card; Beneficiaries no-interventions view + implementation/completed/unassigned toggle; My Work completed-vs-ongoing split + fix closed/verified interventions still showing "past due"; Onboarding contemporary sectioned layout; onboarding ownership surfaced in each owner's My Work (incl. external + consultant) with notifications; onboarding escalate at any stage (direct consultant/ManCo ↔ aggregator sponsor, no ManCo approval).

**Batch C — status:**
- DONE: **Realtime** live sync (migration 0012 — first published the realtime set; now **24 tables** in supabase_realtime after later additions incl. 0021; repo.ts subscribes to postgres_changes and debounce-pings the reload). Clients auto-refresh, no manual refresh.
- DONE: **Discovery-form gate** (migration 0013). New interventions carry `discovery_status` ('pending'|'cleared'|'incomplete'|'na') + optional `discovery_link`. After acknowledge, My Work shows a "Discovery check" section; Complete/NA start the work + timers, Incomplete waits (log follow-up / escalate). **SLA/RAG timers only start once discovery is cleared** — baked into `v_intervention_rag` AND the client `computeRag`. Existing interventions backfilled to 'na'. ManCo sets the link in Add Intervention.
- DONE: **Admin section switches** (Option A, migration 0014). `profiles.hidden_sections text[]`; `TOGGLEABLE_SECTIONS` in types.ts; Layout filters nav by it; App.tsx route-guards hidden paths (redirect to /my-work); Admin Users tab has a "Sections" modal (`SectionsModal`) with per-section toggles. My Work / Portal always visible.
- DONE: **Central Hub** (migration **0015**). New bottom-left nav entry "Central Hub" (`/central-hub`, all roles incl. external, always-on — deliberately NOT in TOGGLEABLE_SECTIONS). Page (`src/pages/CentralHub.tsx`) has two tabs: (1) **UCA Central Help** — an interactive, searchable, role-tailored accordion manual (`HELP_TOPICS` filtered by `role`; content covers navigation, dashboard, beneficiaries/funding lines, My Work, discovery gate, close-outs, onboarding, escalations, Portal/sign-off for external, Admin for managers, accounts); (2) **Bugs & Ideas** — bug/idea logger + the user's own submissions with live status. Backend: `feedback` table (kind bug|lightbulb, title, detail, area, status open|in_progress|resolved|dismissed, priority none|low|med|high, favourite, author snapshot, admin_note reply, resolved_at/by) + RLS (anyone inserts/sees/deletes own; ManCo/Exco see & manage all) + added to `supabase_realtime`. Repo: `feedback()`, `addFeedback`, `updateFeedback` (auto-stamps resolved_at/by), `deleteFeedback`; demo `db.feedback`. Admin gets a **"Bugs & Ideas"** tab (`FeedbackAdmin`) — filter by type/status/starred, set priority, star favourite, change status, reply (shown to submitter), delete. All live via realtime.

- DONE: **External aggregator workspace** (migration **0016**). Aggregator-linked external users (external_client_id set, e.g. BEE123) now get, in addition to Portal + My Work + Central Hub: a scoped **Dashboard** (mounted at `/` for them via `aggExtra`; same page, RLS-scoped to their programme, with the internal "Load by consultant" chart + "Project manager" column hidden for `isExternal`), the **Onboarding** section (scoped to their sponsors) and a **Beneficiaries** section (scoped, RLS via `my_sponsors()`) whose detail is a **client-safe** page (`src/pages/ClientBeneficiaryDetail.tsx` — progress, stage, RAG, funding, interventions; NO internal comms log or consultant notes). Gate = `isAggregatorUser(user)` helper in types.ts; App.tsx adds the 3 routes for them; Layout.tsx nav adds Beneficiaries + Onboarding via `aggExtra`. **They can ACT** in onboarding only where the baton already makes the sponsor the owner: `red_no_show` (request site visit / withdraw) and `esc_sponsor` (resolve escalation) — `OnboardingDetail` `externalMine && EXTERNAL_ACT`; the internal-only generic buttons (Escalate to Sponsor, Add note) are hidden for them. RLS (0016): `onboardings` read + a scoped external UPDATE (only while `current_owner_role='external'` and in `my_sponsors()`); `onboarding_events` read/insert scoped; `welcome_parties` readable by aggregator externals; `welcome_party_invites` read scoped. `app_notify` is SECURITY DEFINER so external actions still notify internal staff. Sponsor-only externals (external_sponsor_id only) keep the Portal-only experience.

**Open clarification still parked (to do at the very end):** what "**program**" means as a filter dimension on the Onboarding dashboard (ED vs SD, or something else?) — only blocks that one sub-item.

**Onboarding escalation note:** the generic **Escalate to Aggregator/Sponsor** button (repo `onbRaiseToSponsor` → status `esc_sponsor`, remembers `esc_return_status`) is available to ALL internal staff who own a ticket — exco, manco AND **consultants** — at any non-esc stage (this was briefly manco/exco-only during the aggregator build; restored via `staff = role!=='external'` in OnboardingDetail). External (sponsor) users don't see it (can't escalate to themselves). On reaching `esc_sponsor`, `_onbApply` now also calls `app_notify_onb_sponsor` so the sponsor ACCOUNT(s) get an action-required notification (they have no user id in `participants`).

**Migrations now through 0021.**

## 13. 2025 Archive (TEMPORARY — removable, fully isolated)

BEE123 asked for line of sight into the 2025 (FY25) projects. Built as a standalone section that **shares
nothing with the rest of Central** — no existing table/view/function/RLS policy/realtime channel is
touched, and no shared module (repo.ts, useData) is imported. Rollback point: branch
**`checkpoint-pre-2025-archive`** (at commit `1ea0174`, the state just before this feature).

- **DB:** table **`archive_2025_jobs`** (migration `0019`), one row per intervention, grouped in the UI
  by `beneficiary_key`. Columns incl. `status` (Not Started | In Progress | Complete: To Send Report |
  Closed), `rag` (green/amber/red), `latest_comment` (+ updated_at/by), `category`, `invoice`, `owner`,
  `source` (creative|finance), `sort`. RLS: **read = any signed-in user (internal AND external)**;
  **update = internal staff (`is_internal`)**; insert/delete = manco. NOT in the realtime publication.
  Seeded (70 jobs / 41 beneficiaries) from the two BEE123 FY25 spreadsheets via `supabase/seed_2025_archive.sql`.
- **Frontend:** `src/lib/archive2025.ts` (self-contained fetch/update + embedded demo seed
  `archive2025.seed.json`), `src/pages/Archive2025.tsx` (beneficiary-grouped cards, per-intervention
  edit modal for status/RAG/comment — internal only; external read-only), nav entry "2025 Archive"
  (all roles, bottom of sidebar next to Central Hub), route `/archive-2025` in both App.tsx branches.
  Filters: search (beneficiary), intervention type, status, RAG.
- **To remove later:** `drop table archive_2025_jobs;` + delete Archive2025 page/module/seed + the nav
  entry + the two `/archive-2025` routes (or git-revert the feature commits / reset to the checkpoint branch).

 Realtime is live, so any new operational table should be added to the supabase_realtime publication too (the `feedback` table already is). Note: v_*_rag views are `security_invoker`, so any table they JOIN for labels (e.g. `intervention_catalogue`) must be READABLE by whichever role should see those labels — else the COALESCE fallback shows generic text (this was the "Intervention/-" bug fixed in 0017).

## 14. Monitech ESD load (backend bulk load into LIVE tables)

Monitech (standalone sponsor **"Monitech Mining"**, id `30eeb0a4-c3a9-4acb-9c02-7277083390f7`) FY26 ESD programme loaded from `Monitech_Project_Tracker.xlsx` via `supabase/load_monitech.sql` (one-off DML, run through execute_sql, committed for the record). Decisions: only the 6 active beneficiaries; **split by stage** — the 3 ED (diagnostics complete) went in as **live Beneficiaries** at stage `sow`, RAG override `red` ("Agreement not signed"), each with 2 custom interventions (Business coaching & mentorship = R19,500, not_started, consultant **Rinaldo**; Ember360 diagnostic = completed, consultant **Keanan**); the 3 SD (diagnostics in progress) went in as **Onboarding tickets** at `ember_loading` (consultant Keanan, manco Rinaldo, exco Jameel). The outsourced coach **Rajesh Sukha** isn't a Central user, so he's named in each coaching intervention's weekly-update history + `custom_motivation`. Prospects/withdrawn (MON-007..010) not loaded. **Rollback:** commented delete block at the foot of `load_monitech.sql` (delete by sponsor — these are currently the only Monitech rows). NB: a separate, unrelated "Dynamic Gee" already exists under another sponsor — Monitech's is its own ED engagement.

**Woolworths ED load** (`supabase/load_woolworths.sql`, same technique): sponsor **Woolworths** (standalone, exists). One beneficiary **Thobela Royale Investments (Pty) Ltd** (WW-001, ED/Agriculture) loaded as a **live Beneficiary** at stage `implementation`, RAG override `red` (non-responsive — VAT/payroll/grant docs outstanding), with **9 custom interventions** (3 completed, 1 on_hold payroll, 5 in_progress), consultant = **Nqobile Jiyane** (existing consultant, the tracker's UCA owner + PM); coaching delivered by outsourced coach **Poonam** (not a user) named in that intervention's history. Each intervention seeded with a weekly-update from its tracker note. Rollback block at foot of the load file (delete by sponsor — currently the only Woolworths beneficiary).

**UVU Animation load** (`supabase/load_uvu.sql`): sponsor **UVU** (standalone, exists). Loaded the recommended **20 of 22** rows — held back UVU-021 CJ Logistics (placeholder contact = owner's gmail) and UVU-022 Simbart Drawings (tracker-flagged possible duplicate). **Split by stage:** 15 diagnostic-complete → **live Beneficiaries** at stage `sow` (2 custom interventions each: Ember360 diagnostic = completed, Animation programme report = not_started), all owner/consultant **Callyn Josie** (existing consultant); 5 diagnostic-in-progress → **Onboarding tickets** at `ember_loading` (consultant Callyn, manco Rinaldo, exco Jameel). SQL built with CTEs (no literal UUIDs — DB wires FKs). Post-load `update weekly_updates set created_at=now()` on the 3 carried-over report notes so the 10-day staleness rule didn't false-red tracker-green beneficiaries. Rollback block at foot (delete by sponsor).

**Telkom FutureMakers load** (`supabase/load_telkom.sql`): sponsor **Telkom** (standalone, exists). 8 ED beneficiaries loaded as **live Beneficiaries** at stage `implementation` (Post-Diagnostic / in delivery). Each: **coaching** (completed, by an unnamed outsourced coach) + **needs-analysis call** (in_progress) — consultant/PM **Jameel Khan** (exco, the tracker owner); ONEA + HOSEA each also got a **marketing** intervention (not_started, consultant **Eugene Munsami**, manco). 18 interventions total. **HOSEA** = rag_override red (awaiting Telkom approval on its support request). Client contact Thembi Mafunda recorded. Built with CTEs; rollback block at foot (delete by sponsor).

**Standard Bank SD (BDSP) load** (`supabase/load_sbsa.sql`, generator `scripts/gen_sbsa.py`): sponsor **Standard Bank** (standalone, EXISTING, id `4e401d68-a1e5-4b74-9a67-1ce9511569e4` — note the trailing space in the name). This was an **UPDATE onto an existing sponsor**, not a fresh load. Standard Bank already had 2 beneficiaries (**Hearts & Flowers**, **Leras Events**) from an earlier entry, both PM'd by Boitumelo Matobela and sitting at `implementation`/`pending_closeout`. Loaded from `SBSA_SD_Programme_BDSP_Tracker_final.xlsx`: a Supplier Development (Annexure B) programme, 6 contracted beneficiaries. **4 new** loaded fresh as live Beneficiaries at `implementation`: **VB Shopfitters** (red, 5 lines R116,957, all on_hold — director deceased/estate), **Mandla Lighting** (red, 3 lines on_hold — off-boarding at director's request), **Sintra Creative** (green, 2 lines both completed), **S&K Panel Beaters** (red, 4 lines not_started, delivery from Aug 2026). Each intervention is a custom Annexure-B development area with `custom_budget` = its ex-VAT fee, status mapped (On Hold→on_hold+hold_reason, Delivered→completed, Not Started→not_started, In Progress/Ongoing→in_progress). **2 existing reconciled in place** (user chose "reconcile & reopen"): kept their delivered interventions, added the one missing Annexure-B line each (Hearts & Flowers → *Strategy and Brand Audit* in_progress R65,384; Leras → *Monitoring, Evaluation & Reporting (Ember360)* continuous), refreshed RAG (H&F amber, Leras red)/notes, appended the monthly Status-Log updates, and **reopened both from `pending_closeout` to `active`** (the added line is guarded with NOT EXISTS so re-running won't duplicate). Owner/PM **Boitumelo Matobela**; **2 open escalations** (VB Shopfitters business-continuity risk; Mandla off-boarding) raised by **Rinaldo Josie** to SBSA ESD, `status='with_sponsor'`, owner external, `escalations.sponsor_id`=null. The 11-row **Vetting Pipeline** was intentionally **skipped** (referrals not yet contracted). Result: 6 beneficiaries / 20 interventions / 2 escalations / 9 weekly updates under the sponsor. Built CTE + gen_random_uuid; weekly-update UNION branches need `::uuid`/`::timestamptz` casts (same gotcha as UVU). Rollback notes at foot (new benes deletable by name; the 2 added reconcile lines deletable by custom_name).

**Nedbank SIU load** (`supabase/load_nedbank.sql`, generator `scripts/gen_nedbank.py`): sponsor **Nedbank SIU** (standalone, exists, id `28d8ffac-d2fb-4ddb-acd7-86c580c23091` — NB there's also a separate empty plain **"Nedbank "** sponsor `76b76428-…`; SIU is the SMME Investment Readiness Programme). Loaded from `Nedbank_SMME_Programme_Tracker.xlsx` (all 15 cohort SMMEs). All have Ember360+DD complete, so **all 15 are live Beneficiaries** (none in Onboarding). **Stage:** the 9 "Tranche 1 Complete" → `monitoring`; the other 6 (In Delivery / Escalated / Onboarding-but-diagnostic-done) → `implementation`. Each beneficiary = **2 custom interventions**: *Ember360 diagnostic & DD assessment* (completed, carries the DD-Baseline readiness %, eligibility, weakest category) + *Investment-readiness coaching — 6 sessions (F1-F4, BS1, BS2)* (status from sessions delivered: 6/6 completed, 1-5 in_progress, 0 not_started, non-engagement→awaiting_beneficiary). 30 interventions, 15 weekly-updates (Status-Log notes; NED-012 synthesized). **RAG pinned to the tracker** via beneficiary-level `rag_override` (6 red / 4 amber / 5 green) + intervention `rag_override` on the non-completed coaching rows. **Owner** (project_manager + consultant + update author) = **Boitumelo Matobela** (manco, the tracker's report author); the 3 delivery coaches (Mark Frankel, Mohamed E. Tayob, Matthew Emmanuel) aren't Central users, so they're named in each coaching intervention's `custom_motivation`. **10 open escalations** (9 from the Escalation Log + NED-012 from the master's Escalated=Yes flag) as `status='with_sponsor'`, `current_owner_role='external'`, owner null, `consultant_id`=Boitumelo, `manco_id`/`raised_by`=**Rinaldo Josie**; each with a `raised` escalation_event. **NB `escalations.sponsor_id` FKs to `profiles` (a sponsor *user*), NOT the sponsors table — set null here** (Nedbank has no user account). Built with CTE-per-SMME + `gen_random_uuid()` (no literal row UUIDs). Rollback block at foot — escalations delete **by beneficiary_id** (not sponsor_id, which is null on these rows).

## 15. Aggregator visibility + Onboarding UX (shipped)

Requested: give **aggregator** accounts (e.g. BEE123) more visibility, and make Onboarding more browsable. Decisions locked with the user: **aggregators only** (standalone-sponsor externals stay Portal + My Work); **full transparency** for aggregators (progress + latest update **and** the comms/evidence trail).

- **RLS (migration `0020`):** `p_wu_read` (weekly_updates) and `p_cm_read` (comms_log) relaxed from `is_internal()` to `is_internal() or <my_sponsors()-scoped>` (updates scoped via interventions→beneficiaries; comms via beneficiary_id). Internal read unchanged; a partner only ever sees their own beneficiaries. Scope is `my_sponsors()` so it technically also covers sponsor-only externals, but the UI restricts the richer pages to aggregators, so it's inert for them.
- **Huddle for aggregators:** added `'huddle'` to `aggExtra` in `Layout.tsx` + `{agg && <Route path="/huddle">}` in `App.tsx`. `Huddle.tsx` is unchanged — it's read-only off `useData` (RLS-scoped), so it just works and now shows the full per-intervention update (incl. blocker/owner) for their beneficiaries.
- **`ClientBeneficiaryDetail.tsx`:** no longer "client-safe". Added a **Progress updates** timeline (full six-field weekly updates, per intervention) + a **Communication & evidence log** (channel, context, follow-up email text). Read-only — still no edit/act controls. Removed the "notes not shared" disclaimer.
- **`Onboarding.tsx` (full rewrite of the page component; helper modals unchanged):** added a **sponsor filter** (distinct `client_name`) and a **grouped-stage filter** via new `ONB_STAGE_GROUPS`/`onbGroupKey` in types.ts (buckets: Intake, Ember360, Welcome party, SOW, Escalation, Remediation/red). Replaced the long linear layout with a local **`Accordion`** component: active tickets grouped by stage bucket (a bucket with any `is_red` ticket auto-opens + shows a red dot); Welcome parties, Converted and Withdrawn are collapsed-by-default accordions.
- **`ClientWork.tsx` (external My Work):** the onboarding area is now a proper **Onboarding** section with a highlighted **"Needs your action"** block for tickets whose baton is with the sponsor (`red_no_show`, `esc_sponsor`) — each opens `OnboardingDetail` in a modal so they can act (RLS `p_onb_ext_update` from 0016 already permits it); the rest stays the view-only pipeline. This surfaces onboarding escalations in My Work, which they previously never did. Applies to any external who owns such a ticket (not just aggregators — RLS keeps it to their own sponsor).

## 16. Internal Tasks (staff-to-staff module, shipped)

Ad-hoc internal jobs UCA staff assign to each other (e.g. "pull me the event attendee spreadsheet") — deliberately **separate from beneficiary delivery and onboarding**, to make this otherwise-invisible work trackable, give Exco sight of it for resource planning, and give each owner a dedicated slot in My Work. Requirements locked with the user: anyone internal can assign to anyone; task = basics + sub-task checklist + notes/comments; Exco dashboard shows workload-per-person + a drill list; own+raised visibility (Exco sees all); notify assignee on assign + comment; a **close-out loop** (assignee submits → requester verifies or sends back with a reason → Completed, split **Requested** vs **Executed**). Named "Internal Tasks" to stay distinct from the Huddle's event task-board.

- **DB (migration `0021`):** three self-contained tables — `internal_tasks` (title, detail, `requester_id`, `assignee_id`, priority low|medium|high, status **open→in_progress→submitted→done**, due_date, submitted_at, verified_at, return_reason), `internal_task_subtasks` (checklist), `internal_task_comments` (thread). No FKs into beneficiaries/onboardings. RLS: read/update = `is_internal() and (my_role()='exco' or requester_id=auth.uid() or assignee_id=auth.uid())`; insert requires `requester_id=auth.uid()`; delete = requester or Exco; children follow the parent's visibility; comment insert requires `author_id=auth.uid()`. All three added to `supabase_realtime` (publication now 24 tables).
- **Data layer:** `db.internalTasks/Subtasks/Comments` + demo seed in `demo.ts`; `REALTIME_TABLES` extended; repo methods `tasks()` (nests subtasks+comments), `addTask`, `updateTask`, `startTask`, `submitTask`, `verifyTask`, `returnTask`, `deleteTask`, `addSubtask`, `toggleSubtask`, `deleteSubtask`, `addTaskComment`, `_taskRow` — mirror the close-out chain (demo `ping()`, live relies on realtime; notifications via existing `app_notify`). **Self-assigned tasks auto-complete on submit** (no separate verifier). `useData()` exposes `tasks: InternalTaskView[]`. New `NotificationKind`s: `task_assigned|task_comment|task_submitted|task_returned|task_verified` (notifications.kind is free text — no enum change needed).
- **Types:** `TaskStatus`, `TaskPriority`, `TASK_STATUS_LABEL`, `TASK_PRIORITY_LABEL`, `TASK_PRIORITIES` (high→low), `TASK_ACTIVE_STATUSES`, `InternalTask/Subtask/Comment/View`; `TOGGLEABLE_SECTIONS` gains `tasks`.
- **Frontend:** nav entry **Internal Tasks** (`/tasks`, internal-only, admin-toggleable) in `Layout.tsx` + route in `App.tsx` (internal block only). New `src/pages/InternalTasks.tsx` (create modal, filters, Active list, Completed split Requested/Executed; exports a shared `TaskCard`). New `src/components/InternalTaskDetail.tsx` (shared modal: sub-tasks, comments, and status-driven actions — start/mark-done for the assignee, verify/send-back for the requester). `MyWork.tsx` gains an **Internal tasks** section ("Needs your verification" + "Assigned to me"). `Dashboard.tsx` gains an **Exco-only** third view "Internal tasks" (workload-per-person meter + active drill list; gated `user?.role==='exco'`, non-exco falls back to delivery). Removable cleanly (drop the 3 tables + the page/component/nav/route + the `tasks` wiring).

**Migration-history drift note:** the live DB also has `evt_*` (event/task board behind The Huddle — `evt_events`, `evt_tasks`, `evt_task_owners`, `evt_people`) and `office_*` tables that are **NOT** represented in `/supabase/migrations` (they were created directly). They back `Huddle.tsx`. Leave them alone when adding migrations; the Internal Tasks module is unrelated to `evt_tasks`.
