import { supabase } from "../src/integrations/supabase/client";
import { throwIfError } from "./serviceError";

type QueryError = { message?: string } | null;

export interface ResolveAlertResult {
  id: string;
}

export interface DeferAlertResult {
  id: string;
}

type AlertsFetchResult = [
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
  { data: unknown[] | null; error: QueryError },
];

export const alertsService = {
  fetchAlertsDataWithTimeout: async (
    threshold: string,
    iqamaThreshold: string,
    timeoutMs: number
  ): Promise<AlertsFetchResult> => {
    const fetchAll = Promise.all([
      supabase
        .from("employees")
        .select("id, name, residency_expiry, probation_end_date, sponsorship_status")
        .eq("status", "active")
        .or(`residency_expiry.lte.${threshold},probation_end_date.lte.${threshold}`),
      supabase
        .from("vehicles")
        .select("id, plate_number, insurance_expiry, authorization_expiry")
        .in("status", ["active", "maintenance", "rental"])
        .or(`insurance_expiry.lte.${threshold},authorization_expiry.lte.${threshold}`),
      supabase
        .from("platform_accounts")
        .select("id, account_username, iqama_expiry_date, app_id, apps(name)")
        .eq("status", "active")
        .not("iqama_expiry_date", "is", null)
        .lte("iqama_expiry_date", iqamaThreshold),
      supabase
        .from("alerts")
        .select("id, type, due_date, is_resolved, message, details")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const timeoutError = () =>
      new Error("انتهت مهلة تحميل البيانات. تحقق من الاتصال ثم أعد فتح الصفحة.");

    const results = (await Promise.race([
      fetchAll,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(timeoutError()), timeoutMs);
      }),
    ])) as AlertsFetchResult;

    const [employeesRes, vehiclesRes, platformAccountsRes, dbAlertsRes] = results;
    throwIfError(employeesRes.error, "alertsService.fetchAlertsDataWithTimeout.employees");
    throwIfError(vehiclesRes.error, "alertsService.fetchAlertsDataWithTimeout.vehicles");
    throwIfError(platformAccountsRes.error, "alertsService.fetchAlertsDataWithTimeout.platformAccounts");
    throwIfError(dbAlertsRes.error, "alertsService.fetchAlertsDataWithTimeout.alerts");
    return results;
  },

  fetchNotificationAlertsData: async (
    threshold: string
  ): Promise<
    readonly [
      { data: unknown[] | null; error: QueryError },
      { data: unknown[] | null; error: QueryError },
    ]
  > => {
    const [employeesRes, vehiclesRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, residency_expiry, probation_end_date, sponsorship_status")
        .eq("status", "active")
        .or(`residency_expiry.lte.${threshold},probation_end_date.lte.${threshold}`),
      supabase
        .from("vehicles")
        .select("id, plate_number, insurance_expiry, authorization_expiry")
        .in("status", ["active", "maintenance", "rental"])
        .or(`insurance_expiry.lte.${threshold},authorization_expiry.lte.${threshold}`),
    ]);
    throwIfError(employeesRes.error, "alertsService.fetchNotificationAlertsData.employees");
    throwIfError(vehiclesRes.error, "alertsService.fetchNotificationAlertsData.vehicles");
    return [employeesRes, vehiclesRes] as const;
  },

  // Critical fix: resolve action persists in DB.
  resolveAlert: async (alertId: string, resolvedBy: string | null): Promise<ResolveAlertResult> => {
    const { data, error } = await supabase
      .from("alerts")
      .update({
        is_resolved: true,
        resolved_by: resolvedBy,
      })
      .eq("id", alertId)
      .select("id")
      .maybeSingle();
    throwIfError(error, "alertsService.resolveAlert");
    if (!data?.id) {
      throw new Error("alertsService.resolveAlert: alert not found");
    }
    return { id: data.id as string };
  },

  // Critical fix: defer action persists in DB.
  deferAlert: async (alertId: string, dueDate: string): Promise<DeferAlertResult> => {
    const { data, error } = await supabase
      .from("alerts")
      .update({
        due_date: dueDate,
        is_resolved: false,
        resolved_by: null,
      })
      .eq("id", alertId)
      .select("id")
      .maybeSingle();
    throwIfError(error, "alertsService.deferAlert");
    if (!data?.id) {
      throw new Error("alertsService.deferAlert: alert not found");
    }
    return { id: data.id as string };
  },
};
