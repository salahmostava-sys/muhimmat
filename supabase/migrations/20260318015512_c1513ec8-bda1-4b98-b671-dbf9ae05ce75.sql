
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS plate_number_en TEXT,
  ADD COLUMN IF NOT EXISTS chassis_number TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT;
