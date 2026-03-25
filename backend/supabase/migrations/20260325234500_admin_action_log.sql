-- Dedicated admin action log (application-level audit trail).
-- This complements DB triggers (audit_log) by capturing intent and UI actions.

CREATE TABLE IF NOT EXISTS public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NULL,
  record_id text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  company_id uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_created_at
  ON public.admin_action_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_table_record
  ON public.admin_action_log (table_name, record_id);

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin actions: select" ON public.admin_action_log;
DROP POLICY IF EXISTS "Admin actions: insert" ON public.admin_action_log;

CREATE POLICY "Admin actions: select"
  ON public.admin_action_log
  FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'finance'::app_role)
      OR has_role(auth.uid(), 'operations'::app_role)
    )
  );

CREATE POLICY "Admin actions: insert"
  ON public.admin_action_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'finance'::app_role)
      OR has_role(auth.uid(), 'operations'::app_role)
    )
    AND user_id IS NOT DISTINCT FROM auth.uid()
  );

