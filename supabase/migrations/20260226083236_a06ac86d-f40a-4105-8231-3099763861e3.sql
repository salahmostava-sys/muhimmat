
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'finance', 'operations', 'viewer');
CREATE TYPE public.salary_type AS ENUM ('shift', 'orders');
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'ended');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'leave', 'sick', 'late');
CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'car');
CREATE TYPE public.vehicle_status AS ENUM ('active', 'maintenance', 'inactive');
CREATE TYPE public.advance_status AS ENUM ('active', 'completed', 'paused');
CREATE TYPE public.installment_status AS ENUM ('pending', 'deducted', 'deferred');
CREATE TYPE public.deduction_type AS ENUM ('fine', 'return', 'delay', 'accident', 'other');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.maintenance_type AS ENUM ('routine', 'breakdown', 'accident');
CREATE TYPE public.scheme_status AS ENUM ('active', 'archived');

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  name_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER ROLES (separate table — no privilege escalation)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- ============================================================
-- USER PERMISSIONS (per-page overrides)
-- ============================================================
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, permission_key)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRADE REGISTERS
-- ============================================================
CREATE TABLE public.trade_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  cr_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_registers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- APPS (delivery platforms)
-- ============================================================
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SALARY SCHEMES
-- ============================================================
CREATE TABLE public.salary_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  target_orders INT,
  target_bonus NUMERIC(10,2),
  status public.scheme_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_schemes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.salary_scheme_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.salary_schemes(id) ON DELETE CASCADE,
  tier_order INT NOT NULL DEFAULT 1,
  from_orders INT NOT NULL DEFAULT 0,
  to_orders INT,
  price_per_order NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_scheme_tiers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  phone TEXT,
  national_id TEXT UNIQUE,
  iban TEXT,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  dob DATE,
  residency_expiry DATE,
  license_has BOOLEAN NOT NULL DEFAULT false,
  license_expiry DATE,
  email TEXT,
  salary_type public.salary_type NOT NULL DEFAULT 'orders',
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  allowances JSONB DEFAULT '{}',
  trade_register_id UUID REFERENCES public.trade_registers(id),
  status public.employee_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Employee scheme assignment
CREATE TABLE public.employee_scheme (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES public.salary_schemes(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.employee_scheme ENABLE ROW LEVEL SECURITY;

-- Employee apps
CREATE TABLE public.employee_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id),
  username TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  joined_date DATE,
  UNIQUE(employee_id, app_id)
);
ALTER TABLE public.employee_apps ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT UNIQUE NOT NULL,
  type public.vehicle_type NOT NULL DEFAULT 'motorcycle',
  brand TEXT,
  model TEXT,
  year INT,
  insurance_expiry DATE,
  registration_expiry DATE,
  status public.vehicle_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type public.maintenance_type NOT NULL DEFAULT 'routine',
  description TEXT,
  cost NUMERIC(10,2) DEFAULT 0,
  paid_by TEXT DEFAULT 'company',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'completed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  check_in TIME,
  check_out TIME,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DAILY ORDERS
-- ============================================================
CREATE TABLE public.daily_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  app_id UUID NOT NULL REFERENCES public.apps(id),
  orders_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date, app_id)
);
ALTER TABLE public.daily_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ADVANCES
-- ============================================================
CREATE TABLE public.advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_installments INT NOT NULL DEFAULT 1,
  monthly_amount NUMERIC(10,2) NOT NULL,
  first_deduction_month TEXT NOT NULL,
  note TEXT,
  status public.advance_status NOT NULL DEFAULT 'active',
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.advance_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id UUID NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status public.installment_status NOT NULL DEFAULT 'pending',
  deducted_at TIMESTAMPTZ
);
ALTER TABLE public.advance_installments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EXTERNAL DEDUCTIONS
-- ============================================================
CREATE TABLE public.external_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  source_app_id UUID REFERENCES public.apps(id),
  type public.deduction_type NOT NULL DEFAULT 'fine',
  amount NUMERIC(10,2) NOT NULL,
  incident_date DATE,
  apply_month TEXT NOT NULL,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  note TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.external_deductions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SALARY RECORDS
