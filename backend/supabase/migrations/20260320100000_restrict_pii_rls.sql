
-- ============================================================
-- SECURITY FIX: Restrict PII access — remove broad viewer access
-- Problem: "Active users can view X" allowed ANY authenticated user
--          (including 'viewer' role) to read full employee PII:
--          national_id, iban, phone, bank_account_number, dob, etc.
-- Fix: Restrict SELECT on sensitive tables to roles that legitimately
--      need the data. 'viewer' role has no DB-level access to PII.
-- ============================================================

-- ── EMPLOYEES (highest PII risk) ─────────────────────────────
DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;

CREATE POLICY "HR/admin/finance/ops can view employees"
  ON public.employees FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── ATTENDANCE ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view attendance" ON public.attendance;

CREATE POLICY "HR/admin/finance/ops can view attendance"
  ON public.attendance FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── ADVANCES (financial PII) ──────────────────────────────────
DROP POLICY IF EXISTS "Active users can view advances" ON public.advances;

CREATE POLICY "Finance/admin/hr can view advances"
  ON public.advances FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- ── ADVANCE INSTALLMENTS ──────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view advance_installments" ON public.advance_installments;

CREATE POLICY "Finance/admin/hr can view advance_installments"
  ON public.advance_installments FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- ── DAILY ORDERS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view daily_orders" ON public.daily_orders;

CREATE POLICY "Ops/HR/admin/finance can view daily_orders"
  ON public.daily_orders FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── VEHICLES ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view vehicles" ON public.vehicles;

CREATE POLICY "Ops/admin/hr can view vehicles"
  ON public.vehicles FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── VEHICLE ASSIGNMENTS ───────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view vehicle_assignments" ON public.vehicle_assignments;

CREATE POLICY "Ops/admin/hr can view vehicle_assignments"
  ON public.vehicle_assignments FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── MAINTENANCE LOGS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON public.maintenance_logs;

CREATE POLICY "Ops/admin can view maintenance_logs"
  ON public.maintenance_logs FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── VEHICLE MILEAGE ───────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view vehicle_mileage" ON public.vehicle_mileage;

CREATE POLICY "Ops/admin can view vehicle_mileage"
  ON public.vehicle_mileage FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── VEHICLE MILEAGE DAILY ─────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view vehicle_mileage_daily" ON public.vehicle_mileage_daily;

CREATE POLICY "Ops/admin can view vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── EMPLOYEE TIERS ────────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view employee_tiers" ON public.employee_tiers;

CREATE POLICY "HR/admin can view employee_tiers"
  ON public.employee_tiers FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- ── EMPLOYEE APPS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view employee_apps" ON public.employee_apps;

CREATE POLICY "HR/admin/ops can view employee_apps"
  ON public.employee_apps FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- ── EMPLOYEE SCHEME ───────────────────────────────────────────
DROP POLICY IF EXISTS "Active users can view employee_scheme" ON public.employee_scheme;

CREATE POLICY "HR/admin/finance can view employee_scheme"
  ON public.employee_scheme FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

-- ── SALARY SCHEMES (non-sensitive, keep broad) ────────────────
-- Already: "Active users can view salary_schemes" — OK (no PII)

-- ── ALERTS (keep broad — low-sensitivity notifications) ───────
-- Already: "Active users can view alerts" — OK

-- ── DEPARTMENTS & POSITIONS (non-PII, keep broad) ─────────────
-- Already: "Active users can view departments/positions" — OK
