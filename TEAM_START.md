# UCA Central — Team Start Guide

For: Eugene · Shaun · Hiten
Purpose: get any team member's Claude (Cowork) connected to the live UCA Central system and ready to work in a couple of minutes.

UCA Central is the programme-management app for The Unconventional CA — it tracks ESD/SD beneficiary delivery across aggregators (e.g. BEE123) and standalone sponsors. The full system context lives in `CLAUDE.md` (read that after setup).

---

## The setup model (read once)

We run **one of everything, shared**:

- **GitHub repo:** `eugenemunsami/uca-central-2` — branch `main`
- **Supabase project:** "UCA Central" — ref `xdsssfkkfytxjwnijkqm`
- **Netlify site:** `ucacentral` → https://ucacentral.netlify.app (auto-deploys from `main`)

Everyone connects their Claude to these **same accounts using the shared logins**. That means every person's Claude sees the identical repo, database and site — no per-person invites and no repo-scoping surprises.

Keep the three shared logins **and their 2FA codes** in the team password manager (1Password / Bitwarden). That's what lets each of you sign in during the connector setup without relaying one-time codes.

---

## One-time setup (each person, once)

1. Get the shared logins ready from the team password manager (including 2FA).
2. In your Claude (Cowork), open the **Connectors** panel and connect these, signing in with the **shared credentials** each time:
   - **GitHub** — sign in as the shared GitHub account.
   - **Supabase** — authorize the shared Supabase account.
   - **Netlify** — *(optional)* authorize the shared Netlify account. Not needed to deploy; only gives visibility into build logs.
3. Done — you won't repeat this.

---

## Every session: initiate

Start a **new** Cowork session and paste this as your first message:

> I'm working on UCA Central. Get the `eugenemunsami/uca-central-2` repo (branch `main`) into this session, then read `CLAUDE.md` in the repo root **in full** and treat it as the source of truth for the whole system. Summarise back to me: the stack/architecture, the DEMO-vs-LIVE model, the Supabase project and RLS helpers, the latest migration number, and the push-to-deploy flow. Confirm you can see the repo files and reach the Supabase database. Then wait for my task.

Your Claude will pull the repo, read `CLAUDE.md`, and self-check that both connectors resolve to the live system.

---

## You're wired up when Claude's summary correctly says:

- It's a **React + TypeScript + Vite + Supabase** app
- `LIVE` mode is toggled by the Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Live UI refresh is **Supabase Realtime**; migrations run through **0020**
- Pushing to `main` **auto-deploys to Netlify**
- It can **see the repo files** and **reach the database**

If instead it's vague, or says it can't find `CLAUDE.md`, the repo didn't actually come down — re-run the initiation message before doing any real work.

---

## Golden rules (so we don't step on each other)

Because we all share **one `main` branch and one database**:

- **Flag structural work first.** Before a schema change / new migration, a big refactor, or a backend data load, tell the others (team chat) so two of us aren't pushing at once.
- **Pull latest before you start; push small and often.**
- **Migrations are sequential** — the next one is the number after the latest in `/supabase/migrations`. Never reuse a number.
- **Netlify deploys on every push to `main`** — check https://ucacentral.netlify.app after pushing to confirm the build went green.
- Shared account = **no per-person audit trail**, so say who's doing what.

---

## How to push (when your session cloned the repo itself)

A fresh Cowork session usually lands a clean clone at a path like `/home/claude/uca-central-2` and may not have the GitHub push tools surfaced yet. When you have a change to ship, just tell your Claude: **"push the changed files to `main` via the GitHub connector."** It will load the GitHub tools and push; Netlify redeploys automatically. (The `/root/uca` + byte-perfect `push_files` flow described in `CLAUDE.md` §9 is the maintainer convention — same destination, `main`.)
