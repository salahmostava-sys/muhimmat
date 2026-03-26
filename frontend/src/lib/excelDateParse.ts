import * as XLSX from '@e965/xlsx';

const DD_MM_YYYY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const YYYY_MM_DD = /^(\d{4})-(\d{2})-(\d{2})$/;

function toIsoDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/** Parse Excel cell value to ISO date string yyyy-MM-dd */
export function parseExcelDate(val: unknown): string | null {
  if (val === undefined || val === null || val === '') return null;

  if (val instanceof Date) {
    return toIsoDate(val);
  }

  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (!date) return null;
    return toIsoDate(new Date(date.y, date.m - 1, date.d));
  }

  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;

    const dmyMatch = DD_MM_YYYY.exec(s);
    if (dmyMatch) {
      const d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
      return toIsoDate(d);
    }

    if (YYYY_MM_DD.exec(s)) return s;
    return toIsoDate(new Date(s));
  }

  return null;
}
