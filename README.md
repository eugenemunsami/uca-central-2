# UCA Central

The central workflow platform for UCA beneficiary projects. Visibility of every beneficiary,
who owns each intervention, what the status is, and where the blockers lie — scored
automatically against the UCA playbook clocks.

Built for **Unconventional Capital & Advisory**. Brand: lime `#9FD150`, flame `#EE4823`,
jade `#19A06E`, ink `#1A1A1A`. Roboto Black titles, Arial body.

---

## What's new in this version

- **Aggregator → sponsor org model** — aggregators (e.g. BEE123) sit on top with sponsors under them; sponsors can also stand alone. Managed from Admin → Programmes; new entries appear app-wide instantly.
- **Acknowledge flow** — a newly assigned project lands in a "New projects" window in the owner's My work; they click Acknowledge to pull it into their normal list. The alert bell also lists items assigned today.
- **RAG overrides** show which user account made the override in the update history.


- **No cohort layer** — beneficiaries group directly under their sponsor/aggregator.
- **Bulk onboarding** — download the standard Excel template and load a whole intake at once (`src/lib/bulkOnboard.ts`).
- **Multiple directors, industry, phone** captured per beneficiary.
- **Close-out approval** — consultants *request* close-out; any ManCo confirms it. Requests surface in every ManCo's "My work".
- **Evidence pack (PDF)** — one button prints a beneficiary's full update history + call logs to PDF (`src/lib/evidencePack.ts`).
- **Service-type colour coding** on interventions across every screen (faint, separate from RAG).
- **Richer escalations** — reason, next steps, responsible owner, expected client-feedback date, optional effort trail.
- **RAG overrides** now carry an effective date + who logged them, and appear in the update history.
- **My work** filters + clickable stats + a "due this week" alert bell.
- **The Huddle** is beneficiary-led with search and filters (sponsor / intervention / consultant / beneficiary / RAG).

## What it does

**Entry point is SOW signature.** The Friday-to-Thursday BD cadence stays in Excel. When a
beneficiary signs, ManCo loads them into UCA Central with their pre-SOW history (Ember360
report link, welcome party date, SOW signed date) and the system takes over from there.

| Screen | Who | What it does |
|---|---|---|
| Exco dashboard | Exco, ManCo | RAG donut, stage funnel, load-by-consultant, escalation feed, drill-through table. Filter by sponsor and status. |
| Beneficiaries | Exco, ManCo, Consultants | Load a signed beneficiary; card per beneficiary with completion progress. |
| Beneficiary detail | All internal | Interventions, response clock, weekly update form (the six Huddle questions), update history, communication log, escalate button, RAG override. |
| My work | Consultants | Everything you own, sorted worst-first. Flags what needs an update before Wednesday. |
| The Huddle | All internal | Wednesday view: every live project grouped by owner, showing the latest six-question update and flagging stale ones. |
| Escalations | Exco, ManCo | Everything handed back to the client, with the trigger that caused it. |
| Admin | ManCo, Exco | Add/deactivate interventions in the catalogue, set default owners (routing), create users and set roles. |
| Portal | Sponsor / Aggregator | Read-only, scoped to their own cohort: progress, blockers, escalations. Internal notes and the comms log are **never** exposed here. |

## RAG is computed, not typed

The SLA engine (`src/lib/rag.ts` in the client, `v_intervention_rag` in Postgres — the two
mirror each other) applies the playbook:

- **Red** — no beneficiary response in **3 working days**; past due date; open escalation; no update logged in 10 days.
- **Amber** — on hold or awaiting beneficiary (a reason is required); due within 3 days; no update logged in 7 days.
- **Green** — moving, no breach.
- **Override** — ManCo can override any status, but must give a reason. The reason is what Exco and the client see.

A beneficiary's RAG is the worst of its interventions. Verified by 13 rule tests.

## Custom interventions

Beyond the standard catalogue (Branding, Web, Content, Print, Social, Google Ads, Surveys,
Finance, Compliance, Coaching), any intervention can be added as **custom** — capex, opex or
other — with a budget and motivation. That covers the case where a sponsor allocates spend
outside the standard scope of works.

---

## Running it

```bash
npm install
npm run dev
```

With no `.env`, the app runs in **demo mode**: seeded data, no login, pick a persona
(Hiten = Exco, Rinaldo = ManCo, Kudzai / Nqobile = Consultant, BEE123 = external).
Nothing persists. This is the mode to use for walking the team through it.

## Going live: Supabase → GitHub → Netlify

**1. Supabase**
1. Create a project at supabase.com.
2. SQL editor → run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
3. Authentication → Users → invite each UCA person by email.
4. For each new user, insert their profile (the `id` must match the auth user id):

```sql
insert into profiles (id, full_name, email, role, discipline, is_admin)
values ('<auth-user-uuid>', 'Rinaldo Josie', 'rinaldo@uca.co.za', 'manco', 'COO', true);
```

Roles: `exco`, `manco`, `consultant`, `external`. For an external user, also set
`external_client_id` (an AGGREGATOR id, e.g. BEE123 — they see every sponsor under it) or
`external_sponsor_id` (a single sponsor) — that is what scopes their read-only portal.

5. Optional but recommended — schedule the nightly escalation sweep:

```sql
select cron.schedule('uca-sla', '0 4 * * *', 'select raise_sla_escalations()');
```

**2. GitHub**

```bash
git init && git add . && git commit -m "UCA Central MVP"
gh repo create uca-central --private --source=. --push
```

**3. Netlify**
1. New site → import from GitHub → pick the repo. Build settings come from `netlify.toml`.
2. Site settings → environment variables:
   - `VITE_SUPABASE_URL` — your project URL
   - `VITE_SUPABASE_ANON_KEY` — the anon public key
3. Deploy. As soon as those two vars are set, the app switches from demo mode to live
   Supabase auth and data.

Every later change: push to `main`, Netlify rebuilds.

## Security

Row-level security is on for every table. The policies enforce:

- Exco / ManCo — full read, ManCo writes.
- Consultants — read everything internal, write their own interventions, updates and comms.
- External (sponsor / aggregator) — read **only** beneficiaries, interventions and escalations
  in their own cohort. `weekly_updates` and `comms_log` have no external read policy at all,
  so internal notes cannot leak even if the UI is bypassed.

## Known gaps for v2

- File upload for POE goes to a Google Drive link today, not native Supabase Storage.
- Escalation emails are not sent — the escalation is raised in-system and shown on the client portal.
- The pre-SOW cadence (Friday list → Welcome Party) is deliberately out of scope, per the MVP decision.
