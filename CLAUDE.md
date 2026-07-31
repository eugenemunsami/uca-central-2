# UCA Central — Project Checkpoint & Context

> **This file is the single source of truth for context.** Any new session should read it first.
> It is committed to the repo root so a fresh Claude Code / Cowork session opening this repo loads it
> automatically. Last updated at the "app is live with current data" milestone.

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
  (Migration **0006**). `ping()` is the live UI refresh mechanism (subscribe/listeners; no realtime).
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
`0019` archive_2025_jobs (TEMPORARY, fully isolated "2025 Archive" table — see §13).

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
- DONE: **Realtime** live sync (migration 0012 — 16 tables in supabase_realtime; repo.ts subscribes to postgres_changes and debounce-pings the reload). Clients auto-refresh, no manual refresh.
- DONE: **Discovery-form gate** (migration 0013). New interventions carry `discovery_status` ('pending'|'cleared'|'incomplete'|'na') + optional `discovery_link`. After acknowledge, My Work shows a "Discovery check" section; Complete/NA start the work + timers, Incomplete waits (log follow-up / escalate). **SLA/RAG timers only start once discovery is cleared** — baked into `v_intervention_rag` AND the client `computeRag`. Existing interventions backfilled to 'na'. ManCo sets the link in Add Intervention.
- DONE: **Admin section switches** (Option A, migration 0014). `profiles.hidden_sections text[]`; `TOGGLEABLE_SECTIONS` in types.ts; Layout filters nav by it; App.tsx route-guards hidden paths (redirect to /my-work); Admin Users tab has a "Sections" modal (`SectionsModal`) with per-section toggles. My Work / Portal always visible.
- DONE: **Central Hub** (migration **0015**). New bottom-left nav entry "Central Hub" (`/central-hub`, all roles incl. external, always-on — deliberately NOT in TOGGLEABLE_SECTIONS). Page (`src/pages/CentralHub.tsx`) has two tabs: (1) **UCA Central Help** — an interactive, searchable, role-tailored accordion manual (`HELP_TOPICS` filtered by `role`; content covers navigation, dashboard, beneficiaries/funding lines, My Work, discovery gate, close-outs, onboarding, escalations, Portal/sign-off for external, Admin for managers, accounts); (2) **Bugs & Ideas** — bug/idea logger + the user's own submissions with live status. Backend: `feedback` table (kind bug|lightbulb, title, detail, area, status open|in_progress|resolved|dismissed, priority none|low|med|high, favourite, author snapshot, admin_note reply, resolved_at/by) + RLS (anyone inserts/sees/deletes own; ManCo/Exco see & manage all) + added to `supabase_realtime`. Repo: `feedback()`, `addFeedback`, `updateFeedback` (auto-stamps resolved_at/by), `deleteFeedback`; demo `db.feedback`. Admin gets a **"Bugs & Ideas"** tab (`FeedbackAdmin`) — filter by type/status/starred, set priority, star favourite, change status, reply (shown to submitter), delete. All live via realtime.

- DONE: **External aggregator workspace** (migration **0016**). Aggregator-linked external users (external_client_id set, e.g. BEE123) now get, in addition to Portal + My Work + Central Hub: a scoped **Dashboard** (mounted at `/` for them via `aggExtra`; same page, RLS-scoped to their programme, with the internal "Load by consultant" chart + "Project manager" column hidden for `isExternal`), the **Onboarding** section (scoped to their sponsors) and a **Beneficiaries** section (scoped, RLS via `my_sponsors()`) whose detail is a **client-safe** page (`src/pages/ClientBeneficiaryDetail.tsx` — progress, stage, RAG, funding, interventions; NO internal comms log or consultant notes). Gate = `isAggregatorUser(user)` helper in types.ts; App.tsx adds the 3 routes for them; Layout.tsx nav adds Beneficiaries + Onboarding via `aggExtra`. **They can ACT** in onboarding only where the baton already makes the sponsor the owner: `red_no_show` (request site visit / withdraw) and `esc_sponsor` (resolve escalation) — `OnboardingDetail` `externalMine && EXTERNAL_ACT`; the internal-only generic buttons (Escalate to Sponsor, Add note) are hidden for them. RLS (0016): `onboardings` read + a scoped external UPDATE (only while `current_owner_role='external'` and in `my_sponsors()`); `onboarding_events` read/insert scoped; `welcome_parties` readable by aggregator externals; `welcome_party_invites` read scoped. `app_notify` is SECURITY DEFINER so external actions still notify internal staff. Sponsor-only externals (external_sponsor_id only) keep the Portal-only experience.

**Open clarification still parked (to do at the very end):** what "**program**" means as a filter dimension on the Onboarding dashboard (ED vs SD, or something else?) — only blocks that one sub-item.

**Onboarding escalation note:** the generic **Escalate to Aggregator/Sponsor** button (repo `onbRaiseToSponsor` → status `esc_sponsor`, remembers `esc_return_status`) is available to ALL internal staff who own a ticket — exco, manco AND **consultants** — at any non-esc stage (this was briefly manco/exco-only during the aggregator build; restored via `staff = role!=='external'` in OnboardingDetail). External (sponsor) users don't see it (can't escalate to themselves). On reaching `esc_sponsor`, `_onbApply` now also calls `app_notify_onb_sponsor` so the sponsor ACCOUNT(s) get an action-required notification (they have no user id in `participants`).

**Migrations now through 0019.**

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
