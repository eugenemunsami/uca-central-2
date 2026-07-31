-- 0011_onboarding_esc_return.sql
-- Onboarding tickets can now be escalated straight to the Aggregator/Sponsor from ANY active stage
-- (no ManCo approval step). This column remembers the stage the ticket was on so that, when the
-- Aggregator/Sponsor resolves the escalation, it returns directly to where it left off.
-- Additive & inert.

alter table onboardings add column if not exists esc_return_status text;
