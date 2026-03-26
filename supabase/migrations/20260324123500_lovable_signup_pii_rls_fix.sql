-- ============================================================
-- Lovable security findings fix:
-- 1) Open signup auto-assigns 'viewer' role + profiles defaulted to is_active=true
--    which caused any new authenticated user to pass `is_active_user()` and read PII.
-- 2) Legacy broad RLS policies allowed authenticated users to read employee PII.
-- ============================================================

-- New signups must be inactive until approved.
ALTER TABLE public.profiles
ALTER COLUMN is_active SET DEFAULT false;

-- Ensure the signup trigger creates inactive profiles by default.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    false
  );
  RETURN NEW;
END;
$$;

-- Remove legacy broad read policies that leaked PII to all authenticated users.
DROP POLICY IF EXISTS "Authenticated can view employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated can view employee_apps" ON public.employee_apps;
DROP POLICY IF EXISTS "Authenticated can view advances" ON public.advances;
DROP POLICY IF EXISTS "Authenticated can view advance_installments" ON public.advance_installments;

