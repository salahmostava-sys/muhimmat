import { supabase } from '@/integrations/supabase/client';

export const alertsService = {
  fetchAlertsDataWithTimeout: async (
    threshold: string,
    iqamaThreshold: string,
    timeoutMs: number
  ) => {
    const fetchAll = Promise.all([
      supabase
        .from('employees')
        .select('id, name, residency_expiry, probation_end_date')
        .eq('status', 'active')
        .or(`residency_expiry.lte.${threshold},probation_end_date.lte.${threshold}`),
      supabase
        .from('vehicles')
        .select('id, plate_number, insurance_expiry, authorization_expiry')
        .in('status', ['active', 'maintenance', 'rental'])
        .or(`insurance_expiry.lte.${threshold},authorization_expiry.lte.${threshold}`),
      supabase
        .from('platform_accounts')
        .select('id, account_username, iqama_expiry_date, app_id, apps(name)')
        .eq('status', 'active')
        .not('iqama_expiry_date', 'is', null)
        .lte('iqama_expiry_date', iqamaThreshold),
      Promise.resolve({ data: [], error: null }),
    ]);

    const timeoutError = () =>
      new Error('انتهت مهلة تحميل البيانات. تحقق من الاتصال ثم أعد فتح الصفحة.');

    return Promise.race([
      fetchAll,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(timeoutError()), timeoutMs);
      }),
    ]);
  },

  fetchNotificationAlertsData: async (threshold: string) =>
    Promise.all([
      supabase
        .from('employees')
        .select('id, name, residency_expiry, probation_end_date')
        .eq('status', 'active')
        .or(`residency_expiry.lte.${threshold},probation_end_date.lte.${threshold}`),
      supabase
        .from('vehicles')
        .select('id, plate_number, insurance_expiry, authorization_expiry')
        .in('status', ['active', 'maintenance', 'rental'])
        .or(`insurance_expiry.lte.${threshold},authorization_expiry.lte.${threshold}`),
    ]),

  resolveAlert: async (alertId: string, resolvedBy: string | null) =>
    Promise.resolve({ data: null, error: null }),

  deferAlert: async (alertId: string, dueDate: string) =>
    Promise.resolve({ data: null, error: null }),
};
