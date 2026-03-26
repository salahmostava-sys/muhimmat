import { alertsService as coreAlertsService } from "../../services/alertsService";

export const alertsService = {
  fetchAlertsDataWithTimeout: coreAlertsService.fetchAlertsDataWithTimeout,
  fetchNotificationAlertsData: coreAlertsService.fetchNotificationAlertsData,
  resolveAlert: async (alertId: string, resolvedBy: string | null) => {
    const data = await coreAlertsService.resolveAlert(alertId, resolvedBy);
    return { data, error: null };
  },
  deferAlert: async (alertId: string, dueDate: string) => {
    const data = await coreAlertsService.deferAlert(alertId, dueDate);
    return { data, error: null };
  },
};
