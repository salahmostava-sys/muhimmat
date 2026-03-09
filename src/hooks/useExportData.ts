import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';

type ExportFormat = 'excel' | 'csv';

interface ExportOptions {
  filename?: string;
  sheetName?: string;
}

export function useExportData() {
  const exportToExcel = <T extends Record<string, unknown>>(
    data: T[],
    columns: { key: keyof T; header: string }[],
    options: ExportOptions = {}
  ) => {
    const { filename = `export_${format(new Date(), 'yyyy-MM-dd')}`, sheetName = 'Sheet1' } = options;

    const rows = data.map(item =>
      Object.fromEntries(columns.map(col => [col.header, item[col.key] ?? '']))
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportToCSV = <T extends Record<string, unknown>>(
    data: T[],
    columns: { key: keyof T; header: string }[],
    options: ExportOptions = {}
  ) => {
    const { filename = `export_${format(new Date(), 'yyyy-MM-dd')}` } = options;

    const headers = columns.map(c => c.header).join(',');
    const rows = data.map(item =>
      columns.map(col => {
        const val = String(item[col.key] ?? '');
        return val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { exportToExcel, exportToCSV };
}
