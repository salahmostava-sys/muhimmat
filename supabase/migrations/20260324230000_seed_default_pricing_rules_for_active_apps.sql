-- Seed a default pricing rule for every active app that has no rules yet.
-- Idempotent: only inserts for apps without any existing pricing_rules.

INSERT INTO public.pricing_rules (
  app_id,
  min_orders,
  max_orders,
  rule_type,
  rate_per_order,
  fixed_salary,
  bonus_target_orders,
  bonus_amount,
  is_active,
  priority
)
SELECT
  a.id AS app_id,
  0 AS min_orders,
  NULL AS max_orders,
  'per_order'::text AS rule_type,
  0::numeric AS rate_per_order,
  NULL::numeric AS fixed_salary,
  NULL::integer AS bonus_target_orders,
  NULL::numeric AS bonus_amount,
  true AS is_active,
  -1000 AS priority
FROM public.apps a
WHERE a.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.pricing_rules pr
    WHERE pr.app_id = a.id
  );
