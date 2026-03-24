import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomColumn {
  key: string;
  label: string;
}

export interface AppColorData {
  id: string;
  name: string;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  custom_columns?: CustomColumn[];
}

const FALLBACK_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#dc2626'];

export const getAppColor = (apps: AppColorData[], appName: string) => {
  const idx = Math.max(0, apps.findIndex((a) => a.name === appName));
  const app = apps.find((a) => a.name === appName);
  const brand = app?.brand_color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  const text = app?.text_color || '#ffffff';
  return {
    bg: `${brand}22`,
    text: brand,
    solid: brand,
    solidText: text,
  };
};

export const useAppColors = () => {
  const [apps, setApps] = useState<AppColorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('apps')
        .select('id, name, brand_color, text_color, is_active, custom_columns')
        .order('name');

      if (!mounted) return;
      const normalized = (data || []).map((app, index) => ({
        id: app.id,
        name: app.name,
        brand_color: app.brand_color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        text_color: app.text_color || '#ffffff',
        is_active: app.is_active ?? true,
        custom_columns: Array.isArray(app.custom_columns) ? app.custom_columns : [],
      })) as AppColorData[];
      setApps(normalized);
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const activeApps = useMemo(() => apps.filter((a) => a.is_active), [apps]);
  return { apps, activeApps, loading };
};

export default useAppColors;