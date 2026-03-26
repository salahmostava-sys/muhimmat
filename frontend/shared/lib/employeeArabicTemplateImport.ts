import * as XLSX from '@e965/xlsx';
import { parseExcelDate } from '@shared/lib/excelDateParse';
import { employeeService } from '@services/employeeService';

/** Must match `handleTemplate` row order in Employees.tsx */
export const EMPLOYEE_TEMPLATE_AR_HEADERS = [
  'كود الموظف',
  'الاسم',
  'الاسم (إنجليزي)',
  'رقم الهوية',
  'رقم الهاتف',
  'البريد الإلكتروني',
  'المدينة (makkah/jeddah)',
  'الجنسية',
  'المسمى الوظيفي',
  'تاريخ الانضمام',
  'تاريخ الميلاد',
  'انتهاء فترة التجربة',
  'انتهاء الإقامة',
  'انتهاء التأمين الصحي',
  'انتهاء الرخصة',
  'حالة الرخصة (has_license/no_license/applied)',
  'حالة الكفالة (sponsored/not_sponsored/absconded/terminated)',
  'رقم الحساب البنكي',
  'IBAN',
  'نوع الراتب (orders/shift)',
  'الحالة (active/inactive/ended)',
] as const;

type DbKey =
  | 'employee_code'
  | 'name'
  | 'name_en'
  | 'national_id'
  | 'phone'
  | 'email'
  | 'city'
  | 'nationality'
  | 'job_title'
  | 'join_date'
  | 'birth_date'
  | 'probation_end_date'
  | 'residency_expiry'
  | 'health_insurance_expiry'
  | 'license_expiry'
  | 'license_status'
  | 'sponsorship_status'
  | 'bank_account_number'
  | 'iban'
  | 'salary_type'
  | 'status'
  | 'base_salary';

const HEADER_TO_DB: Record<string, DbKey> = {
  'كود الموظف': 'employee_code',
  'الاسم': 'name',
  'الاسم (إنجليزي)': 'name_en',
  'رقم الهوية': 'national_id',
  'رقم الهاتف': 'phone',
  'البريد الإلكتروني': 'email',
  'المدينة (makkah/jeddah)': 'city',
  'الجنسية': 'nationality',
  'المسمى الوظيفي': 'job_title',
  'تاريخ الانضمام': 'join_date',
  'تاريخ الميلاد': 'birth_date',
  'انتهاء فترة التجربة': 'probation_end_date',
  'انتهاء الإقامة': 'residency_expiry',
  'انتهاء التأمين الصحي': 'health_insurance_expiry',
  'انتهاء الرخصة': 'license_expiry',
  'حالة الرخصة (has_license/no_license/applied)': 'license_status',
  'حالة الكفالة (sponsored/not_sponsored/absconded/terminated)': 'sponsorship_status',
  'رقم الحساب البنكي': 'bank_account_number',
  'IBAN': 'iban',
  'نوع الراتب (orders/shift)': 'salary_type',
  'الحالة (active/inactive/ended)': 'status',
};

