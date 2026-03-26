-- ============================================================================
-- System-wide company_id rollout (remaining tables)
-- ----------------------------------------------------------------------------
-- Purpose:
--   Ensure all business tables carry company_id for multi-tenant SaaS design.
-- Notes:
--   - Uses IF NOT EXISTS to stay idempotent.
--   - Backfills from best-known relationships.
--   - Keeps nullable on ambiguous/global rows; follow-up smoke tests highlight gaps.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Add company_id to remaining tables
-- --------------------------------------------------------------------------
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.app_targets ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.salary_schemes ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.salary_scheme_tiers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.scheme_month_snapshots ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.employee_scheme ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.employee_apps ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.employee_tiers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.vehicle_assignments ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.vehicle_mileage ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.vehicle_mileage_daily ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.pl_records ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.locked_months ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS company_id uuid;

-- --------------------------------------------------------------------------
-- 2) Backfill by ownership links
-- --------------------------------------------------------------------------
UPDATE public.user_roles ur
SET company_id = p.company_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND ur.company_id IS NULL
  AND p.company_id IS NOT NULL;

UPDATE public.user_permissions up
SET company_id = p.company_id
FROM public.profiles p
WHERE up.user_id = p.id
  AND up.company_id IS NULL
  AND p.company_id IS NOT NULL;

UPDATE public.employee_scheme es
SET company_id = e.company_id
FROM public.employees e
WHERE es.employee_id = e.id
  AND es.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.employee_apps ea
SET company_id = e.company_id
FROM public.employees e
WHERE ea.employee_id = e.id
  AND ea.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.employee_tiers et
SET company_id = e.company_id
FROM public.employees e
WHERE et.employee_id = e.id
  AND et.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.vehicle_assignments va
SET company_id = e.company_id
FROM public.employees e
WHERE va.employee_id = e.id
  AND va.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.vehicle_mileage vm
SET company_id = e.company_id
FROM public.employees e
WHERE vm.employee_id = e.id
  AND vm.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.vehicle_mileage_daily vmd
SET company_id = e.company_id
FROM public.employees e
WHERE vmd.employee_id = e.id
  AND vmd.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.vehicles v
SET company_id = va.company_id
FROM public.vehicle_assignments va
WHERE va.vehicle_id = v.id
  AND v.company_id IS NULL
  AND va.company_id IS NOT NULL;

UPDATE public.maintenance_logs ml
SET company_id = v.company_id
FROM public.vehicles v
WHERE ml.vehicle_id = v.id
  AND ml.company_id IS NULL
  AND v.company_id IS NOT NULL;

UPDATE public.departments d
SET company_id = e.company_id
FROM public.employees e
WHERE e.department_id = d.id
  AND d.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.positions p
SET company_id = e.company_id
FROM public.employees e
WHERE e.position_id = p.id
  AND p.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.salary_schemes ss
SET company_id = es.company_id
FROM public.employee_scheme es
WHERE es.scheme_id = ss.id
  AND ss.company_id IS NULL
  AND es.company_id IS NOT NULL;

UPDATE public.salary_scheme_tiers sst
SET company_id = ss.company_id
FROM public.salary_schemes ss
WHERE sst.scheme_id = ss.id
  AND sst.company_id IS NULL
  AND ss.company_id IS NOT NULL;

UPDATE public.scheme_month_snapshots sms
SET company_id = ss.company_id
FROM public.salary_schemes ss
WHERE sms.scheme_id = ss.id
  AND sms.company_id IS NULL
  AND ss.company_id IS NOT NULL;

UPDATE public.app_targets at
SET company_id = d.company_id
FROM (
  SELECT dorders.app_id, e.company_id
  FROM public.daily_orders dorders
  JOIN public.employees e ON e.id = dorders.employee_id
  GROUP BY dorders.app_id, e.company_id
) AS d
WHERE at.app_id = d.app_id
  AND at.company_id IS NULL
  AND d.company_id IS NOT NULL;

UPDATE public.apps a
SET company_id = pa.company_id
FROM public.platform_accounts pa
WHERE pa.app_id = a.id
  AND a.company_id IS NULL
  AND pa.company_id IS NOT NULL;

UPDATE public.pl_records pl
SET company_id = s.company_id
FROM public.salary_records s
WHERE s.month_year = pl.month_year
  AND pl.company_id IS NULL
  AND s.company_id IS NOT NULL;

UPDATE public.alerts al
SET company_id = e.company_id
FROM public.employees e
WHERE al.entity_type = 'employee'
  AND al.entity_id = e.id
  AND al.company_id IS NULL
  AND e.company_id IS NOT NULL;

