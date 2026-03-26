-- Ensure roles exist in fresh environments, then apply permission matrix.

-- Some environments may already have `roles_title_check` without `finance`.
-- Ensure the constraint allows all expected role titles.
ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_title_check;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_title_check
  CHECK (
    title = ANY (
      ARRAY[
        'admin'::text,
        'hr'::text,
        'finance'::text,
        'accountant'::text,
        'operations'::text,
        'viewer'::text
      ]
    )
  );

INSERT INTO public.roles (title, permissions, is_active)
VALUES
  ('admin', '{}'::jsonb, true),
  ('hr', '{}'::jsonb, true),
  ('finance', '{}'::jsonb, true),
  ('accountant', '{}'::jsonb, true),
  ('operations', '{}'::jsonb, true),
  ('viewer', '{}'::jsonb, true)
ON CONFLICT (title) DO UPDATE
SET is_active = EXCLUDED.is_active;

UPDATE public.roles
SET permissions = jsonb_build_object(
  '*',
  jsonb_build_object('view', true, 'write', true, 'delete', true, 'approve', true),
  'employees',
  jsonb_build_object('view', true, 'write', true, 'delete', true),
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', true),
  'attendance',
  jsonb_build_object('view', true, 'write', true),
  'salary',
  jsonb_build_object('view', true, 'write', true, 'approve', true),
  'roles',
  jsonb_build_object('view', true, 'write', true)
)
WHERE title = 'admin';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',
  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'attendance',
  jsonb_build_object('view', true, 'write', true),
  'salary',
  jsonb_build_object('view', true, 'write', false, 'approve', false),
  'roles',
  jsonb_build_object('view', true, 'write', false)
)
WHERE title = 'hr';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'attendance',
  jsonb_build_object('view', true, 'write', false),
  'salary',
  jsonb_build_object('view', true, 'write', true, 'approve', true),
  'roles',
  jsonb_build_object('view', true, 'write', false)
)
WHERE title IN ('finance', 'accountant');

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'attendance',
  jsonb_build_object('view', true, 'write', true),
  'salary',
  jsonb_build_object('view', true, 'write', false, 'approve', false),
  'roles',
  jsonb_build_object('view', false, 'write', false)
)
WHERE title = 'operations';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'attendance',
  jsonb_build_object('view', true, 'write', false),
  'salary',
  jsonb_build_object('view', true, 'write', false, 'approve', false),
  'roles',
  jsonb_build_object('view', false, 'write', false)
)
WHERE title = 'viewer';
