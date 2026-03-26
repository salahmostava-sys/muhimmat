
-- Daily fuel/km entries table
CREATE TABLE public.vehicle_mileage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  km_total numeric NOT NULL DEFAULT 0,
  fuel_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.vehicle_mileage_daily ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER update_vehicle_mileage_daily_updated_at
  BEFORE UPDATE ON public.vehicle_mileage_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
