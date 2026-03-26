import { addDays, differenceInDays, format, parseISO } from "date-fns";

export interface Alert {
  id: string;
  type: string;
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: "urgent" | "warning" | "info";
  resolved: boolean;
}

export type EmployeeAlertRow = {
  id: string;
  name: string;
  residency_expiry: string | null;
  probation_end_date: string | null;
  sponsorship_status?: string | null;
};

export type VehicleExpiryRow = {
  id: string;
  plate_number: string;
  insurance_expiry: string | null;
  authorization_expiry: string | null;
};

export type PlatformAccountAlertRow = {
  id: string;
  account_username: string;
  iqama_expiry_date: string | null;
  app_id: string;
  apps?: { name?: string | null } | null;
};

export type PersistedAlertRow = {
  id: string;
  type: string;
  due_date: string | null;
  is_resolved: boolean | null;
  message: string | null;
  details: Record<string, unknown> | null;
};

const getStandardSeverity = (daysLeft: number): Alert["severity"] => {
  if (daysLeft <= 7) return "urgent";
  if (daysLeft <= 14) return "warning";
  return "info";
};

const getProbationSeverity = (daysLeft: number): Alert["severity"] => {
  if (daysLeft < 0) return "info";
  if (daysLeft <= 7) return "urgent";
  return "warning";
};

const pushEmployeeExpiryAlerts = (
  generatedAlerts: Alert[],
  emp: EmployeeAlertRow,
  threshold: string,
  today: Date
) => {
  if (emp.residency_expiry && emp.residency_expiry <= threshold) {
    const daysLeft = differenceInDays(parseISO(emp.residency_expiry), today);
    generatedAlerts.push({
      id: `res-${emp.id}`,
      type: "residency",
      entityName: emp.name,
      dueDate: emp.residency_expiry,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      resolved: false,
    });
  }

  if (emp.probation_end_date && emp.probation_end_date <= threshold) {
    const daysLeft = differenceInDays(parseISO(emp.probation_end_date), today);
    generatedAlerts.push({
      id: `prob-${emp.id}`,
      type: "probation",
      entityName: emp.name,
      dueDate: emp.probation_end_date,
      daysLeft,
      severity: getProbationSeverity(daysLeft),
      resolved: false,
    });
  }
};

const pushVehicleExpiryAlerts = (
  out: Alert[],
  vehicles: VehicleExpiryRow[] | null | undefined,
  threshold: string,
  today: Date
) => {
  if (!vehicles?.length) return;
  for (const v of vehicles) {
    if (v.insurance_expiry && v.insurance_expiry <= threshold) {
      const days = differenceInDays(parseISO(v.insurance_expiry), today);
      out.push({
        id: `ins-${v.id}`,
        type: "insurance",
        entityName: `مركبة ${v.plate_number}`,
        dueDate: v.insurance_expiry,
        daysLeft: days,
        severity: getStandardSeverity(days),
        resolved: false,
      });
    }
    if (v.authorization_expiry && v.authorization_expiry <= threshold) {
      const days = differenceInDays(parseISO(v.authorization_expiry), today);
      out.push({
        id: `auth-${v.id}`,
        type: "authorization",
        entityName: `مركبة ${v.plate_number}`,
        dueDate: v.authorization_expiry,
        daysLeft: days,
        severity: getStandardSeverity(days),
        resolved: false,
      });
    }
  }
};

const pushPlatformAccountAlerts = (out: Alert[], rows: PlatformAccountAlertRow[], today: Date) => {
  for (const acc of rows) {
    if (!acc.iqama_expiry_date) continue;
    const days = differenceInDays(parseISO(acc.iqama_expiry_date), today);
    const appName = acc.apps?.name ?? "منصة";
    const expiryFormatted = format(parseISO(acc.iqama_expiry_date), "dd/MM/yyyy");
    out.push({
      id: `pla-${acc.id}`,
      type: "platform_account",
      entityName: `إقامة الحساب ${acc.account_username} على منصة ${appName} ستنتهي في ${expiryFormatted}، قد يتوقف الحساب.`,
      dueDate: acc.iqama_expiry_date,
      daysLeft: days,
      severity: getStandardSeverity(days),
      resolved: false,
    });
  }
};

const pushPersistedDbAlerts = (out: Alert[], rows: PersistedAlertRow[], today: Date) => {
  for (const a of rows) {
    const dueDate = a.due_date ?? format(today, "yyyy-MM-dd");
    const daysLeft = differenceInDays(parseISO(dueDate), today);
    const details = a.details ?? {};
    const detailsEmployeeName = typeof details.employee_name === "string" ? details.employee_name : null;
    const entityName = detailsEmployeeName ?? a.message ?? "—";
    out.push({
      id: a.id,
      type: a.type,
      entityName,
      dueDate,
      daysLeft,
      severity: getStandardSeverity(daysLeft),
      resolved: !!a.is_resolved,
    });
  }
};

export function buildAlertsFromResponses(
  employeesRes: { data: EmployeeAlertRow[] | null },
  vehiclesRes: { data: VehicleExpiryRow[] | null },
  platformAccountsRes: { data: PlatformAccountAlertRow[] | null },
  dbAlertsRes: { data: PersistedAlertRow[] | null },
  threshold: string,
  today: Date
): Alert[] {
  const generatedAlerts: Alert[] = [];
  const employees = employeesRes.data ?? [];
  const platformAccounts = platformAccountsRes.data ?? [];
  const dbAlerts = dbAlertsRes.data ?? [];
  employees.forEach((emp) => pushEmployeeExpiryAlerts(generatedAlerts, emp, threshold, today));
  pushVehicleExpiryAlerts(generatedAlerts, vehiclesRes.data, threshold, today);
  pushPlatformAccountAlerts(generatedAlerts, platformAccounts, today);
  pushPersistedDbAlerts(generatedAlerts, dbAlerts, today);
  generatedAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
  return generatedAlerts;
}

export const daysFromTodayIso = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");
