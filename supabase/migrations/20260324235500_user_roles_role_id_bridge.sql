-- Bridge migration: keep existing enum-based user_roles.role for compatibility
-- and introduce role_id FK to public.roles for normalized many-to-many role mapping.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_role_id_fkey'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill role_id from current enum role/title mapping.
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE ur.role_id IS NULL
  AND lower(r.title) = lower(ur.role::text);

-- Keep uniqueness on normalized shape while preserving legacy unique(user_id, role).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role_id
  ON public.user_roles(user_id, role_id)
  WHERE role_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON public.user_roles(role_id);
