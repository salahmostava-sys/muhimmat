
ALTER TABLE public.employee_tiers
  ADD COLUMN IF NOT EXISTS sim_number text,
  ADD COLUMN IF NOT EXISTS app_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
