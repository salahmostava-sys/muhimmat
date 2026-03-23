import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemSettings {
  id: string;
  project_name_ar: string;
  project_name_en: string;
  project_subtitle_ar: string;
  project_subtitle_en: string;
  logo_url: string | null;
  default_language: string;
  theme: string;
  iqama_alert_days?: number;
}

interface SystemSettingsContextType {
  settings: SystemSettings | null;
  projectName: string;
  projectSubtitle: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

const defaults: SystemSettings = {
  id: '',
  project_name_ar: 'نظام التوصيل',
  project_name_en: 'Delivery System',
  project_subtitle_ar: 'إدارة المناديب',
  project_subtitle_en: 'Rider Management',
  logo_url: null,
  default_language: 'ar',
  theme: 'light',
  iqama_alert_days: 90,
};

const SystemSettingsContext = createContext<SystemSettingsContextType>({
  settings: defaults,
  projectName: defaults.project_name_ar,
  projectSubtitle: defaults.project_subtitle_ar,
  loading: true,
  refresh: async () => {},
});

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    setSettings((data as SystemSettings) ?? defaults);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const s = settings ?? defaults;
  const projectName = s.project_name_ar;
  const projectSubtitle = s.project_subtitle_ar;

  // Sync browser title
  useEffect(() => {
    document.title = projectName;
  }, [projectName]);

  return (
    <SystemSettingsContext.Provider value={{ settings: s, projectName, projectSubtitle, loading, refresh: fetchSettings }}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => useContext(SystemSettingsContext);
