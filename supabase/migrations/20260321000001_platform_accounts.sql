
-- ============================================================
-- PLATFORM ACCOUNTS
-- Accounts on delivery platforms (Hunger, Keeta, etc.)
-- Each account is tied to a residency (may belong to a former
-- employee). Multiple riders can work on the same account
-- across different time periods (sessions).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_external_id TEXT,
  residency_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  residency_holder_name TEXT,
  residency_expiry DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/admin/ops can view platform_accounts"
  ON public.platform_accounts FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "HR/admin can manage platform_accounts"
  ON public.platform_accounts FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

CREATE TRIGGER update_platform_accounts_updated_at
  BEFORE UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PLATFORM ACCOUNT SESSIONS
-- Tracks which rider worked on which account and when.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_account_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  worker_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_account_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/admin/ops can view platform_account_sessions"
  ON public.platform_account_sessions FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)    OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "HR/admin can manage platform_account_sessions"
  ON public.platform_account_sessions FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

CREATE TRIGGER update_platform_account_sessions_updated_at
  BEFORE UPDATE ON public.platform_account_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
