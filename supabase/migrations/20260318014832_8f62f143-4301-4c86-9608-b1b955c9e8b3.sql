
-- Function to insert into audit_log
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, table_name, action, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Employees
DROP TRIGGER IF EXISTS audit_employees ON public.employees;
CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Advances
DROP TRIGGER IF EXISTS audit_advances ON public.advances;
CREATE TRIGGER audit_advances
AFTER INSERT OR UPDATE OR DELETE ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Salary records
DROP TRIGGER IF EXISTS audit_salary_records ON public.salary_records;
CREATE TRIGGER audit_salary_records
AFTER INSERT OR UPDATE OR DELETE ON public.salary_records
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Attendance
DROP TRIGGER IF EXISTS audit_attendance ON public.attendance;
CREATE TRIGGER audit_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Daily orders
DROP TRIGGER IF EXISTS audit_daily_orders ON public.daily_orders;
CREATE TRIGGER audit_daily_orders
AFTER INSERT OR UPDATE OR DELETE ON public.daily_orders
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Vehicles
DROP TRIGGER IF EXISTS audit_vehicles ON public.vehicles;
CREATE TRIGGER audit_vehicles
AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Vehicle assignments
DROP TRIGGER IF EXISTS audit_vehicle_assignments ON public.vehicle_assignments;
CREATE TRIGGER audit_vehicle_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Apps
DROP TRIGGER IF EXISTS audit_apps ON public.apps;
CREATE TRIGGER audit_apps
AFTER INSERT OR UPDATE OR DELETE ON public.apps
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- User roles
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- System settings
DROP TRIGGER IF EXISTS audit_system_settings ON public.system_settings;
CREATE TRIGGER audit_system_settings
AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
