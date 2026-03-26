
-- Create new enums
CREATE TYPE public.city_enum AS ENUM ('makkah', 'jeddah');
CREATE TYPE public.license_status_enum AS ENUM ('has_license', 'no_license', 'applied');
CREATE TYPE public.sponsorship_status_enum AS ENUM ('sponsored', 'not_sponsored', 'absconded', 'terminated');

-- Add new columns to employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS city public.city_enum,
  ADD COLUMN IF NOT EXISTS join_date date,
  ADD COLUMN IF NOT EXISTS license_status public.license_status_enum DEFAULT 'no_license',
  ADD COLUMN IF NOT EXISTS sponsorship_status public.sponsorship_status_enum DEFAULT 'not_sponsored',
  ADD COLUMN IF NOT EXISTS id_photo_url text,
  ADD COLUMN IF NOT EXISTS license_photo_url text,
  ADD COLUMN IF NOT EXISTS personal_photo_url text;

-- Create employee-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents',
  'employee-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "HR/admin can upload employee documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);

CREATE POLICY "HR/admin can view employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);

CREATE POLICY "HR/admin can delete employee documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);

CREATE POLICY "HR/admin can update employee documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-documents'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);
