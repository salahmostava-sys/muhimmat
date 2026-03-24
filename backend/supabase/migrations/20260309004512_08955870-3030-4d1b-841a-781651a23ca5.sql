
-- ─── Departments table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  manager_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view departments"
  ON public.departments FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage departments"
  ON public.departments FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Positions table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view positions"
  ON public.positions FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage positions"
  ON public.positions FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Add department_id and position_id to employees ──────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL;
