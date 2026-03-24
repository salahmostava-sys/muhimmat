-- Enforce non-empty employee names at the database level.
DO $$
DECLARE
  v_invalid_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM public.employees
  WHERE name IS NULL OR length(btrim(name)) = 0;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'employees.name validation failed: % rows have NULL/empty names. Clean data first, then re-run migration.',
      v_invalid_count;
  END IF;
END
$$;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_name_not_empty
  CHECK (name IS NOT NULL AND length(btrim(name)) > 0);
