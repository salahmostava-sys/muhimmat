import * as XLSX from '@e965/xlsx';

/** Parse Excel cell value to ISO date string yyyy-MM-dd */
export function parseExcelDate(val: unknown): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return d.toISOString().split('T')[0];
    }
    return null;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    const match1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match1) {
      const d = new Date(`${match1[3]}-${match1[2].padStart(2, '0')}-${match1[1].padStart(2, '0')}`);
      if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const match2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match2) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}