-- ============================================================
CREATE TABLE public.salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(10,2) NOT NULL DEFAULT 0,
  attendance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  advance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  external_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  manual_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  manual_deduction_note TEXT,
  net_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month_year)
);
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- P&L RECORDS
-- ============================================================
CREATE TABLE public.pl_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year TEXT NOT NULL UNIQUE,
  revenue_riders NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenue_other NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_salaries NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_vehicles NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_deductions NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_other NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pl_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  due_date DATE,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TIMESTAMPS TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_advances_updated_at BEFORE UPDATE ON public.advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_salary_records_updated_at BEFORE UPDATE ON public.salary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_salary_schemes_updated_at BEFORE UPDATE ON public.salary_schemes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_daily_orders_updated_at BEFORE UPDATE ON public.daily_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES — Authenticated users with role checks
-- ============================================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- USER PERMISSIONS
CREATE POLICY "Users can view own permissions" ON public.user_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all permissions" ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- TRADE REGISTERS
CREATE POLICY "Authenticated can view trade_registers" ON public.trade_registers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage trade_registers" ON public.trade_registers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- APPS
CREATE POLICY "Authenticated can view apps" ON public.apps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage apps" ON public.apps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SALARY SCHEMES
CREATE POLICY "Authenticated can view schemes" ON public.salary_schemes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/finance can manage schemes" ON public.salary_schemes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Authenticated can view scheme tiers" ON public.salary_scheme_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/finance can manage scheme tiers" ON public.salary_scheme_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- EMPLOYEES
CREATE POLICY "Authenticated can view employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR/admin can manage employees" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Authenticated can view employee_scheme" ON public.employee_scheme FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR/admin can manage employee_scheme" ON public.employee_scheme FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Authenticated can view employee_apps" ON public.employee_apps FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR/admin can manage employee_apps" ON public.employee_apps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- VEHICLES
CREATE POLICY "Authenticated can view vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operations/admin can manage vehicles" ON public.vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Authenticated can view vehicle_assignments" ON public.vehicle_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operations/admin can manage vehicle_assignments" ON public.vehicle_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Authenticated can view maintenance_logs" ON public.maintenance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operations/admin can manage maintenance_logs" ON public.maintenance_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

-- ATTENDANCE
CREATE POLICY "Authenticated can view attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR/admin can manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- DAILY ORDERS
CREATE POLICY "Authenticated can view daily_orders" ON public.daily_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operations/admin can manage daily_orders" ON public.daily_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'hr'));

-- ADVANCES
CREATE POLICY "Authenticated can view advances" ON public.advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance/admin can manage advances" ON public.advances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Authenticated can view advance_installments" ON public.advance_installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance/admin can manage advance_installments" ON public.advance_installments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- EXTERNAL DEDUCTIONS
CREATE POLICY "Finance/admin can view external_deductions" ON public.external_deductions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));
CREATE POLICY "Finance/admin can manage external_deductions" ON public.external_deductions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- SALARY RECORDS
CREATE POLICY "Finance/admin can view salary_records" ON public.salary_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));
CREATE POLICY "Finance/admin can manage salary_records" ON public.salary_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- P&L RECORDS
CREATE POLICY "Finance/admin can view pl_records" ON public.pl_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));
CREATE POLICY "Finance/admin can manage pl_records" ON public.pl_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- ALERTS
CREATE POLICY "Authenticated can view alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage alerts" ON public.alerts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- AUDIT LOG
CREATE POLICY "Admins can view audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SEED APPS
-- ============================================================
INSERT INTO public.apps (name, name_en, is_active) VALUES
  ('هنقر', 'Hunger Station', true),
  ('كيتا', 'Keeta', true),
  ('طبو', 'Tobo', true),
  ('جاهز', 'Jahiz', true),
  ('نينجا', 'Ninja', true);
