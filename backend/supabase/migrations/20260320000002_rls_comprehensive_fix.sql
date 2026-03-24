
-- ============================================================
-- COMPREHENSIVE RLS AUDIT & FIX
-- Organised by: users | orders | drivers | tasks | finance | vehicles | system
-- Pattern: SELECT → is_active_user (or self)
--           ALL/INSERT/UPDATE/DELETE → is_active_user + role check
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ① USERS  (profiles · user_roles · user_permissions)
-- ────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "Users can view own profile"          ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"        ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles"          ON public.profiles;
DROP POLICY IF EXISTS "Active users can view profiles"      ON public.profiles;

-- Any active user can read any profile (needed for name display across the app)
CREATE POLICY "Active users can view profiles"
  ON public.profiles FOR SELECT
  USING (is_active_user(auth.uid()) OR auth.uid() = id);

-- Each user can update their own; admins can update any
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert profiles (outside of the new-user trigger)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles"            ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles"         ON public.user_roles;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- user_permissions
DROP POLICY IF EXISTS "Users can view own permissions"      ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage all permissions"   ON public.user_permissions;

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permissions"
  ON public.user_permissions FOR SELECT
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage permissions"
  ON public.user_permissions FOR ALL
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));


-- ────────────────────────────────────────────────────────────
-- ② ORDERS  (daily_orders · app_targets · apps · external_deductions)
-- ────────────────────────────────────────────────────────────

-- daily_orders
DROP POLICY IF EXISTS "Active users can view daily_orders"           ON public.daily_orders;
DROP POLICY IF EXISTS "Operations/admin can manage daily_orders"     ON public.daily_orders;

CREATE POLICY "Active users can view daily_orders"
  ON public.daily_orders FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Ops/HR/admin can manage daily_orders"
  ON public.daily_orders FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- app_targets
DROP POLICY IF EXISTS "Active users can view app_targets"            ON public.app_targets;
DROP POLICY IF EXISTS "Admin/operations can manage app_targets"      ON public.app_targets;

CREATE POLICY "Active users can view app_targets"
  ON public.app_targets FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/ops/finance can manage app_targets"
  ON public.app_targets FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

-- apps (delivery platforms)
DROP POLICY IF EXISTS "Active users can view apps"                   ON public.apps;
DROP POLICY IF EXISTS "Admins can manage apps"                       ON public.apps;

CREATE POLICY "Active users can view apps"
  ON public.apps FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admins can manage apps"
  ON public.apps FOR ALL
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- external_deductions
DROP POLICY IF EXISTS "Finance/admin can view external_deductions"   ON public.external_deductions;
DROP POLICY IF EXISTS "Finance/admin can manage external_deductions" ON public.external_deductions;

CREATE POLICY "Finance/admin can view external_deductions"
  ON public.external_deductions FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "Finance/admin can manage external_deductions"
  ON public.external_deductions FOR ALL
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


-- ────────────────────────────────────────────────────────────
-- ③ DRIVERS  (employees · employee_apps · employee_scheme · employee_tiers · departments · positions)
-- ────────────────────────────────────────────────────────────

-- employees
DROP POLICY IF EXISTS "Active users can view employees"              ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees"                ON public.employees;

CREATE POLICY "Active users can view employees"
  ON public.employees FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage employees"
  ON public.employees FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- employee_apps
DROP POLICY IF EXISTS "Active users can view employee_apps"          ON public.employee_apps;
DROP POLICY IF EXISTS "HR/admin can manage employee_apps"            ON public.employee_apps;

CREATE POLICY "Active users can view employee_apps"
  ON public.employee_apps FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage employee_apps"
  ON public.employee_apps FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- employee_scheme
DROP POLICY IF EXISTS "Active users can view employee_scheme"        ON public.employee_scheme;
DROP POLICY IF EXISTS "HR/admin can manage employee_scheme"          ON public.employee_scheme;

CREATE POLICY "Active users can view employee_scheme"
  ON public.employee_scheme FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage employee_scheme"
  ON public.employee_scheme FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- employee_tiers
DROP POLICY IF EXISTS "Active users can view employee_tiers"         ON public.employee_tiers;
DROP POLICY IF EXISTS "HR/admin can manage employee_tiers"           ON public.employee_tiers;

