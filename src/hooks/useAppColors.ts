import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppColorData {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
}

let cachedApps: AppColorData[] | null = null;
let fetchPromise: Promise<AppColorData[]> | null = null;

export const fetchAppColors = async (): Promise<AppColorData[]> => {
  if (cachedApps) return cachedApps;
  if (fetchPromise) return fetchPromise;
  
  fetchPromise = new Promise<AppColorData[]>((resolve) => {
    supabase
      .from('apps')
      .select('id, name, name_en, brand_color, text_color, is_active')
      .order('name')
      .then(({ data }) => {
        cachedApps = (data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          name_en: a.name_en,
          brand_color: a.brand_color || '#6366f1',
          text_color: a.text_color || '#ffffff',
          is_active: a.is_active,
        }));
        fetchPromise = null;
        resolve(cachedApps!);
      });
  });
  
  return fetchPromise;
};

export const invalidateAppColorsCache = () => {
  cachedApps = null;
  fetchPromise = null;
};

export const getAppColor = (apps: AppColorData[], name: string) => {
  const app = apps.find(a => a.name === name);
  return {
    bg: app?.brand_color || '#6366f1',
    text: app?.text_color || '#ffffff',
    cellBg: app ? `${app.brand_color}14` : 'rgba(99,102,241,0.08)',
    val: app?.brand_color || '#6366f1',
  };
};

export const useAppColors = () => {
  const [apps, setApps] = useState<AppColorData[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    invalidateAppColorsCache();
    const data = await fetchAppColors();
    setApps(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppColors().then(data => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  return { apps, loading, reload, getColor: (name: string) => getAppColor(apps, name) };
};
