-- Pricing rules for payroll calculation (db-driven)

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  min_orders INTEGER NOT NULL DEFAULT 0,
  max_orders INTEGER,
  rule_type TEXT NOT NULL DEFAULT 'per_order'
    CHECK (rule_type IN ('per_order', 'fixed', 'hybrid')),
  rate_per_order NUMERIC(10,2),
  fixed_salary NUMERIC(10,2),
  bonus_target_orders INTEGER,
  bonus_amount NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_rules_order_range_chk CHECK (
    max_orders IS NULL OR max_orders >= min_orders
  ),
  CONSTRAINT pricing_rules_payload_chk CHECK (
    (rule_type = 'per_order' AND rate_per_order IS NOT NULL) OR
    (rule_type = 'fixed' AND fixed_salary IS NOT NULL) OR
    (rule_type = 'hybrid' AND rate_per_order IS NOT NULL AND fixed_salary IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_app_id ON public.pricing_rules(app_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active_priority ON public.pricing_rules(is_active, priority DESC);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view pricing_rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Finance/admin can manage pricing_rules" ON public.pricing_rules;

CREATE POLICY "Active users can view pricing_rules"
  ON public.pricing_rules FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Finance/admin can manage pricing_rules"
  ON public.pricing_rules FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

DROP TRIGGER IF EXISTS update_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
