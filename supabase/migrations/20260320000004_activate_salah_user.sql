-- ============================================================
-- Activate user: salahmostava@gmail.com
-- Reset password + ensure profile is active + assign admin role
-- ============================================================

-- 1) Reset password (bcrypt via pgcrypto)
-- Ensure pgcrypto is available for crypt()/gen_salt().
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET
  encrypted_password = extensions.crypt('sala7372495', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at          = now()
WHERE email = 'salahmostava@gmail.com';

-- 2) Ensure profile exists and is active
INSERT INTO public.profiles (id, email, name, is_active)
SELECT id, email, 'Salah', true
FROM auth.users
WHERE email = 'salahmostava@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET is_active = true,
      email     = EXCLUDED.email,
      updated_at = now();

-- 3) Ensure admin role assigned
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'salahmostava@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
