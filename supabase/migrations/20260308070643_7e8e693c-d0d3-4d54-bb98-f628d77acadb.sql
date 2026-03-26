
CREATE TABLE IF NOT EXISTS public.scheme_month_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheme_id uuid NOT NULL REFERENCES public.salary_schemes(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(scheme_id, month_year)
);

ALTER TABLE public.scheme_month_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view scheme_month_snapshots"
  ON public.scheme_month_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins/finance can manage scheme_month_snapshots"
  ON public.scheme_month_snapshots FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role));
