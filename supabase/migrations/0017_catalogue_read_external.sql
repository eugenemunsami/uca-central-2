-- 0017_catalogue_read_external.sql
-- The intervention_catalogue holds the service-type definitions (name, category). v_intervention_rag
-- LEFT JOINs it to label each intervention's title/category. Because the view is security_invoker and
-- external users had no read policy on the catalogue, that join returned null for them — so every
-- intervention showed as "Intervention" / "-" in the aggregator's Beneficiaries view. The catalogue is
-- non-sensitive reference data, so allow any signed-in user to read it. Additive, read-only.

drop policy if exists p_cat_read on public.intervention_catalogue;
create policy p_cat_read on public.intervention_catalogue for select
  using (is_internal() or my_role() = 'external');
