-- Phase 1 ERD foundation (non-breaking):
-- - explicit roles catalog + employee_roles (many-to-many)
-- - normalize orders semantics on existing daily_orders table
-- - add stable salary tiers structure
-- - harden attendance and salary records constraints/indexes

-- 1) Roles catalog
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE CHECK (title IN ('admin', 'hr', 'accountant', 'viewer', 'operations')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.roles (title, permissions)
VALUES
  ('admin', '{"*": {"view": true, "edit": true, "delete": true}}'::jsonb),
  ('hr', '{"employees": {"view": true, "edit": true}, "attendance": {"view": true, "edit": true}}'::jsonb),
  ('accountant', '{"salary": {"view": true, "edit": true}, "orders": {"view": true}}'::jsonb),
  ('viewer', '{"*": {"view": true, "edit": false, "delete": false}}'::jsonb),
  ('operations', '{"orders": {"view": true, "edit": true}, "platform_accounts": {"view": true, "edit": true}}'::jsonb)
ON CONFLICT (title) DO NOTHING;

DROP TRIGGER IF EXISTS update_roles_updated_at ON public.roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Many-to-many employee roles
CREATE TABLE IF NOT EXISTS public.employee_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (employee_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON public.employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON public.employee_roles(role_id);

-- Optional single-role compatibility field on employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_role_id ON public.employees(role_id);

-- 3) Orders table semantics on existing table
ALTER TABLE public.daily_orders
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('draft', 'confirmed', 'cancelled'));

ALTER TABLE public.daily_orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_daily_orders_employee_date ON public.daily_orders(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_orders_app_date ON public.daily_orders(app_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_orders_status ON public.daily_orders(status);

COMMENT ON TABLE public.daily_orders IS 'Orders fact table (platform/app level). platform_id is represented by app_id.';

-- 4) Attendance hardening
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_check_out_after_check_in_chk'
      AND conrelid = 'public.attendance'::regclass
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_check_out_after_check_in_chk
      CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_employee_date
  ON public.attendance(employee_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_status_date
  ON public.attendance(employee_id, status, date);

-- 5) Stable salary tiers structure (db-driven)
CREATE TABLE IF NOT EXISTS public.salary_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  min_orders INTEGER NOT NULL DEFAULT 0,
  max_orders INTEGER,
  tier_type TEXT NOT NULL DEFAULT 'per_order'
    CHECK (tier_type IN ('per_order', 'fixed', 'hybrid')),
  rate_per_order NUMERIC(10,2),
  fixed_amount NUMERIC(10,2),
  extra_rate NUMERIC(10,2),
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT salary_tiers_range_chk CHECK (max_orders IS NULL OR max_orders >= min_orders),
  CONSTRAINT salary_tiers_payload_chk CHECK (
    (tier_type = 'per_order' AND rate_per_order IS NOT NULL) OR
    (tier_type = 'fixed' AND fixed_amount IS NOT NULL) OR
    (tier_type = 'hybrid' AND fixed_amount IS NOT NULL AND extra_rate IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_salary_tiers_app_priority
  ON public.salary_tiers(app_id, is_active, priority DESC);

DROP TRIGGER IF EXISTS update_salary_tiers_updated_at ON public.salary_tiers;
CREATE TRIGGER update_salary_tiers_updated_at
  BEFORE UPDATE ON public.salary_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Salary record lifecycle metadata
ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS calc_status TEXT NOT NULL DEFAULT 'calculated'
  CHECK (calc_status IN ('calculated', 'approved', 'paid', 'cancelled'));

ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS calc_source TEXT NOT NULL DEFAULT 'engine_v1';

CREATE INDEX IF NOT EXISTS idx_salary_records_employee_month
  ON public.salary_records(employee_id, month_year);

CREATE INDEX IF NOT EXISTS idx_salary_records_calc_status
  ON public.salary_records(calc_status);

-- 7) RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.roles;
CREATE POLICY "Active users can view roles"
  ON public.roles FOR SELECT
  USING (is_active_user(auth.uid()));
CREATE POLICY "Admin can manage roles"
  ON public.roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Active users can view employee_roles" ON public.employee_roles;
DROP POLICY IF EXISTS "Admin or HR can manage employee_roles" ON public.employee_roles;
CREATE POLICY "Active users can view employee_roles"
  ON public.employee_roles FOR SELECT
  USING (is_active_user(auth.uid()));
CREATE POLICY "Admin or HR can manage employee_roles"
  ON public.employee_roles FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role)
  );

DROP POLICY IF EXISTS "Active users can view salary_tiers" ON public.salary_tiers;
DROP POLICY IF EXISTS "Finance admin can manage salary_tiers" ON public.salary_tiers;
CREATE POLICY "Active users can view salary_tiers"
  ON public.salary_tiers FOR SELECT
  USING (is_active_user(auth.uid()));
CREATE POLICY "Finance admin can manage salary_tiers"
  ON public.salary_tiers FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role)
  );
