import { differenceInDays, parseISO } from 'date-fns';
import type { BranchKey } from '@shared/components/table/GlobalTableFilters';

export type Employee = {
  id: string;
  name: string;
  name_en?: string | null;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  employee_code?: string | null;
  bank_account_number?: string | null;
  iban?: string | null;
  city?: string | null;
  join_date?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  health_insurance_expiry?: string | null;
  probation_end_date?: string | null;
  license_status?: string | null;
  license_expiry?: string | null;
  sponsorship_status?: string | null;
  id_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
  nationality?: string | null;
  preferred_language?: string | null;
};

export type SortDir = 'asc' | 'desc' | null;

export const parseBranchFilter = (branch: BranchKey): Exclude<BranchKey, 'all'> | undefined => {
  if (branch === 'makkah' || branch === 'jeddah') return branch;
  return undefined;
};

export const getEmployeeFieldValue = (employee: Employee, field: string): unknown => {
  return (employee as Record<string, unknown>)[field];
};

const calcResidency = (expiry?: string | null) => {
  if (!expiry) return { days: null as number | null, status: 'unknown' as const };
  const days = differenceInDays(parseISO(expiry), new Date());
  const status = days >= 0 ? 'valid' : 'expired';
  return { days, status };
};

const matchesText = (source: string | null | undefined, filterValue: string): boolean =>
  (source || '').toLowerCase().includes(filterValue.toLowerCase());

const matchesExact = (source: string | null | undefined, filterValue: string): boolean =>
  (source || '') === filterValue;

function matchesResidencyFilter(employee: Employee, filterValue: string): boolean {
  const res = calcResidency(employee.residency_expiry);
  if (filterValue === 'valid') return res.status === 'valid';
  if (filterValue === 'expired') return res.status === 'expired';
  if (filterValue === 'urgent') return res.days !== null && res.days < 30;
  return true;
}

function matchesColumnFilter(employee: Employee, key: string, filterValue: string): boolean {
  if (!filterValue) return true;
  const predicates: Record<string, () => boolean> = {
    name: () => matchesText(employee.name, filterValue),
    national_id: () => (employee.national_id || '').includes(filterValue),
    employee_code: () => matchesText(employee.employee_code, filterValue),
    phone: () => (employee.phone || '').includes(filterValue),
    job_title: () => matchesExact(employee.job_title, filterValue),
    city: () => matchesExact(employee.city, filterValue),
    nationality: () => matchesExact(employee.nationality, filterValue),
    sponsorship_status: () => matchesExact(employee.sponsorship_status, filterValue),
    license_status: () => matchesExact(employee.license_status, filterValue),
    status: () => matchesExact(employee.status, filterValue),
    residency_status: () => matchesResidencyFilter(employee, filterValue),
    email: () => matchesText(employee.email, filterValue),
    bank_account_number: () => (employee.bank_account_number || '').includes(filterValue),
  };
  const predicate = predicates[key];
  if (!predicate) return true;
  return predicate();
}

export function applyEmployeeFilters(rows: Employee[], colFilters: Record<string, string>): Employee[] {
  return rows.filter((employee) => {
    for (const [key, value] of Object.entries(colFilters)) {
      if (!matchesColumnFilter(employee, key, value)) return false;
    }
    return true;
  });
}

export function sortEmployees(rows: Employee[], sortField: string | null, sortDir: SortDir): Employee[] {
  if (!sortField || !sortDir) return rows;
  return [...rows].sort((a, b) => { // NOSONAR
    const [va, vb]: [string | number, string | number] = sortField === 'days_residency'
      ? [
        a.residency_expiry ? differenceInDays(parseISO(a.residency_expiry), new Date()) : -9999,
        b.residency_expiry ? differenceInDays(parseISO(b.residency_expiry), new Date()) : -9999,
      ]
      : (() => {
        const aVal = getEmployeeFieldValue(a, sortField);
        const bVal = getEmployeeFieldValue(b, sortField);
        return [
          typeof aVal === 'number' ? aVal : String(aVal ?? ''),
          typeof bVal === 'number' ? bVal : String(bVal ?? ''),
        ];
      })();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}
