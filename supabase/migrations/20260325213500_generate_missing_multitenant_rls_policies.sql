-- Generate missing multi-tenant RLS policies for tables that have company_id.
-- This migration is intentionally conservative:
-- - Enables RLS on every public table that has company_id.
-- - Creates policies ONLY for tables that currently have zero policies.
-- - Leaves existing handcrafted policies untouched.

DO $$
DECLARE
  t record;
  v_policy_count integer;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);

    SELECT COUNT(*)
    INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = t.table_name;

    IF v_policy_count = 0 THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (company_id = public.jwt_company_id())',
        t.table_name || '_select_own_company',
        t.table_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (company_id = public.jwt_company_id())',
        t.table_name || '_insert_own_company',
        t.table_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE USING (company_id = public.jwt_company_id()) WITH CHECK (company_id = public.jwt_company_id())',
        t.table_name || '_update_own_company',
        t.table_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE USING (company_id = public.jwt_company_id())',
        t.table_name || '_delete_own_company',
        t.table_name
      );
    END IF;
  END LOOP;
END
$$;
