
-- Create system_settings table (single-row configuration)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name_ar text NOT NULL DEFAULT 'نظام التوصيل',
  project_name_en text NOT NULL DEFAULT 'Delivery System',
  project_subtitle_ar text NOT NULL DEFAULT 'إدارة المناديب',
  project_subtitle_en text NOT NULL DEFAULT 'Rider Management',
  logo_url text,
  default_language text NOT NULL DEFAULT 'ar',
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one row allowed
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_singleton ON public.system_settings ((true));

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (it's public config)
CREATE POLICY "Anyone can view system_settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update system_settings"
  ON public.system_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Admins can insert system_settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.system_settings (project_name_ar, project_name_en, project_subtitle_ar, project_subtitle_en)
VALUES ('نظام التوصيل', 'Delivery System', 'إدارة المناديب', 'Rider Management')
ON CONFLICT DO NOTHING;