CREATE POLICY "Active users can view employee_tiers"
  ON public.employee_tiers FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage employee_tiers"
  ON public.employee_tiers FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- departments
DROP POLICY IF EXISTS "Active users can view departments"            ON public.departments;
DROP POLICY IF EXISTS "HR/admin can manage departments"              ON public.departments;

CREATE POLICY "Active users can view departments"
  ON public.departments FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage departments"
  ON public.departments FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- positions
DROP POLICY IF EXISTS "Active users can view positions"              ON public.positions;
DROP POLICY IF EXISTS "HR/admin can manage positions"                ON public.positions;

CREATE POLICY "Active users can view positions"
  ON public.positions FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage positions"
  ON public.positions FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );


-- ────────────────────────────────────────────────────────────
-- ④ TASKS  (attendance · advances · advance_installments · alerts)
-- ────────────────────────────────────────────────────────────

-- attendance
DROP POLICY IF EXISTS "Active users can view attendance"             ON public.attendance;
DROP POLICY IF EXISTS "HR/admin can manage attendance"               ON public.attendance;

CREATE POLICY "Active users can view attendance"
  ON public.attendance FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage attendance"
  ON public.attendance FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- advances
DROP POLICY IF EXISTS "Active users can view advances"               ON public.advances;
DROP POLICY IF EXISTS "Finance/admin can manage advances"            ON public.advances;

CREATE POLICY "Active users can view advances"
  ON public.advances FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Finance/admin can manage advances"
  ON public.advances FOR ALL
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

-- advance_installments
DROP POLICY IF EXISTS "Active users can view advance_installments"   ON public.advance_installments;
DROP POLICY IF EXISTS "Finance/admin can manage advance_installments" ON public.advance_installments;

CREATE POLICY "Active users can view advance_installments"
  ON public.advance_installments FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Finance/admin can manage advance_installments"
  ON public.advance_installments FOR ALL
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

-- alerts
DROP POLICY IF EXISTS "Active users can view alerts"                 ON public.alerts;
DROP POLICY IF EXISTS "HR/admin can manage alerts"                   ON public.alerts;

CREATE POLICY "Active users can view alerts"
  ON public.alerts FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage alerts"
  ON public.alerts FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );


-- ────────────────────────────────────────────────────────────
-- ⑤ FINANCE  (salary_records · pl_records · salary_schemes · salary_scheme_tiers · scheme_month_snapshots)
-- ────────────────────────────────────────────────────────────

-- salary_records
DROP POLICY IF EXISTS "Finance/admin can view salary_records"        ON public.salary_records;
DROP POLICY IF EXISTS "Finance/admin can manage salary_records"      ON public.salary_records;

CREATE POLICY "Finance/admin can view salary_records"
  ON public.salary_records FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "Finance/admin can manage salary_records"
  ON public.salary_records FOR ALL
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

-- pl_records
DROP POLICY IF EXISTS "Finance/admin can view pl_records"            ON public.pl_records;
DROP POLICY IF EXISTS "Finance/admin can manage pl_records"          ON public.pl_records;

CREATE POLICY "Finance/admin can view pl_records"
  ON public.pl_records FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "Finance/admin can manage pl_records"
  ON public.pl_records FOR ALL
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

-- salary_schemes
DROP POLICY IF EXISTS "Active users can view salary_schemes"         ON public.salary_schemes;
DROP POLICY IF EXISTS "Admins/finance can manage salary_schemes"     ON public.salary_schemes;

CREATE POLICY "Active users can view salary_schemes"
  ON public.salary_schemes FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admins/finance can manage salary_schemes"
  ON public.salary_schemes FOR ALL
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

-- salary_scheme_tiers
DROP POLICY IF EXISTS "Active users can view salary_scheme_tiers"    ON public.salary_scheme_tiers;
DROP POLICY IF EXISTS "Admins/finance can manage salary_scheme_tiers" ON public.salary_scheme_tiers;

CREATE POLICY "Active users can view salary_scheme_tiers"
  ON public.salary_scheme_tiers FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admins/finance can manage salary_scheme_tiers"
  ON public.salary_scheme_tiers FOR ALL
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

