import { useQuery } from '@tanstack/react-query';
import { appService } from '@/services/appService';
import { useAuth } from '@/context/AuthContext';

export const appsDataQueryKey = ['apps', 'list-with-counts'] as const;

type AppWithCount = {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  employeeCount: number;
  custom_columns: unknown[];
};

export const useAppsData = () => {
  const { session } = useAuth();
  return useQuery({
    queryKey: appsDataQueryKey,
    queryFn: async () => {
      const { data, error } = await appService.getAll();
      if (error) {
        throw new Error(error.message || 'تعذر تحميل التطبيقات');
      }
      if (!data) return [] as AppWithCount[];

      const appsWithCounts = await Promise.all(
        data.map(async (app) => {
          const countRes = await appService.countActiveEmployeeApps(app.id);
          return {
            id: app.id,
            name: app.name,
            name_en: app.name_en,
            brand_color: app.brand_color || '#6366f1',
            text_color: app.text_color || '#ffffff',
            is_active: app.is_active,
            employeeCount: countRes.count || 0,
            custom_columns: (app.custom_columns as unknown[]) || [],
          } as AppWithCount;
        })
      );

      return appsWithCounts;
    },
    retry: 2,
    staleTime: 60_000,
    enabled: !!session,
  });
};
