
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_code text,
  ADD COLUMN IF NOT EXISTS birth_date date;

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_code_unique
  ON public.employees (employee_code)
  WHERE employee_code IS NOT NULL;
