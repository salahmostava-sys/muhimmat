-- ============================================================================
-- Unify tenant key on employees: company_id (compat with trade_register_id)
-- ----------------------------------------------------------------------------
-- Goal:
-- - Introduce canonical tenant column: employees.company_id
-- - Backfill from employees.trade_register_id
-- - Keep backward compatibility by syncing both columns
-- - Switch RLS policies to company_id
-- ============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.employees
SET company_id = trade_register_id
WHERE company_id IS NULL
  AND trade_register_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_company_id_fkey'
      AND conrelid = 'public.employees'::regclass
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_company_id
  ON public.employees (company_id);

-- Keep old/new tenant columns in sync during transition.
CREATE OR REPLACE FUNCTION public.sync_employees_company_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.trade_register_id IS NOT NULL THEN
    NEW.company_id := NEW.trade_register_id;
  ELSIF NEW.company_id IS NOT NULL AND NEW.trade_register_id IS NULL THEN
    NEW.trade_register_id := NEW.company_id;
  ELSIF NEW.company_id IS NOT NULL
    AND NEW.trade_register_id IS NOT NULL
    AND NEW.company_id <> NEW.trade_register_id THEN
    RAISE EXCEPTION 'company_id and trade_register_id must match';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employees_company_columns ON public.employees;
CREATE TRIGGER trg_sync_employees_company_columns
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employees_company_columns();

-- Default tenant assignment from JWT for new rows.
ALTER TABLE public.employees
  ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();

-- Recreate tenant-aware policies on canonical company_id.
DROP POLICY IF EXISTS "Employees: select own company" ON public.employees;
DROP POLICY IF EXISTS "Employees: insert" ON public.employees;
DROP POLICY IF EXISTS "Employees: update" ON public.employees;
DROP POLICY IF EXISTS "Employees: delete" ON public.employees;

CREATE POLICY "Employees: select own company"
ON public.employees
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
);

CREATE POLICY "Employees: insert"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Employees: update"
ON public.employees
FOR UPDATE
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

CREATE POLICY "Employees: delete"
ON public.employees
FOR DELETE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);
