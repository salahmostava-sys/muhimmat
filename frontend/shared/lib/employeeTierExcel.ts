/** أعمدة استيراد/تصدير شرائح الشركة (employee_tiers) — يجب أن تطابق القالب حرفياً لصف العناوين. */
export const EMPLOYEE_TIER_IO_COLUMNS = [
  { key: 'sim_number', label: 'رقم الشريحة' },
  { key: 'employee_name', label: 'اسم المندوب' },
  { key: 'package_type', label: 'نوع الباقة' },
  { key: 'renewal_date', label: 'تاريخ التجديد' },
  { key: 'delivery_status', label: 'حالة التسليم' },
  { key: 'platforms', label: 'المنصات' },
] as const;

export const EMPLOYEE_TIER_TEMPLATE_HEADERS = EMPLOYEE_TIER_IO_COLUMNS.map((c) => c.label);

const STATUS_DELIVERED = 'delivered';
const STATUS_NOT_DELIVERED = 'not_delivered';

/** تحويل تاريخ من Excel (رقم تسلسلي) أو نص إلى yyyy-MM-dd */
export function parseTierRenewalDate(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utcMs = (value - 25569) * 86400 * 1000;
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function parseTierDeliveryStatus(value: unknown): typeof STATUS_DELIVERED | typeof STATUS_NOT_DELIVERED {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!s) return STATUS_DELIVERED;
  if (
    ['not_delivered', 'not delivered', 'no', 'لا', '0', 'false'].includes(s) ||
    s === 'غير مسلم' ||
    s === 'غير مسلمة'
  ) {
    return STATUS_NOT_DELIVERED;
  }
  if (
    ['delivered', 'yes', 'نعم', '1', 'true', 'مسلّمة', 'مسلمة'].includes(s)
  ) {
    return STATUS_DELIVERED;
  }
  return STATUS_DELIVERED;
}

export function splitTierPlatformNames(raw: unknown): string[] {
  return String(raw ?? '')
    .split(/[,،;؛]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export type TierExcelEmployee = { id: string; name: string };
export type TierExcelApp = { id: string; name: string };

export function findEmployeeIdByName(employees: TierExcelEmployee[], name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  const exact = employees.find((e) => e.name.trim() === n);
  if (exact) return exact.id;
  const partial = employees.find(
    (e) => e.name.trim().includes(n) || n.includes(e.name.trim())
  );
  return partial?.id ?? null;
}

export function mapPlatformNamesToIds(
  names: string[],
  apps: TierExcelApp[]
): string[] {
  const ids: string[] = [];
  const lowerMap = new Map(apps.map((a) => [a.name.trim().toLowerCase(), a.id]));
  for (const raw of names) {
    const key = raw.trim().toLowerCase();
    const id = lowerMap.get(key);
    if (id) ids.push(id);
  }
  return ids;
}

export function isTierMatrixRowEmpty(values: unknown[]): boolean {
  return values.every((v) => v === '' || v === undefined || v === null);
}
