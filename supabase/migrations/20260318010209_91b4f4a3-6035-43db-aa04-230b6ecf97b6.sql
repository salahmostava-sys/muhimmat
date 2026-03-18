
CREATE TABLE public.employee_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL DEFAULT 'شريحة أساسية',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  renewal_date DATE NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users can view employee_tiers"
  ON public.employee_tiers FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "HR/admin can manage employee_tiers"
  ON public.employee_tiers FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)));

CREATE TRIGGER update_employee_tiers_updated_at
  BEFORE UPDATE ON public.employee_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
