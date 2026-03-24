-- Align branding with "مهمة التوصيل" / Muhimmat alTawseel (defaults + existing row)
ALTER TABLE public.system_settings
  ALTER COLUMN project_name_ar SET DEFAULT 'مهمة التوصيل',
  ALTER COLUMN project_name_en SET DEFAULT 'Muhimmat alTawseel';

UPDATE public.system_settings
SET
  project_name_ar = 'مهمة التوصيل',
  project_name_en = 'Muhimmat alTawseel',
  updated_at = now();
