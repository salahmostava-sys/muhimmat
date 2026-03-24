
-- Create app_targets table for persisting monthly targets per platform
CREATE TABLE IF NOT EXISTS public.app_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  target_orders integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (app_id, month_year)
);

ALTER TABLE public.app_targets ENABLE ROW LEVEL SECURITY;

-- Anyone active can view targets
CREATE POLICY "Active users can view app_targets"
  ON public.app_targets FOR SELECT
  USING (is_active_user(auth.uid()));

-- Admin/operations/finance can manage targets
CREATE POLICY "Admin/operations can manage app_targets"
  ON public.app_targets FOR ALL
  USING (is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'operations'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role)
  ));

-- Add write_off fields to advances for bad debt tracking
ALTER TABLE public.advances 
  ADD COLUMN IF NOT EXISTS is_written_off boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS written_off_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS written_off_reason text;
