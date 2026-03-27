import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { alertsService } from '@services/alertsService';
import { buildAlertsFromResponses, type EmployeeAlertRow } from '@shared/lib/alertsBuilder';
import { filterVisibleEmployeesInMonth } from '@shared/lib/employeeVisibility';
import { defaultQueryRetry } from '@shared/lib/query';

const FETCH_ALERTS_TIMEOUT_MS = 45_000;

export const useAlerts = () => {
  const { settings } = useSystemSettings();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const iqamaAlertDays = settings?.iqama_alert_days ?? 90;
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(currentMonth);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const query = useQuery({
    queryKey: ['alerts', uid, 'page-data', iqamaAlertDays],
    enabled: enabled && !!activeIdsData,
    queryFn: async () => {
      const today = new Date();
      const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const threshold = format(endOfCurrentMonth, 'yyyy-MM-dd');
      const iqamaThreshold = format(addDays(today, iqamaAlertDays), 'yyyy-MM-dd');
      const [employeesRes, vehiclesRes, platformAccountsRes, dbAlertsRes] = await alertsService.fetchAlertsDataWithTimeout(
        threshold,
        iqamaThreshold,
        FETCH_ALERTS_TIMEOUT_MS
      );
      const employeesVisibleRes = {
        ...employeesRes,
        data: filterVisibleEmployeesInMonth(
          (employeesRes.data ?? []) as unknown as EmployeeAlertRow[],
          activeEmployeeIdsInMonth
        ),
      };
      return buildAlertsFromResponses(employeesVisibleRes, vehiclesRes, platformAccountsRes, dbAlertsRes, threshold, today);
    },
    retry: defaultQueryRetry,
    // Alerts domain policy: always fresh
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: 60_000,
  });

  return { ...query, uid, iqamaAlertDays };
};
