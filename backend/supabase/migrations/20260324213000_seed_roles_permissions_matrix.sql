-- Seed/update granular permissions matrix for role-based authorization.

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
