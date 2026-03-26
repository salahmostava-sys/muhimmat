-- ============================================================
-- Realtime: dashboard + alerts (read-heavy screens)
-- Idempotent: add tables to supabase_realtime publication
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees',
    'attendance',
    'daily_orders',
    'audit_log',
    'vehicles',
    'alerts',
    'apps',
    'app_targets',
    'platform_accounts'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;
