
-- ══════════════════════════════════════════════════════════════
-- 1. platform_accounts
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.platform_accounts (
  id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id                  UUID        NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  employee_id             UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  account_username        TEXT        NOT NULL,
  account_id_on_platform  TEXT,
  iqama_number            TEXT,
  iqama_expiry_date       DATE,
  status                  TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view platform_accounts"
  ON public.platform_accounts FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/operations can manage platform_accounts"
  ON public.platform_accounts FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

CREATE TRIGGER update_platform_accounts_updated_at
  BEFORE UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- 2. account_assignments
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.account_assignments (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  UUID        NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_date    DATE,
  month_year  TEXT        NOT NULL,
  notes       TEXT,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view account_assignments"
  ON public.account_assignments FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/operations can manage account_assignments"
  ON public.account_assignments FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

CREATE INDEX idx_account_assignments_account_id ON public.account_assignments(account_id);
CREATE INDEX idx_account_assignments_employee_id ON public.account_assignments(employee_id);
CREATE INDEX idx_account_assignments_open ON public.account_assignments(end_date) WHERE end_date IS NULL;

-- ══════════════════════════════════════════════════════════════
-- 3. vehicle_mileage_daily
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.vehicle_mileage_daily (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  km_total    NUMERIC     NOT NULL DEFAULT 0,
  fuel_cost   NUMERIC     NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_mileage_daily_employee_date_unique UNIQUE (employee_id, date)
);

ALTER TABLE public.vehicle_mileage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/operations can manage vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

CREATE TRIGGER update_vehicle_mileage_daily_updated_at
  BEFORE UPDATE ON public.vehicle_mileage_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vehicle_mileage_daily_employee_date ON public.vehicle_mileage_daily(employee_id, date);

-- ══════════════════════════════════════════════════════════════
-- 4. locked_months
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.locked_months (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year  TEXT        NOT NULL UNIQUE,
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.locked_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view locked_months"
  ON public.locked_months FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/finance can manage locked_months"
  ON public.locked_months FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));
