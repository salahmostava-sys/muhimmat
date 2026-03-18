
-- Add scheme_type and monthly_amount to salary_schemes
ALTER TABLE public.salary_schemes
  ADD COLUMN IF NOT EXISTS scheme_type TEXT NOT NULL DEFAULT 'order_based',
  ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC DEFAULT NULL;

-- Add constraint for scheme_type
ALTER TABLE public.salary_schemes
  ADD CONSTRAINT salary_schemes_scheme_type_check
    CHECK (scheme_type IN ('order_based', 'fixed_monthly'));

-- Add tier_type and incremental fields to salary_scheme_tiers
ALTER TABLE public.salary_scheme_tiers
  ADD COLUMN IF NOT EXISTS tier_type TEXT NOT NULL DEFAULT 'total_multiplier',
  ADD COLUMN IF NOT EXISTS incremental_threshold INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS incremental_price NUMERIC DEFAULT NULL;

-- Add constraint for tier_type
ALTER TABLE public.salary_scheme_tiers
  ADD CONSTRAINT salary_scheme_tiers_tier_type_check
    CHECK (tier_type IN ('total_multiplier', 'fixed_amount', 'base_plus_incremental'));
