ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS iqama_alert_days INTEGER NOT NULL DEFAULT 90;

UPDATE public.system_settings
SET iqama_alert_days = 90
WHERE iqama_alert_days IS NULL;
