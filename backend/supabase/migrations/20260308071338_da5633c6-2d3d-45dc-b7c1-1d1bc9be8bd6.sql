
-- Add new vehicle status values to the enum
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'breakdown';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'rental';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'ended';

-- Add authorization_expiry to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS authorization_expiry date;

-- Add timestamp fields to vehicle_assignments
ALTER TABLE public.vehicle_assignments ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone;
ALTER TABLE public.vehicle_assignments ADD COLUMN IF NOT EXISTS start_at timestamp with time zone;