function normalizeHeaderCell(raw: unknown): string {
  return String(raw ?? '')
    .replaceAll('\uFEFF', '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function parseCity(val: string): 'makkah' | 'jeddah' | null {
  const v = val.trim().toLowerCase();
  if (!v) return null;
  if (v === 'makkah' || v === 'مكة' || v === 'مكه') return 'makkah';
  if (v === 'jeddah' || v === 'جدة' || v === 'جده') return 'jeddah';
  return null;
}

function strVal(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

export type EmployeeArabicRow = Partial<Record<DbKey, string | number | null>>;
const DATE_DB_KEYS = new Set<DbKey>([
  'join_date',
  'birth_date',
  'probation_end_date',
  'residency_expiry',
  'health_insurance_expiry',
  'license_expiry',
]);

function isDateDbKey(key: DbKey): boolean {
  return DATE_DB_KEYS.has(key);
}

function parseEnumValue(
  key: DbKey,
  raw: unknown
): string | undefined {
  const v = String(raw).trim().toLowerCase();
  if (key === 'salary_type') return v === 'orders' || v === 'shift' ? v : undefined;
  if (key === 'status') return v === 'active' || v === 'inactive' || v === 'ended' ? v : undefined;
  if (key === 'license_status') return v === 'has_license' || v === 'no_license' || v === 'applied' ? v : undefined;
  if (key === 'sponsorship_status') {
    return ['sponsored', 'not_sponsored', 'absconded', 'terminated'].includes(v) ? v : undefined;
  }
  return undefined;
}

function parseCellByDbKey(key: DbKey, raw: unknown): string | undefined {
  if (isDateDbKey(key)) return parseExcelDate(raw) ?? undefined;
  if (key === 'city') return parseCity(String(raw)) ?? undefined;
  const enumValue = parseEnumValue(key, raw);
  if (enumValue !== undefined) return enumValue;
  return strVal(raw);
}

async function resolveEmployeeIdByKeys(
  row: EmployeeArabicRow,
  svc: typeof employeeService
) : Promise<string | null> {
  const code = strVal(row.employee_code);
  if (code) {
    const { data: existingByCode } = await svc.findByEmployeeCode(code);
    if (existingByCode?.id) return existingByCode.id;
  }

  const nid = strVal(row.national_id);
  if (!nid) return null;
  const { data: existingByNid } = await svc.findByNationalId(nid);
  return existingByNid?.id ?? null;
}

function isMatrixRowEmpty(line: unknown[] | undefined): boolean {
  if (!line) return true;
  return line.every((cell) => cell === '' || cell === null || cell === undefined);
}

function mapHeadersToDbKeys(
  headerRow: string[],
  headerErrors: string[]
): (DbKey | null)[] {
  return headerRow.map((h) => {
    const key = HEADER_TO_DB[h];
    if (!h) return null;
    if (!key) headerErrors.push(`عمود غير معروف: ${h}`);
    return key ?? null;
  });
}

function parseEmployeeDataRow(
  line: unknown[],
  colIndexToKey: (DbKey | null)[]
): EmployeeArabicRow | null {
  const obj: EmployeeArabicRow = {};
  let hasAny = false;
  for (let c = 0; c < colIndexToKey.length; c++) {
    const key = colIndexToKey[c];
    if (!key) continue;
    const raw = line[c];
    if (raw === '' || raw === null || raw === undefined) continue;
    hasAny = true;
    const parsed = parseCellByDbKey(key, raw);
    if (parsed !== undefined) obj[key] = parsed;
  }
  return hasAny ? obj : null;
}

/**
 * Read first sheet: row 0 = headers (Arabic), following rows = data.
 * Maps Arabic headers to DB field keys.
 */
export function parseEmployeeArabicWorkbook(buffer: ArrayBuffer): {
  rows: EmployeeArabicRow[];
  headerErrors: string[];
} {
  const headerErrors: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  } catch {
    return { rows: [], headerErrors: ['تعذر قراءة ملف Excel'] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], headerErrors: ['الملف لا يحتوي على أوراق عمل'] };

  const ws = wb.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (matrix.length < 2) return { rows: [], headerErrors: ['لا توجد صفوف بيانات'] };

  const headerRow = matrix[0].map(normalizeHeaderCell);
  const colIndexToKey = mapHeadersToDbKeys(headerRow, headerErrors);

  if (!colIndexToKey.some(Boolean)) {
    return { rows: [], headerErrors: ['لم يُعثر على أعمدة مطابقة للقالب — استخدم تحميل القالب'] };
  }

  const rows: EmployeeArabicRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (isMatrixRowEmpty(line)) continue;
    const parsedRow = parseEmployeeDataRow(line, colIndexToKey);
    if (!parsedRow) continue;
    rows.push(parsedRow);
  }

  return { rows, headerErrors: [...new Set(headerErrors)] };
}

function buildPayload(row: EmployeeArabicRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys: DbKey[] = [
    'employee_code',
    'name',
    'name_en',
    'national_id',
    'phone',
    'email',
    'city',
    'nationality',
    'job_title',
    'join_date',
    'birth_date',
    'probation_end_date',
    'residency_expiry',
    'health_insurance_expiry',
    'license_expiry',
    'license_status',
    'sponsorship_status',
    'bank_account_number',
    'iban',
    'salary_type',
    'status',
  ];
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  const st = row.salary_type;
  if (typeof st === 'string' && (st === 'orders' || st === 'shift')) out.salary_type = st;
  else out.salary_type = 'shift';

  out.base_salary = 0;
  if (!out.status) out.status = 'active';
  if (!out.sponsorship_status) out.sponsorship_status = 'not_sponsored';
  return out;
}

/**
 * Upsert rows: match by employee_code, else national_id; otherwise insert.
 */
export async function upsertEmployeeArabicRows(
  rows: EmployeeArabicRow[],
  svc: typeof employeeService = employeeService
): Promise<{ processed: number; failures: { name: string; error: string }[] }> {
  const failures: { name: string; error: string }[] = [];
  let processed = 0;

  for (const row of rows) {
    const nameHint = strVal(row.name) ?? strVal(row.employee_code) ?? strVal(row.national_id) ?? '—';
    try {
      const nm = strVal(row.name);
      if (!nm) { failures.push({ name: nameHint, error: 'الاسم مطلوب' }); continue; }

      const payload = buildPayload({ ...row, name: nm });
      const empId = await resolveEmployeeIdByKeys(row, svc);

      if (empId) {
        await svc.updateEmployee(empId, payload);
      } else {
        await svc.createEmployee(payload);
      }
      processed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ name: nameHint, error: msg });
    }
  }

  return { processed, failures };
}
