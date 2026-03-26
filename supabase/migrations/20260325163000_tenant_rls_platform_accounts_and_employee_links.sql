-- ============================================================================
-- Tenant hardening for employee-linked tables
-- Tables:
--   - employee_apps
--   - employee_scheme
--   - platform_accounts
--   - account_assignments
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Canonical tenant key on platform_accounts/account_assignments
-- --------------------------------------------------------------------------
ALTER TABLE public.platform_accounts
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.account_assignments
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.platform_accounts pa
SET company_id = e.company_id
FROM public.employees e
WHERE pa.employee_id = e.id
  AND pa.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.account_assignments aa
SET company_id = e.company_id
FROM public.employees e
WHERE aa.employee_id = e.id
  AND aa.company_id IS NULL
  AND e.company_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_accounts_company_id_fkey'
      AND conrelid = 'public.platform_accounts'::regclass
  ) THEN
    ALTER TABLE public.platform_accounts
      ADD CONSTRAINT platform_accounts_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_assignments_company_id_fkey'
      AND conrelid = 'public.account_assignments'::regclass
  ) THEN
    ALTER TABLE public.account_assignments
      ADD CONSTRAINT account_assignments_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_accounts_company_id
  ON public.platform_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_account_assignments_company_id
  ON public.account_assignments (company_id);

ALTER TABLE public.platform_accounts
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.account_assignments
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();

-- --------------------------------------------------------------------------
-- 2) Tenant helper predicates (SECURITY DEFINER)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.employee_in_my_company(_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = _employee_id
      AND e.company_id = public.jwt_company_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_account_in_my_company(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_accounts pa
    WHERE pa.id = _account_id
      AND pa.company_id = public.jwt_company_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.assignment_in_my_company(_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_assignments aa
    WHERE aa.id = _assignment_id
      AND aa.company_id = public.jwt_company_id()
  );
$$;

-- Keep tenant columns aligned on insert/update.
CREATE OR REPLACE FUNCTION public.sync_platform_accounts_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
BEGIN
  IF NEW.employee_id IS NOT NULL THEN
    SELECT e.company_id INTO employee_company_id
    FROM public.employees e
    WHERE e.id = NEW.employee_id;

    IF employee_company_id IS NULL THEN
      RAISE EXCEPTION 'employee_id must belong to a company';
    END IF;

    IF NEW.company_id IS NULL THEN
      NEW.company_id := employee_company_id;
    ELSIF NEW.company_id <> employee_company_id THEN
      RAISE EXCEPTION 'platform_accounts.company_id must match employee company';
    END IF;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.jwt_company_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_platform_accounts_company_id ON public.platform_accounts;
CREATE TRIGGER trg_sync_platform_accounts_company_id
BEFORE INSERT OR UPDATE ON public.platform_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_platform_accounts_company_id();

CREATE OR REPLACE FUNCTION public.sync_account_assignments_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  employee_company_id uuid;
  account_company_id uuid;
BEGIN
  SELECT e.company_id INTO employee_company_id
  FROM public.employees e
  WHERE e.id = NEW.employee_id;

  IF employee_company_id IS NULL THEN
    RAISE EXCEPTION 'employee_id must belong to a company';
  END IF;

  SELECT pa.company_id INTO account_company_id
  FROM public.platform_accounts pa
  WHERE pa.id = NEW.account_id;

  IF account_company_id IS NULL THEN
    RAISE EXCEPTION 'account_id must belong to a company';
  END IF;

  IF employee_company_id <> account_company_id THEN
    RAISE EXCEPTION 'employee and account must belong to the same company';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := employee_company_id;
  ELSIF NEW.company_id <> employee_company_id THEN
    RAISE EXCEPTION 'account_assignments.company_id mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_account_assignments_company_id ON public.account_assignments;
CREATE TRIGGER trg_sync_account_assignments_company_id
BEFORE INSERT OR UPDATE ON public.account_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_assignments_company_id();

-- --------------------------------------------------------------------------
-- 3) RLS policy hardening per table
-- --------------------------------------------------------------------------
ALTER TABLE public.employee_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_scheme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;

-- employee_apps
DROP POLICY IF EXISTS "Authenticated can view employee_apps" ON public.employee_apps;
DROP POLICY IF EXISTS "Active users can view employee_apps" ON public.employee_apps;
DROP POLICY IF EXISTS "HR/admin/ops can view employee_apps" ON public.employee_apps;
DROP POLICY IF EXISTS "HR/admin can manage employee_apps" ON public.employee_apps;

CREATE POLICY "Employee apps: select own company"
ON public.employee_apps
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
);

CREATE POLICY "Employee apps: manage own company"
ON public.employee_apps
FOR ALL
TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- employee_scheme
DROP POLICY IF EXISTS "Authenticated can view employee_scheme" ON public.employee_scheme;
DROP POLICY IF EXISTS "Active users can view employee_scheme" ON public.employee_scheme;
DROP POLICY IF EXISTS "HR/admin/finance can view employee_scheme" ON public.employee_scheme;
DROP POLICY IF EXISTS "HR/admin can manage employee_scheme" ON public.employee_scheme;

CREATE POLICY "Employee scheme: select own company"
ON public.employee_scheme
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Employee scheme: manage own company"
ON public.employee_scheme
FOR ALL
TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- platform_accounts
DROP POLICY IF EXISTS "platform_accounts_select" ON public.platform_accounts;
DROP POLICY IF EXISTS "platform_accounts_manage" ON public.platform_accounts;
DROP POLICY IF EXISTS "Active users can view platform_accounts" ON public.platform_accounts;
DROP POLICY IF EXISTS "Admin/operations can manage platform_accounts" ON public.platform_accounts;

CREATE POLICY "Platform accounts: select own company"
ON public.platform_accounts
FOR SELECT
TO authenticated
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

CREATE POLICY "Platform accounts: manage own company"
ON public.platform_accounts
FOR ALL
TO authenticated
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

-- account_assignments
DROP POLICY IF EXISTS "account_assignments_select" ON public.account_assignments;
DROP POLICY IF EXISTS "account_assignments_insert_update" ON public.account_assignments;
DROP POLICY IF EXISTS "account_assignments_update_only" ON public.account_assignments;
DROP POLICY IF EXISTS "Active users can view account_assignments" ON public.account_assignments;
DROP POLICY IF EXISTS "Admin/operations can manage account_assignments" ON public.account_assignments;

CREATE POLICY "Account assignments: select own company"
ON public.account_assignments
FOR SELECT
TO authenticated
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

CREATE POLICY "Account assignments: insert own company"
ON public.account_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND public.employee_in_my_company(employee_id)
  AND public.platform_account_in_my_company(account_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Account assignments: update own company"
ON public.account_assignments
FOR UPDATE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND public.assignment_in_my_company(id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND public.employee_in_my_company(employee_id)
  AND public.platform_account_in_my_company(account_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- Keep NO DELETE policy intentionally (close assignment with end_date).
