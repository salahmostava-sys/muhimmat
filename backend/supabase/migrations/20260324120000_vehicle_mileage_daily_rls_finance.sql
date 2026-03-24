-- Allow finance (and HR) to read/write daily fuel/km entries alongside ops/admin
DROP POLICY IF EXISTS "Ops/admin can view vehicle_mileage_daily" ON public.vehicle_mileage_daily;

CREATE POLICY "Ops/admin/finance/hr can view vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admin/operations can manage vehicle_mileage_daily" ON public.vehicle_mileage_daily;

CREATE POLICY "Admin/ops/finance can manage vehicle_mileage_daily"
  ON public.vehicle_mileage_daily FOR ALL
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
