-- 0009_welcome_party_teams_url.sql
-- Welcome parties can carry an MS Teams registration link, captured when the party is created
-- (or edited) and shown on the party card so the sponsor can send it to beneficiaries.
-- Additive and inert; ManCo edit/delete already permitted by the existing p_wp_write (is_manco()) policy.

alter table welcome_parties add column if not exists teams_url text;