UPDATE public.alerts al
SET company_id = p.company_id
FROM public.profiles p
WHERE al.company_id IS NULL
  AND al.resolved_by = p.id
  AND p.company_id IS NOT NULL;

UPDATE public.locked_months lm
SET company_id = p.company_id
FROM public.profiles p
WHERE lm.locked_by = p.id
  AND lm.company_id IS NULL
  AND p.company_id IS NOT NULL;

UPDATE public.audit_log al
SET company_id = p.company_id
FROM public.profiles p
WHERE al.user_id = p.id
  AND al.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 3) Defaults from JWT + FK + indexes
-- --------------------------------------------------------------------------
ALTER TABLE public.user_roles ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.user_permissions ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.departments ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.positions ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.apps ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.app_targets ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.salary_schemes ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.salary_scheme_tiers ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.scheme_month_snapshots ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.employee_scheme ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.employee_apps ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.employee_tiers ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.vehicles ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.vehicle_assignments ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.maintenance_logs ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.vehicle_mileage ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.vehicle_mileage_daily ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.pl_records ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.alerts ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.locked_months ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.system_settings ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();
ALTER TABLE public.audit_log ALTER COLUMN company_id SET DEFAULT public.jwt_company_id();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_company_id_fkey') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_permissions_company_id_fkey') THEN
    ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_company_id_fkey') THEN
    ALTER TABLE public.departments ADD CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positions_company_id_fkey') THEN
    ALTER TABLE public.positions ADD CONSTRAINT positions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apps_company_id_fkey') THEN
    ALTER TABLE public.apps ADD CONSTRAINT apps_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_targets_company_id_fkey') THEN
    ALTER TABLE public.app_targets ADD CONSTRAINT app_targets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_schemes_company_id_fkey') THEN
    ALTER TABLE public.salary_schemes ADD CONSTRAINT salary_schemes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salary_scheme_tiers_company_id_fkey') THEN
    ALTER TABLE public.salary_scheme_tiers ADD CONSTRAINT salary_scheme_tiers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheme_month_snapshots_company_id_fkey') THEN
    ALTER TABLE public.scheme_month_snapshots ADD CONSTRAINT scheme_month_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_scheme_company_id_fkey') THEN
    ALTER TABLE public.employee_scheme ADD CONSTRAINT employee_scheme_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_apps_company_id_fkey') THEN
    ALTER TABLE public.employee_apps ADD CONSTRAINT employee_apps_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_tiers_company_id_fkey') THEN
    ALTER TABLE public.employee_tiers ADD CONSTRAINT employee_tiers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_company_id_fkey') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_assignments_company_id_fkey') THEN
    ALTER TABLE public.vehicle_assignments ADD CONSTRAINT vehicle_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_logs_company_id_fkey') THEN
    ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_mileage_company_id_fkey') THEN
    ALTER TABLE public.vehicle_mileage ADD CONSTRAINT vehicle_mileage_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_mileage_daily_company_id_fkey') THEN
    ALTER TABLE public.vehicle_mileage_daily ADD CONSTRAINT vehicle_mileage_daily_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pl_records_company_id_fkey') THEN
    ALTER TABLE public.pl_records ADD CONSTRAINT pl_records_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_company_id_fkey') THEN
    ALTER TABLE public.alerts ADD CONSTRAINT alerts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locked_months_company_id_fkey') THEN
    ALTER TABLE public.locked_months ADD CONSTRAINT locked_months_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_company_id_fkey') THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_company_id_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.trade_registers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_company_id ON public.user_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON public.departments(company_id);
CREATE INDEX IF NOT EXISTS idx_positions_company_id ON public.positions(company_id);
CREATE INDEX IF NOT EXISTS idx_apps_company_id ON public.apps(company_id);
CREATE INDEX IF NOT EXISTS idx_app_targets_company_id ON public.app_targets(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_schemes_company_id ON public.salary_schemes(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_scheme_tiers_company_id ON public.salary_scheme_tiers(company_id);
CREATE INDEX IF NOT EXISTS idx_scheme_month_snapshots_company_id ON public.scheme_month_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_scheme_company_id ON public.employee_scheme(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_apps_company_id ON public.employee_apps(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_tiers_company_id ON public.employee_tiers(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_company_id ON public.vehicle_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_company_id ON public.maintenance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_company_id ON public.vehicle_mileage(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_daily_company_id ON public.vehicle_mileage_daily(company_id);
CREATE INDEX IF NOT EXISTS idx_pl_records_company_id ON public.pl_records(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_company_id ON public.alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_locked_months_company_id ON public.locked_months(company_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_company_id ON public.system_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.audit_log(company_id);