-- scheme_month_snapshots
DROP POLICY IF EXISTS "Active users can view scheme_month_snapshots"       ON public.scheme_month_snapshots;
DROP POLICY IF EXISTS "Admins/finance can manage scheme_month_snapshots"   ON public.scheme_month_snapshots;

CREATE POLICY "Active users can view scheme_month_snapshots"
  ON public.scheme_month_snapshots FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admins/finance can manage scheme_month_snapshots"
  ON public.scheme_month_snapshots FOR ALL
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


-- ────────────────────────────────────────────────────────────
-- ⑥ VEHICLES  (vehicles · vehicle_assignments · maintenance_logs · vehicle_mileage · vehicle_mileage_daily)
-- ────────────────────────────────────────────────────────────

-- vehicles
DROP POLICY IF EXISTS "Active users can view vehicles"               ON public.vehicles;
DROP POLICY IF EXISTS "Operations/admin can manage vehicles"         ON public.vehicles;

CREATE POLICY "Active users can view vehicles"
  ON public.vehicles FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Operations/admin can manage vehicles"
  ON public.vehicles FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- vehicle_assignments
DROP POLICY IF EXISTS "Active users can view vehicle_assignments"    ON public.vehicle_assignments;
DROP POLICY IF EXISTS "Operations/admin can manage vehicle_assignments" ON public.vehicle_assignments;

CREATE POLICY "Active users can view vehicle_assignments"
  ON public.vehicle_assignments FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Operations/admin can manage vehicle_assignments"
  ON public.vehicle_assignments FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- maintenance_logs
DROP POLICY IF EXISTS "Active users can view maintenance_logs"       ON public.maintenance_logs;
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs;

CREATE POLICY "Active users can view maintenance_logs"
  ON public.maintenance_logs FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Operations/admin can manage maintenance_logs"
  ON public.maintenance_logs FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- vehicle_mileage  (GPS monthly imports)
DROP POLICY IF EXISTS "Active users can view vehicle_mileage"        ON public.vehicle_mileage;
DROP POLICY IF EXISTS "Admin/operations can manage vehicle_mileage"  ON public.vehicle_mileage;

CREATE POLICY "Active users can view vehicle_mileage"
  ON public.vehicle_mileage FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/operations can manage vehicle_mileage"
  ON public.vehicle_mileage FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );

-- vehicle_mileage_daily  (daily manual entries)
DROP POLICY IF EXISTS "Active users can view vehicle_mileage_daily"       ON public.vehicle_mileage_daily;
DROP POLICY IF EXISTS "Admin/operations can manage vehicle_mileage_daily" ON public.vehicle_mileage_daily;

CREATE POLICY "Active users can view vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admin/operations can manage vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role)
    )
  );


-- ────────────────────────────────────────────────────────────
-- ⑦ SYSTEM  (system_settings · trade_registers · audit_log)
-- ────────────────────────────────────────────────────────────

-- system_settings
DROP POLICY IF EXISTS "Anyone can view system_settings"              ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update system_settings"            ON public.system_settings;
DROP POLICY IF EXISTS "Admins can insert system_settings"            ON public.system_settings;

-- system_settings are public (needed on login screen before auth)
CREATE POLICY "Anyone can view system_settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert system_settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update system_settings"
  ON public.system_settings FOR UPDATE
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- trade_registers
DROP POLICY IF EXISTS "Active users can view trade_registers"        ON public.trade_registers;
DROP POLICY IF EXISTS "Admins can manage trade_registers"            ON public.trade_registers;

CREATE POLICY "Active users can view trade_registers"
  ON public.trade_registers FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "Admins can manage trade_registers"
  ON public.trade_registers FOR ALL
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- audit_log
DROP POLICY IF EXISTS "Admins can view audit_log"                    ON public.audit_log;
DROP POLICY IF EXISTS "Active users can insert audit_log"            ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log"           ON public.audit_log;

CREATE POLICY "Admins can view audit_log"
  ON public.audit_log FOR SELECT
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Active users can insert audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (is_active_user(auth.uid()) AND auth.uid() = user_id);
