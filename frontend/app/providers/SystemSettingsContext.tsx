import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@services/supabase/client';
import { useAuth } from '@app/providers/AuthContext';
import { logError } from '@shared/lib/logger';

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
  /** لتحديث صورة الشعار في الواجهة دون كاش قديم */
  updated_at?: string | null;
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
  project_name_ar: 'مهمة التوصيل',
  project_name_en: 'Muhimmat alTawseel',
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
  const { user, session, authLoading } = useAuth();
  const enabled = !!session && !!user && !authLoading;
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!enabled) {
      setLoading(authLoading);
      return;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) {
      logError('[SystemSettingsContext] fetch settings failed', error);
    }
    setSettings((data as unknown as SystemSettings) ?? defaults);
    setLoading(false);
  }, [enabled, authLoading]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const s = settings ?? defaults;
  const projectName = s.project_name_ar;
  const projectSubtitle = s.project_subtitle_ar;
  const contextValue = useMemo<SystemSettingsContextType>(
    () => ({ settings: s, projectName, projectSubtitle, loading, refresh: fetchSettings }),
    [s, projectName, projectSubtitle, loading, fetchSettings]
  );

  // Sync browser title
  useEffect(() => {
    document.title = projectName;
  }, [projectName]);

  return (
    <SystemSettingsContext.Provider value={contextValue}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => useContext(SystemSettingsContext);
