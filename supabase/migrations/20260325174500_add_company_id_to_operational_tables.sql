-- ============================================================================
-- Add canonical company_id to operational tables (multi-tenant SaaS baseline)
-- Tables:
--   profiles (users), attendance, daily_orders, advances,
--   advance_installments, external_deductions, salary_records
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.daily_orders
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.advance_installments
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.external_deductions
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS company_id uuid;

-- Backfill from employees / advances
UPDATE public.attendance a
SET company_id = e.company_id
FROM public.employees e
WHERE a.employee_id = e.id
  AND a.company_id IS NULL;

UPDATE public.daily_orders d
SET company_id = e.company_id
FROM public.employees e
WHERE d.employee_id = e.id
  AND d.company_id IS NULL;

UPDATE public.advances a
SET company_id = e.company_id
FROM public.employees e
WHERE a.employee_id = e.id
  AND a.company_id IS NULL;

UPDATE public.external_deductions x
SET company_id = e.company_id
FROM public.employees e
WHERE x.employee_id = e.id
  AND x.company_id IS NULL;

UPDATE public.salary_records s
SET company_id = e.company_id
FROM public.employees e
WHERE s.employee_id = e.id
  AND s.company_id IS NULL;

UPDATE public.advance_installments ai
SET company_id = a.company_id
FROM public.advances a
WHERE ai.advance_id = a.id
  AND ai.company_id IS NULL;

-- Defaults from JWT claim
ALTER TABLE public.profiles
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.attendance
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.daily_orders
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.advances
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.advance_installments
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.external_deductions
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.salary_records
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();

-- Foreign keys to tenant table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_company_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_company_id_fkey'
      AND conrelid = 'public.attendance'::regclass
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_orders_company_id_fkey'
      AND conrelid = 'public.daily_orders'::regclass
  ) THEN
    ALTER TABLE public.daily_orders
      ADD CONSTRAINT daily_orders_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'advances_company_id_fkey'
      AND conrelid = 'public.advances'::regclass
  ) THEN
    ALTER TABLE public.advances
      ADD CONSTRAINT advances_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'advance_installments_company_id_fkey'
      AND conrelid = 'public.advance_installments'::regclass
  ) THEN
    ALTER TABLE public.advance_installments
      ADD CONSTRAINT advance_installments_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'external_deductions_company_id_fkey'
      AND conrelid = 'public.external_deductions'::regclass
  ) THEN
    ALTER TABLE public.external_deductions
      ADD CONSTRAINT external_deductions_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'salary_records_company_id_fkey'
      AND conrelid = 'public.salary_records'::regclass
  ) THEN
    ALTER TABLE public.salary_records
      ADD CONSTRAINT salary_records_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company_id ON public.attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_orders_company_id ON public.daily_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_advances_company_id ON public.advances(company_id);
CREATE INDEX IF NOT EXISTS idx_advance_installments_company_id ON public.advance_installments(company_id);
CREATE INDEX IF NOT EXISTS idx_external_deductions_company_id ON public.external_deductions(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_company_id ON public.salary_records(company_id);

-- Enforce non-null on operational tables (profiles kept nullable for staged provisioning).
ALTER TABLE public.attendance
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.daily_orders
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.advances
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.advance_installments
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.external_deductions
  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.salary_records
  ALTER COLUMN company_id SET NOT NULL;

-- Keep company_id consistent with owning entities.
CREATE OR REPLACE FUNCTION public.sync_attendance_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'attendance.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_daily_orders_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'daily_orders.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_advances_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'advances.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_external_deductions_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'external_deductions.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_salary_records_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  SELECT company_id INTO employee_company_id FROM public.employees WHERE id = NEW.employee_id;
  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'salary_records.employee_id must belong to a tenant-bound employee';
  END IF;
  NEW.company_id := employee_company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_advance_installments_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  advance_company_id uuid;
BEGIN
  SELECT company_id INTO advance_company_id FROM public.advances WHERE id = NEW.advance_id;
  IF advance_company_id IS NULL THEN
    RAISE EXCEPTION 'advance_installments.advance_id must belong to a tenant-bound advance';
  END IF;
  NEW.company_id := advance_company_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attendance_company_id ON public.attendance;
CREATE TRIGGER trg_sync_attendance_company_id
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_company_id();

DROP TRIGGER IF EXISTS trg_sync_daily_orders_company_id ON public.daily_orders;
CREATE TRIGGER trg_sync_daily_orders_company_id
BEFORE INSERT OR UPDATE ON public.daily_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_daily_orders_company_id();

DROP TRIGGER IF EXISTS trg_sync_advances_company_id ON public.advances;
CREATE TRIGGER trg_sync_advances_company_id
BEFORE INSERT OR UPDATE ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.sync_advances_company_id();

DROP TRIGGER IF EXISTS trg_sync_external_deductions_company_id ON public.external_deductions;
CREATE TRIGGER trg_sync_external_deductions_company_id
BEFORE INSERT OR UPDATE ON public.external_deductions
FOR EACH ROW EXECUTE FUNCTION public.sync_external_deductions_company_id();

DROP TRIGGER IF EXISTS trg_sync_salary_records_company_id ON public.salary_records;
CREATE TRIGGER trg_sync_salary_records_company_id
BEFORE INSERT OR UPDATE ON public.salary_records
FOR EACH ROW EXECUTE FUNCTION public.sync_salary_records_company_id();

DROP TRIGGER IF EXISTS trg_sync_advance_installments_company_id ON public.advance_installments;
CREATE TRIGGER trg_sync_advance_installments_company_id
BEFORE INSERT OR UPDATE ON public.advance_installments
FOR EACH ROW EXECUTE FUNCTION public.sync_advance_installments_company_id();

-- Tighten RLS policies to directly enforce table company_id.
DROP POLICY IF EXISTS "Attendance: select own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: insert own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: update own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: delete own company" ON public.attendance;

CREATE POLICY "Attendance: select own company"
ON public.attendance
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Attendance: insert own company"
ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Attendance: update own company"
ON public.attendance
FOR UPDATE TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Attendance: delete own company"
ON public.attendance
FOR DELETE TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

DROP POLICY IF EXISTS "Daily orders: select own company" ON public.daily_orders;
DROP POLICY IF EXISTS "Daily orders: manage own company" ON public.daily_orders;

CREATE POLICY "Daily orders: select own company"
ON public.daily_orders
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Daily orders: manage own company"
ON public.daily_orders
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
);

DROP POLICY IF EXISTS "Advances: select own company" ON public.advances;
DROP POLICY IF EXISTS "Advances: manage own company" ON public.advances;

CREATE POLICY "Advances: select own company"
ON public.advances
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Advances: manage own company"
ON public.advances
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

DROP POLICY IF EXISTS "Advance installments: select own company" ON public.advance_installments;
DROP POLICY IF EXISTS "Advance installments: manage own company" ON public.advance_installments;

CREATE POLICY "Advance installments: select own company"
ON public.advance_installments
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Advance installments: manage own company"
ON public.advance_installments
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

DROP POLICY IF EXISTS "Salary records: select own company" ON public.salary_records;
DROP POLICY IF EXISTS "Salary records: manage own company" ON public.salary_records;

CREATE POLICY "Salary records: select own company"
ON public.salary_records
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Salary records: manage own company"
ON public.salary_records
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

DROP POLICY IF EXISTS "External deductions: select own company" ON public.external_deductions;
DROP POLICY IF EXISTS "External deductions: manage own company" ON public.external_deductions;

CREATE POLICY "External deductions: select own company"
ON public.external_deductions
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "External deductions: manage own company"
ON public.external_deductions
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);
