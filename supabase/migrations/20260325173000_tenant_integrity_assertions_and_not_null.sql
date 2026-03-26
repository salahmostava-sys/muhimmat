-- ============================================================================
-- Tenant integrity assertions + hard constraints
-- ----------------------------------------------------------------------------
-- Goal:
-- - Fail fast if historical data violates tenant boundaries.
-- - Enforce non-null company_id on core tenant tables.
-- ============================================================================

DO $$
DECLARE
  v_count bigint;
BEGIN
  -- employees must always be attached to a tenant.
  SELECT COUNT(*) INTO v_count
  FROM public.employees
  WHERE company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % employees rows with NULL company_id', v_count;
  END IF;

  -- platform_accounts must always be attached to a tenant.
  SELECT COUNT(*) INTO v_count
  FROM public.platform_accounts
  WHERE company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % platform_accounts rows with NULL company_id', v_count;
  END IF;

  -- account_assignments must always be attached to a tenant.
  SELECT COUNT(*) INTO v_count
  FROM public.account_assignments
  WHERE company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % account_assignments rows with NULL company_id', v_count;
  END IF;

  -- platform_accounts employee linkage must stay inside the same company.
  SELECT COUNT(*) INTO v_count
  FROM public.platform_accounts pa
  JOIN public.employees e ON e.id = pa.employee_id
  WHERE pa.employee_id IS NOT NULL
    AND pa.company_id <> e.company_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % platform_accounts rows mismatch employee company', v_count;
  END IF;

  -- account_assignments must match employee and account company.
  SELECT COUNT(*) INTO v_count
  FROM public.account_assignments aa
  JOIN public.employees e ON e.id = aa.employee_id
  JOIN public.platform_accounts pa ON pa.id = aa.account_id
  WHERE aa.company_id <> e.company_id
     OR aa.company_id <> pa.company_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % account_assignments rows mismatch employee/account company', v_count;
  END IF;

  -- child links through employee_id must always resolve to tenant-bound employees.
  SELECT COUNT(*) INTO v_count
  FROM public.attendance a
  LEFT JOIN public.employees e ON e.id = a.employee_id
  WHERE e.id IS NULL OR e.company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % attendance rows not linked to tenant-bound employees', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.daily_orders d
  LEFT JOIN public.employees e ON e.id = d.employee_id
  WHERE e.id IS NULL OR e.company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % daily_orders rows not linked to tenant-bound employees', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.advances a
  LEFT JOIN public.employees e ON e.id = a.employee_id
  WHERE e.id IS NULL OR e.company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % advances rows not linked to tenant-bound employees', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.salary_records s
  LEFT JOIN public.employees e ON e.id = s.employee_id
  WHERE e.id IS NULL OR e.company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % salary_records rows not linked to tenant-bound employees', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.external_deductions x
  LEFT JOIN public.employees e ON e.id = x.employee_id
  WHERE e.id IS NULL OR e.company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % external_deductions rows not linked to tenant-bound employees', v_count;
  END IF;

  -- advance_installments must resolve to advances -> employees -> tenant.
  SELECT COUNT(*) INTO v_count
  FROM public.advance_installments ai
  LEFT JOIN public.advances a ON a.id = ai.advance_id
  LEFT JOIN public.employees e ON e.id = a.employee_id
  WHERE a.id IS NULL OR e.id IS NULL OR e.company_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Tenant integrity failed: % advance_installments rows not linked to tenant-bound employees', v_count;
  END IF;
END $$;

-- Hard constraints after successful assertions.
ALTER TABLE public.employees
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.platform_accounts
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.account_assignments
  ALTER COLUMN company_id SET NOT NULL;
