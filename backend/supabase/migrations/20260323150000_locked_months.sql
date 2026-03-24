CREATE TABLE IF NOT EXISTS public.locked_months (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.locked_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locked_months_select"
  ON public.locked_months FOR SELECT
  USING (is_active_user(auth.uid()));

CREATE POLICY "locked_months_manage"
  ON public.locked_months FOR ALL
  USING (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::app_role)
  );

