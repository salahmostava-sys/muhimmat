-- Attendance enhancement: explicit work session metrics
-- Adds total_hours, late and early_leave to support check-in/check-out analytics.

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS late BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_leave BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date_late
  ON public.attendance (employee_id, date, late);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date_early_leave
  ON public.attendance (employee_id, date, early_leave);
