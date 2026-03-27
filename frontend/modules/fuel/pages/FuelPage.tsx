import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Download, FolderOpen, Edit2, Trash2,
  Fuel,
  X, Check, Activity, Calendar, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import * as XLSX from '@e965/xlsx';
import { format, endOfMonth } from 'date-fns';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { filterVisibleEmployeesInMonth } from '@shared/lib/employeeVisibility';
import { GlobalTableFilters, createDefaultGlobalFilters } from '@shared/components/table/GlobalTableFilters';
import { useFuelDailyPaged } from '@shared/hooks/useFuelDailyPaged';
import { auditService } from '@services/auditService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';
import { getErrorMessage } from '@services/serviceError';
import {
  calcFuelCostPerKm,
  calcFuelPerOrder,
  getRiderDailyRows,
  getRiderOrders,
  sumRiderFuel,
  sumRiderKm,
} from '@shared/lib/fuelBusiness';
import { useFuel } from '@modules/fuel/hooks/useFuel';
import {
  calcDailyStats,
  calcMonthlyStats,
  costPerKmColor,
  filterDailyRows,
  filterMonthlyRows,
  fuelPerOrderBadgeClass,
} from '@modules/fuel/model/fuelCalculations';
import { FuelMonthlyStats, FuelDailyStats } from '@modules/fuel/components/FuelStats';
import { FuelForm } from '@modules/fuel/components/FuelForm';
import { FuelMonthlyTable } from '@modules/fuel/components/FuelTable';

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyRow = {
  id: string;
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
  employee?: { name: string; personal_photo_url?: string | null };
};

type MonthlyRow = {
  employee_id: string;
  employee_name: string;
  personal_photo_url?: string | null;
  km_total: number;
  fuel_cost: number;
  orders_count: number;
  vehicle?: { plate_number: string; type: string; brand?: string | null; model?: string | null } | null;
  daily_count: number;
};

type Employee = { id: string; name: string; personal_photo_url?: string | null };
type AppRow = { id: string; name: string };
type DailyMileageResponseRow = DailyRow & { employees?: { name: string; personal_photo_url?: string | null } };
type ImportStep = 1 | 2 | 3;
type FuelBranch = 'makkah' | 'jeddah';

type ImportRow = {
  row_key: string;
  raw_name: string;
  km_total: number;
  fuel_cost: number;
  notes?: string;
  matched_employee?: Employee | null;
  manual_employee_id?: string;
};
const MONTHLY_SKELETON_ROWS = ['m1', 'm2', 'm3', 'm4', 'm5'];
type MonthlyOrderRow = { employee_id: string; orders_count: number };
type VehicleAssignmentRow = { employee_id: string; vehicles?: { plate_number: string; type: string; brand?: string | null; model?: string | null } };
type DailyMileageAggSource = {
  employee_id: string;
  km_total: number;
  fuel_cost: number;
  employees?: { name: string; personal_photo_url?: string | null };
};
type MonthlyAgg = { km: number; fuel: number; count: number; name: string; photo?: string | null };

const getErrorMessageOrFallback = (err: unknown, fallback: string): string =>
  getErrorMessage(err, fallback);

const buildOrdersMap = (rows: MonthlyOrderRow[]): Record<string, number> => {
  const map: Record<string, number> = {};
  rows.forEach((row) => {
    map[row.employee_id] = (map[row.employee_id] || 0) + (Number(row.orders_count) || 0);
  });
  return map;
};

const buildVehicleMap = (
  rows: VehicleAssignmentRow[]
): Record<string, { plate_number: string; type: string; brand?: string | null; model?: string | null }> => {
  const map: Record<string, { plate_number: string; type: string; brand?: string | null; model?: string | null }> = {};
  rows.forEach((row) => {
    if (map[row.employee_id] || !row.vehicles) return;
    map[row.employee_id] = row.vehicles;
  });
  return map;
};

const buildMonthlyAggMap = (
  rows: DailyMileageAggSource[],
  employeeIdsOnPlatform: Set<string> | null
): Record<string, MonthlyAgg> => {
  const aggMap: Record<string, MonthlyAgg> = {};
  rows.forEach((row) => {
    if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(row.employee_id)) return;
    const emp = row.employees;
    if (!aggMap[row.employee_id]) {
      aggMap[row.employee_id] = { km: 0, fuel: 0, count: 0, name: emp?.name || '', photo: emp?.personal_photo_url };
    }
    aggMap[row.employee_id].km += Number(row.km_total) || 0;
    aggMap[row.employee_id].fuel += Number(row.fuel_cost) || 0;
    aggMap[row.employee_id].count += 1;
  });
  return aggMap;
};

const buildEmployeeIndex = (employees: Employee[]): Record<string, Employee> => {
  const index: Record<string, Employee> = {};
  employees.forEach((employee) => { index[employee.id] = employee; });
  return index;
};

const buildMonthlyRows = (
  aggMap: Record<string, MonthlyAgg>,
  ordersMap: Record<string, number>,
  vehicleMap: Record<string, { plate_number: string; type: string; brand?: string | null; model?: string | null }>,
  employees: Employee[]
): MonthlyRow[] => {
  const employeeById = buildEmployeeIndex(employees);
  const allEmployeeIds = new Set<string>([
    ...Object.keys(aggMap),
    ...Object.keys(ordersMap).filter((id) => (ordersMap[id] || 0) > 0),
  ]);
  return Array.from(allEmployeeIds).map((employeeId) => {
    const agg = aggMap[employeeId];
    const employee = employeeById[employeeId];
    return {
      employee_id: employeeId,
      employee_name: agg?.name || employee?.name || '—',
      personal_photo_url: agg?.photo || employee?.personal_photo_url || null,
      km_total: agg?.km || 0,
      fuel_cost: agg?.fuel || 0,
      orders_count: ordersMap[employeeId] || 0,
      vehicle: vehicleMap[employeeId] || null,
      daily_count: agg?.count || 0,
    };
  }).sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'ar'));
};

const mapDailyRows = (rows: DailyMileageResponseRow[]): DailyRow[] =>
  rows.map((row) => ({
    ...row,
    employee: row.employees ? { id: row.employee_id, ...row.employees } : undefined,
  }));

const applyDailyFilters = (
  rows: DailyRow[],
  selectedEmployee: string,
  employeeIdsOnPlatform: Set<string> | null
): DailyRow[] => {
  if (selectedEmployee && selectedEmployee !== '_all_') {
    return rows.filter((row) => row.employee_id === selectedEmployee);
  }
  if (!employeeIdsOnPlatform) return rows;
  const ids = Array.from(employeeIdsOnPlatform);
  if (ids.length === 0) return [];
  return rows.filter((row) => ids.includes(row.employee_id));
};

const renderMonthlyLoadingRows = (): React.ReactNode =>
  MONTHLY_SKELETON_ROWS.map((rowKey) => (
    <tr key={`fuel-monthly-skeleton-row-${rowKey}`} className="border-b border-border/30">
      {Array.from({ length: 9 }).map((_, j) => (
        <td key={`fuel-monthly-skeleton-cell-${rowKey}-${j}`} className="px-4 py-3"><div className="h-4 bg-muted/60 rounded animate-pulse" /></td>
      ))}
    </tr>
  ));

const renderMonthlyEmptyRow = (): React.ReactNode => (
  <tr>
    <td colSpan={9} className="text-center py-16">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <span className="text-4xl">⛽</span>
        <p className="font-medium">لا توجد بيانات لهذا الشهر</p>
        <p className="text-xs">أضف إدخالات يومية من عرض يومي أو غيّر المنصة/البحث</p>
      </div>
    </td>
  </tr>
);

const renderMonthlyTotalsRow = (
  filteredCount: number,
  totalKm: number,
  totalFuel: number,
  avgCostPerKm: number,
  totalOrders: number
): React.ReactNode => (
  <tr className="border-t-2 border-border bg-muted/20 font-semibold text-sm">
    <td className="px-4 py-3 text-foreground">الإجمالي ({filteredCount} مندوب)</td>
    <td className="px-4 py-3 text-center text-muted-foreground">—</td>
    <td className="px-4 py-3 text-center text-primary">{totalKm.toLocaleString()} كم</td>
    <td className="px-4 py-3 text-center text-warning">{totalFuel.toLocaleString()} ر.س</td>
    <td className={`px-4 py-3 text-center ${costPerKmColor(avgCostPerKm)}`}>
      {avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س/كم` : '—'}
    </td>
    <td className="px-4 py-3 text-center text-muted-foreground">—</td>
    <td className="px-4 py-3 text-center">{totalOrders.toLocaleString()}</td>
    <td className="px-4 py-3 text-center text-muted-foreground">
      {totalOrders > 0 ? `${(totalFuel / totalOrders).toFixed(2)} ر.س` : '—'}
    </td>
    <td />
  </tr>
);

const renderDailyLoadingRow = (): React.ReactNode => (
  <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">جاري التحميل...</td></tr>
);

const renderDailyEmptyRidersRow = (): React.ReactNode => (
  <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">لا يوجد مناديب على هذه المنصة</td></tr>
);

type DailyExpandedArgs = {
  days: DailyRow[];
  editingDaily: { id: string; km_total: string; fuel_cost: string; notes: string } | null;
  permissionsCanEdit: boolean;
  savingEntry: boolean;
  updateEditingDaily: (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => void;
  saveEditedDaily: (row: DailyRow) => Promise<void>;
  setEditingDaily: React.Dispatch<React.SetStateAction<{ id: string; km_total: string; fuel_cost: string; notes: string } | null>>;
  handleDeleteDaily: (id: string) => Promise<void>;
};

const renderDailyExpandedContent = ({
  days,
  editingDaily,
  permissionsCanEdit,
  savingEntry,
  updateEditingDaily,
  saveEditedDaily,
  setEditingDaily,
  handleDeleteDaily,
}: DailyExpandedArgs): React.ReactNode => {
  if (days.length === 0) {
    return <p className="text-xs text-muted-foreground px-2">لا سجلات يومية لهذا الشهر</p>;
  }
  return (
    <table className="w-full text-xs border border-border/40 rounded-lg overflow-hidden">
      <thead className="bg-muted/50">
        <tr>
          <th className="px-2 py-1.5 text-start">التاريخ</th>
          <th className="px-2 py-1.5 text-center">كم</th>
          <th className="px-2 py-1.5 text-center">بنزين</th>
          <th className="px-2 py-1.5 text-start">ملاحظات</th>
          <th className="px-2 py-1.5 text-center w-24">إجراء</th>
        </tr>
      </thead>
      <tbody>
        {days.map(dr => (
          <tr key={dr.id} className="border-t border-border/30">
            <td className="px-2 py-1.5 font-mono">{dr.date}</td>
            <td className="px-2 py-1.5 text-center">
              {editingDaily?.id === dr.id ? (
                <Input className="h-7 text-xs" type="number" value={editingDaily.km_total} onChange={e => updateEditingDaily('km_total', e.target.value)} />
              ) : (dr.km_total || '—')}
            </td>
            <td className="px-2 py-1.5 text-center">
              {editingDaily?.id === dr.id ? (
                <Input className="h-7 text-xs" type="number" value={editingDaily.fuel_cost} onChange={e => updateEditingDaily('fuel_cost', e.target.value)} />
              ) : (dr.fuel_cost || '—')}
            </td>
            <td className="px-2 py-1.5">
              {editingDaily?.id === dr.id ? (
                <Input className="h-7 text-xs" value={editingDaily.notes} onChange={e => updateEditingDaily('notes', e.target.value)} />
              ) : (dr.notes || '—')}
            </td>
            <td className="px-2 py-1.5 text-center">
              {permissionsCanEdit && (
                <div className="flex gap-1 justify-center">
                  {editingDaily?.id === dr.id ? (
                    <>
                      <Button type="button" size="sm" className="h-7 text-[10px] px-2" disabled={savingEntry} onClick={() => saveEditedDaily(dr)}>حفظ</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setEditingDaily(null)}>إلغاء</Button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => setEditingDaily({ id: dr.id, km_total: String(dr.km_total), fuel_cost: String(dr.fuel_cost), notes: dr.notes || '' })}><Edit2 size={13} /></button>
                      <button type="button" className="p-1 rounded hover:bg-destructive/10 text-destructive" onClick={() => handleDeleteDaily(dr.id)}><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const toCellString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/** Daily fuel/km — table public.vehicle_mileage_daily (not fuel_logs) */
async function saveVehicleMileageDaily(
  payload: { employee_id: string; date: string; km_total: number; fuel_cost: number; notes: string | null },
  upsertDailyMileage: (payload: { employee_id: string; date: string; km_total: number; fuel_cost: number; notes: string | null }, editId?: string) => Promise<unknown>,
  editId?: string
) {
  await upsertDailyMileage(payload, editId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  { v: '01', l: 'يناير' }, { v: '02', l: 'فبراير' }, { v: '03', l: 'مارس' },
  { v: '04', l: 'أبريل' }, { v: '05', l: 'مايو' }, { v: '06', l: 'يونيو' },
  { v: '07', l: 'يوليو' }, { v: '08', l: 'أغسطس' }, { v: '09', l: 'سبتمبر' },
  { v: '10', l: 'أكتوبر' }, { v: '11', l: 'نوفمبر' }, { v: '12', l: 'ديسمبر' },
];

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const IMPORT_STEPS: ImportStep[] = [1, 2, 3];

// extracted to modules/fuel/model/fuelCalculations.ts and modules/fuel/components/FuelStats.tsx

// ─── Import Modal (GPS monthly) ───────────────────────────────────────────────
const ImportModal = ({
  employees, monthYear, onClose, onImported,
}: {
  employees: Employee[];
  monthYear: string;
  onClose: () => void;
  onImported: () => void;
}) => {
  const { toast } = useToast();
  const fuelApi = useFuel();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState({ name: '', km: '', fuel: '__none__', notes: '__none__' });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileBuffer = await file.arrayBuffer();
    const wb = XLSX.read(fileBuffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!data.length) return toast({ title: 'الملف فارغ', variant: 'destructive' });
    setHeaders(Object.keys(data[0]));
    setRawData(data);
    setStep(2);
  };

  const buildPreview = () => {
    if (!mapping.name || !mapping.km) return toast({ title: 'حدد عمود الاسم والكيلومترات', variant: 'destructive' });
    const preview: ImportRow[] = rawData.map((r, idx) => {
      const raw_name = toCellString(r[mapping.name]).trim();
      const km_total = Number.parseFloat(toCellString(r[mapping.km])) || 0;
      const fuel_cost =
        mapping.fuel && mapping.fuel !== '__none__'
          ? Number.parseFloat(toCellString(r[mapping.fuel])) || 0
          : 0;
      const notes = mapping.notes && mapping.notes !== '__none__' ? toCellString(r[mapping.notes]) : '';
      const exact = employees.find(e => e.name === raw_name);
      const partial = exact ? null : employees.find(e => e.name.includes(raw_name) || raw_name.includes(e.name));
      return {
        row_key: `${idx}-${raw_name || 'unknown'}-${km_total}-${fuel_cost}`,
        raw_name,
        km_total,
        fuel_cost,
        notes,
        matched_employee: exact || partial || null,
      };
    }).filter(r => r.raw_name);
    setRows(preview);
    setStep(3);
  };

  const matched = rows.filter(r => r.matched_employee || r.manual_employee_id).length;
  const importStepLabel = (s: ImportStep) => {
    if (s === 1) return 'رفع الملف';
    if (s === 2) return 'ربط الأعمدة';
    return 'معاينة وتأكيد';
  };
  const handleManualEmployeeSelect = (rowKey: string, employeeId: string) => {
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.row_key === rowKey ? { ...currentRow, manual_employee_id: employeeId } : currentRow
      )
    );
  };

  const doImport = async () => {
    const toSave = rows.filter(r => r.matched_employee || r.manual_employee_id);
    if (!toSave.length) return toast({ title: 'لا توجد سجلات للاستيراد', variant: 'destructive' });
    setSaving(true);
    try {
      const payload = toSave.map(r => ({
        employee_id: r.manual_employee_id || r.matched_employee?.id || '',
        month_year: monthYear,
        km_total: r.km_total,
        fuel_cost: r.fuel_cost,
        notes: r.notes || null,
      }));
      await fuelApi.saveMonthlyMileageImport(payload, replaceExisting);
      toast({ title: `تم استيراد ${payload.length} سجل بنجاح` });
      onImported();
    } catch (e) {
      logError('[Fuel] import failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الاستيراد', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-border/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">استيراد كيلومترات GPS (شهري)</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border/50 shrink-0">
          {IMPORT_STEPS.map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{s}</div>
              <span className="text-xs text-muted-foreground">{importStepLabel(s)}</span>
              {s < 3 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <button
              type="button"
              className="w-full border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-4xl mb-3">📂</div>
              <p className="font-medium text-foreground">اضغط لرفع ملف Excel أو CSV</p>
              <p className="text-sm text-muted-foreground mt-1">ملف GPS يحتوي على أسماء المناديب والكيلومترات</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </button>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">تم اكتشاف <strong>{headers.length}</strong> عمود و <strong>{rawData.length}</strong> صف.</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'name' as const, label: 'عمود اسم المندوب', required: true },
                  { key: 'km' as const, label: 'عمود الكيلومترات', required: true },
                  { key: 'fuel' as const, label: 'عمود تكلفة البنزين', required: false },
                  { key: 'notes' as const, label: 'عمود الملاحظات', required: false },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-sm mb-1.5 block">{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
                    <Select
                      value={mapping[f.key]}
                      onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={f.required ? 'مطلوب' : 'اختياري'} /></SelectTrigger>
                      <SelectContent>
                        {!f.required && <SelectItem value="__none__">— لا يوجد —</SelectItem>}
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={buildPreview} className="w-full">التالي: معاينة البيانات</Button>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="badge-success">{matched} متطابق</span>
                <span className="badge-warning">{rows.length - matched} يحتاج مراجعة</span>
                <label className="flex items-center gap-1.5 ms-auto text-muted-foreground cursor-pointer">
                  <input type="checkbox" className="align-middle" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} />
                  <span>استبدال البيانات الموجودة</span>
                </label>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-start text-xs text-muted-foreground">الاسم في الملف</th>
                      <th className="px-3 py-2 text-start text-xs text-muted-foreground">المندوب المطابق</th>
                      <th className="px-3 py-2 text-xs text-muted-foreground">كم</th>
                      <th className="px-3 py-2 text-xs text-muted-foreground">بنزين</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const emp = row.manual_employee_id ? employees.find(e => e.id === row.manual_employee_id) : row.matched_employee;
                      const isMatched = !!emp;
                      return (
                        <tr key={row.row_key} className={`border-t border-border/30 ${isMatched ? '' : 'bg-warning/5'}`}>
                          <td className="px-3 py-2 font-medium">{row.raw_name}</td>
                          <td className="px-3 py-2">
                            {isMatched ? (
                              <span className="text-success text-xs flex items-center gap-1"><Check size={11} /> {emp?.name}</span>
                            ) : (
                              <Select
                                value={row.manual_employee_id || ''}
                                onValueChange={(v) => handleManualEmployeeSelect(row.row_key, v)}
                              >
                                <SelectTrigger className="h-7 text-xs border-warning/50"><SelectValue placeholder="اختر يدوياً..." /></SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">{row.km_total}</td>
                          <td className="px-3 py-2 text-center">{row.fuel_cost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {step === 3 && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button onClick={doImport} disabled={saving || matched === 0} className="w-full gap-2">
              {saving ? 'جاري الاستيراد...' : <><Check size={15} /> تأكيد استيراد {matched} سجل</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const FuelPage = () => { // NOSONAR: UI container with many independent handlers
  const { toast } = useToast();
  const fuelApi = useFuel();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions } = usePermissions('fuel');
  const now = new Date();
  const [view, setView] = useState<'monthly' | 'daily'>('monthly');
  const [dailyMode, setDailyMode] = useState<'detailed' | 'fast'>('detailed');
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'MM'));
  const [selectedYear, setSelectedYear] = useState(format(now, 'yyyy'));
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('_all_');
  const [platformTab, setPlatformTab] = useState('all');

  // fast daily state (server-side)
  const [fastDailyPage, setFastDailyPage] = useState(1);
  const [fastDailyPageSize] = useState(50);
  const [fastDailyFilters, setFastDailyFilters] = useState(() => createDefaultGlobalFilters());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [employeeAppLinks, setEmployeeAppLinks] = useState<{ employee_id: string; app_id: string }[]>([]);
  const [monthOrdersMap, setMonthOrdersMap] = useState<Record<string, number>>({});
  const [showImport, setShowImport] = useState(false);
  const [expandedRider, setExpandedRider] = useState<string | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ employee_id: '', date: '', km_total: '', fuel_cost: '', notes: '' });
  const [editingDaily, setEditingDaily] = useState<{ id: string; km_total: string; fuel_cost: string; notes: string } | null>(null);

  const monthYear = `${selectedYear}-${selectedMonth}`;
  const monthStart = `${monthYear}-01`;
  const monthEnd = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');
  const defaultEntryDate = todayStr >= monthStart && todayStr <= monthEnd ? todayStr : monthStart;

  const employeeIdsOnPlatform = useMemo(() => {
    if (platformTab === 'all') return null;
    const set = new Set<string>();
    employeeAppLinks.forEach(l => {
      if (l.app_id === platformTab) set.add(l.employee_id);
    });
    return set;
  }, [platformTab, employeeAppLinks]);

  const ridersForTab = useMemo(() => {
    const byId = new Map<string, Employee>();
    employees.forEach((e) => {
      if (!employeeIdsOnPlatform || employeeIdsOnPlatform.has(e.id)) byId.set(e.id, e);
    });

    // Ensure riders with monthly orders are visible so fuel/km can be recorded.
    Object.entries(monthOrdersMap).forEach(([empId, orders]) => {
      if (orders <= 0) return;
      if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(empId)) return;
      const emp = employees.find(e => e.id === empId);
      if (emp) byId.set(empId, emp);
    });

    let list = Array.from(byId.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [employees, employeeIdsOnPlatform, monthOrdersMap, search]);

  const { data: fuelBaseData, error: fuelBaseError } = useQuery({
    queryKey: ['fuel', uid, 'base-data'],
    enabled,
    queryFn: async () => {
      const [empRows, appRows, linkRows] = await Promise.all([
        fuelApi.getActiveEmployees(),
        fuelApi.getActiveApps(),
        fuelApi.getActiveEmployeeAppLinks(),
      ]);
      return {
        employees: (empRows || []) as Employee[],
        apps: (appRows || []) as AppRow[],
        links: (linkRows || []) as { employee_id: string; app_id: string }[],
      };
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });

  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthYear);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  useEffect(() => {
    if (!fuelBaseData) return;
    setEmployees(filterVisibleEmployeesInMonth(fuelBaseData.employees, activeEmployeeIdsInMonth));
    setApps(fuelBaseData.apps);
    setEmployeeAppLinks(fuelBaseData.links);
  }, [fuelBaseData, activeEmployeeIdsInMonth]);

  useEffect(() => {
    if (!fuelBaseError) return;
    const message = getErrorMessage(fuelBaseError, 'تعذر تحميل البيانات الأساسية');
    toast({ title: 'خطأ في تحميل البيانات', description: message, variant: 'destructive' });
  }, [fuelBaseError, toast]);

  const { data: monthlyOrdersData = [] } = useQuery({
    queryKey: ['fuel', uid, 'monthly-orders', monthYear],
    enabled,
    queryFn: async () => {
      const monthStart = `${monthYear}-01`;
      const monthEnd = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
      const rows = await fuelApi.getMonthlyOrders(monthStart, monthEnd);
      return (rows || []) as { employee_id: string; orders_count: number }[];
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  useEffect(() => {
    const map: Record<string, number> = {};
    monthlyOrdersData.forEach((o) => {
      map[o.employee_id] = (map[o.employee_id] || 0) + (Number(o.orders_count) || 0);
    });
    setMonthOrdersMap(map);
  }, [monthlyOrdersData]);

  useEffect(() => {
    setNewEntry(ne => ({ ...ne, date: defaultEntryDate }));
  }, [monthYear, defaultEntryDate]);

  const {
    data: monthlyRows = [],
    isLoading: monthlyLoading,
    error: monthlyError,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: ['fuel', uid, 'monthly', monthYear, platformTab, employees.map((e) => e.id).join(',')],
    enabled: enabled && view === 'monthly',
    queryFn: async () => {
      const ms = `${monthYear}-01`;
      const me = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
      const [dailyRowsRaw, orderRows, assignmentRows] = await Promise.all([
        fuelApi.getMonthlyDailyMileage(ms, me),
        fuelApi.getMonthlyOrders(ms, me),
        fuelApi.getActiveVehicleAssignments(),
      ]);
      const ordersMap = buildOrdersMap((orderRows || []) as MonthlyOrderRow[]);
      const vehicleMap = buildVehicleMap((assignmentRows || []) as VehicleAssignmentRow[]);
      const aggMap = buildMonthlyAggMap((dailyRowsRaw || []) as DailyMileageAggSource[], employeeIdsOnPlatform);
      return buildMonthlyRows(aggMap, ordersMap, vehicleMap, employees);
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  const {
    data: dailyRows = [],
    isLoading: dailyLoading,
    error: dailyError,
    refetch: refetchDaily,
  } = useQuery({
    queryKey: ['fuel', uid, 'daily', monthYear, selectedEmployee, platformTab],
    enabled: enabled && view === 'daily',
    queryFn: async () => {
      const ms = `${monthYear}-01`;
      const me = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
      const dailyData = await fuelApi.getDailyMileageByMonth(ms, me);
      const mappedRows = mapDailyRows((dailyData || []) as DailyMileageResponseRow[]);
      return applyDailyFilters(mappedRows, selectedEmployee, employeeIdsOnPlatform);
    },
    retry: defaultQueryRetry,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!monthlyError) return;
    logError('[Fuel] monthly query failed', monthlyError);
    toast({ title: 'خطأ في جلب البيانات', description: getErrorMessageOrFallback(monthlyError, 'تعذر جلب البيانات الشهرية'), variant: 'destructive' });
  }, [monthlyError, toast]);

  useEffect(() => {
    if (!dailyError) return;
    logError('[Fuel] daily query failed', dailyError);
    toast({ title: 'خطأ في جلب البيانات', description: getErrorMessageOrFallback(dailyError, 'تعذر جلب البيانات اليومية'), variant: 'destructive' });
  }, [dailyError, toast]);

  const refresh = () => {
    void refetchMonthly();
    void refetchDaily();
  };
  const loading = view === 'monthly' ? monthlyLoading : dailyLoading;

  const handleDeleteDaily = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    try {
      await fuelApi.deleteDailyMileage(id);
      toast({ title: 'تم الحذف' });
      refresh();
    } catch (e) {
      logError('[Fuel] save monthly failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الحذف', description: message, variant: 'destructive' });
    }
  };

  const submitNewEntry = async () => {
    if (!permissions.can_edit) return;
    if (!newEntry.employee_id) return toast({ title: 'اختر المندوب', variant: 'destructive' });
    if (!newEntry.date) return toast({ title: 'اختر التاريخ', variant: 'destructive' });
    const km = Number.parseFloat(newEntry.km_total) || 0;
    const fuel = Number.parseFloat(newEntry.fuel_cost) || 0;
    if (!km && !fuel) return toast({ title: 'أدخل الكيلومترات أو تكلفة البنزين', variant: 'destructive' });
    if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(newEntry.employee_id)) {
      return toast({ title: 'المندوب غير مسجّل على هذه المنصة', variant: 'destructive' });
    }
    setSavingEntry(true);
    try {
      await saveVehicleMileageDaily({
        employee_id: newEntry.employee_id,
        date: newEntry.date,
        km_total: km,
        fuel_cost: fuel,
        notes: newEntry.notes.trim() || null,
      }, fuelApi.upsertDailyMileage);
      toast({ title: 'تم الحفظ بنجاح' });
      setNewEntry(ne => ({ ...ne, km_total: '', fuel_cost: '', notes: '' }));
      refresh();
    } catch (e) {
      logError('[Fuel] save daily failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const saveEditedDaily = async (row: DailyRow) => {
    if (!permissions.can_edit || !editingDaily) return;
    const km = Number.parseFloat(editingDaily.km_total) || 0;
    const fuel = Number.parseFloat(editingDaily.fuel_cost) || 0;
    if (!km && !fuel) {
      toast({ title: 'أدخل الكيلومترات أو تكلفة البنزين', variant: 'destructive' });
      return;
    }
    setSavingEntry(true);
    try {
      await saveVehicleMileageDaily(
        {
          employee_id: row.employee_id,
          date: row.date,
          km_total: km,
          fuel_cost: fuel,
          notes: editingDaily.notes.trim() || null,
        },
        fuelApi.upsertDailyMileage,
        row.id
      );
      toast({ title: 'تم تحديث السجل' });
      setEditingDaily(null);
      refresh();
    } catch (e) {
      logError('[Fuel] export failed', e);
      const message = getErrorMessage(e);
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const filteredMonthly = filterMonthlyRows(monthlyRows, search);
  const filteredDaily = filterDailyRows(dailyRows, search);
  const { totalKm, totalFuel, totalOrders, avgCostPerKm } = calcMonthlyStats(filteredMonthly);
  const { dailyTotalKm, dailyTotalFuel } = calcDailyStats(filteredDaily);

  const tableRef = useRef<HTMLTableElement>(null);
  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  const handleExportMonthly = () => {
    const data = filteredMonthly.map(r => ({
      'الاسم': r.employee_name,
      'أيام مسجّلة': r.daily_count,
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'تكلفة/كم (ر.س)': r.km_total > 0 ? (r.fuel_cost / r.km_total).toFixed(3) : '',
      'عدد الطلبات': r.orders_count,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ملخص شهري');
    XLSX.writeFile(wb, `ملخص_الاستهلاك_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleExportDaily = () => {
    const data = filteredDaily.map(r => ({
      'التاريخ': r.date,
      'اليوم': DAY_NAMES[new Date(r.date + 'T12:00:00').getDay()],
      'الاسم': r.employee?.name || '',
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'ملاحظات': r.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'إدخالات يومية');
    XLSX.writeFile(wb, `إدخالات_يومية_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const dailyForRider = (empId: string) => getRiderDailyRows(filteredDaily, empId);
  const riderMonthKm = (empId: string) => sumRiderKm(dailyForRider(empId));
  const riderMonthFuel = (empId: string) => sumRiderFuel(dailyForRider(empId));
  const riderMonthOrders = (empId: string) => getRiderOrders(monthOrdersMap, empId);
  const updateEditingDaily = (field: 'km_total' | 'fuel_cost' | 'notes', value: string) => {
    setEditingDaily((current) => {
      if (!current) return null;
      return { ...current, [field]: value };
    });
  };
  let monthlyBodyRows: React.ReactNode;
  if (loading) {
    monthlyBodyRows = renderMonthlyLoadingRows();
  } else if (filteredMonthly.length === 0) {
    monthlyBodyRows = renderMonthlyEmptyRow();
  } else {
    monthlyBodyRows = (
      <>
        {filteredMonthly.map(row => {
          const costPerKm = calcFuelCostPerKm(row.km_total, row.fuel_cost);
          const fuelPerOrder = calcFuelPerOrder(row.fuel_cost, row.orders_count);
          return (
            <tr key={row.employee_id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {row.personal_photo_url && (
                    <img src={row.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  )}
                  <span className="font-medium text-foreground">{row.employee_name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{row.daily_count} يوم</span>
              </td>
              <td className="px-4 py-3 text-center font-medium text-primary">{row.km_total.toLocaleString()} كم</td>
              <td className="px-4 py-3 text-center font-medium text-warning">{row.fuel_cost.toLocaleString()} ر.س</td>
              <td className={`px-4 py-3 text-center ${costPerKmColor(costPerKm)}`}>
                {costPerKm === null ? '—' : `${costPerKm.toFixed(3)} ر.س/كم`}
              </td>
              <td className="px-4 py-3 text-center">
                {row.vehicle ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      {row.vehicle.type === 'motorcycle' ? '🏍️' : '🚗'} {row.vehicle.plate_number}
                    </span>
                    {(row.vehicle.brand || row.vehicle.model) && (
                      <span className="text-[10px] text-muted-foreground">
                        {[row.vehicle.brand, row.vehicle.model].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>
                ) : <span className="text-muted-foreground/40 text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {row.orders_count > 0
                  ? <span className="font-semibold text-foreground">{row.orders_count.toLocaleString()}</span>
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-muted-foreground">{fuelPerOrder === null ? '—' : `${fuelPerOrder.toFixed(2)} ر.س`}</span>
                  {(() => {
                    const badge = fuelPerOrderBadgeClass(fuelPerOrder);
                    if (!badge) return null;
                    return <span className={badge.className}>{badge.label}</span>;
                  })()}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(row.employee_id);
                    setView('daily');
                    setExpandedRider(row.employee_id);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  الأيام ←
                </button>
              </td>
            </tr>
          );
        })}
        {renderMonthlyTotalsRow(filteredMonthly.length, totalKm, totalFuel, avgCostPerKm, totalOrders)}
      </>
    );
  }
  let dailyRiderRows: React.ReactNode;
  if (loading) {
    dailyRiderRows = renderDailyLoadingRow();
  } else if (ridersForTab.length === 0) {
    dailyRiderRows = renderDailyEmptyRidersRow();
  } else {
    dailyRiderRows = ridersForTab.map(emp => {
      const open = expandedRider === emp.id;
      const days = dailyForRider(emp.id);
      return (
        <React.Fragment key={emp.id}>
          <tr className="border-b border-border/30 hover:bg-muted/10">
            <td className="px-2 py-2 text-center">
              <button
                type="button"
                className="p-1 rounded hover:bg-muted"
                onClick={() => setExpandedRider(open ? null : emp.id)}
                aria-expanded={open}
              >
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                {emp.personal_photo_url && <img src={emp.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />}
                <span className="font-medium">{emp.name}</span>
              </div>
            </td>
            <td className="px-4 py-2 text-center">
              {riderMonthOrders(emp.id) > 0
                ? <span className="font-semibold text-foreground">{riderMonthOrders(emp.id).toLocaleString()}</span>
                : <span className="text-muted-foreground/40">—</span>}
            </td>
            <td className="px-4 py-2 text-center font-medium text-primary">{riderMonthKm(emp.id).toLocaleString()}</td>
            <td className="px-4 py-2 text-center text-warning">{riderMonthFuel(emp.id).toLocaleString()} ر.س</td>
          </tr>
          {open && (
            <tr className="bg-muted/10">
              <td colSpan={5} className="p-0">
                <div className="p-3 space-y-2">
                  {renderDailyExpandedContent({
                    days,
                    editingDaily,
                    permissionsCanEdit: permissions.can_edit,
                    savingEntry,
                    updateEditingDaily,
                    saveEditedDaily,
                    setEditingDaily,
                    handleDeleteDaily,
                  })}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>بيانات الاستهلاك</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">بيانات الاستهلاك</h1>
              <p className="text-sm text-muted-foreground">الوقود والكيلومترات — يومي وشهري (vehicle_mileage_daily)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setView('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <BarChart3 size={13} /> عرض شهري
            </button>
            <button
              type="button"
              onClick={() => setView('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'daily' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Calendar size={13} /> عرض يومي
            </button>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground font-medium">المنصة:</span>
        <button
          type="button"
          onClick={() => setPlatformTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${platformTab === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted/50'}`}
        >
          الكل
        </button>
        {apps.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setPlatformTab(a.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${platformTab === a.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted/50'}`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {view === 'monthly' && (
        <>
          <FuelMonthlyStats totalKm={totalKm} totalFuel={totalFuel} avgCostPerKm={avgCostPerKm} totalOrders={totalOrders} />

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث باسم المندوب..." className="ps-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportMonthly}>📊 تصدير Excel (ملخص شهري)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const headers = [['اسم المندوب', 'الكيلومترات', 'تكلفة البنزين (ر.س)', 'ملاحظات']];
                  const ws = XLSX.utils.aoa_to_sheet(headers);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'قالب');
                  XLSX.writeFile(wb, 'template_fuel.xlsx');
                }}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImport(true)}>
                  ⬆️ استيراد GPS شهري
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <FuelMonthlyTable tableRef={tableRef} bodyRows={monthlyBodyRows} />
        </>
      )}

      {view === 'daily' && (
        <>
          {dailyMode === 'fast' ? (
            <FuelDailyFastList
              monthYear={monthYear}
              monthStart={monthStart}
              monthEnd={monthEnd}
              employees={ridersForTab}
              filters={fastDailyFilters}
              onFiltersChange={(next) => {
                setFastDailyFilters(next);
                setFastDailyPage(1);
              }}
              page={fastDailyPage}
              pageSize={fastDailyPageSize}
              onPageChange={setFastDailyPage}
              onBack={() => setDailyMode('detailed')}
            />
          ) : (
            <>
          <FuelDailyStats count={filteredDaily.length} totalKm={dailyTotalKm} totalFuel={dailyTotalFuel} />

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setDailyMode('fast')}
            >
              <Fuel size={14} /> قائمة (سريعة)
            </Button>
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث باسم المندوب..." className="ps-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="كل المناديب" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="_all_">كل المناديب (المنصة)</SelectItem>
                {ridersForTab.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                  <FolderOpen size={14} /> ملفات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDaily}>📊 تصدير Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Riders + expandable daily + bottom inline add */}
          <div className="bg-card rounded-xl shadow-card overflow-hidden border border-border/50">
            <div className="px-4 py-2 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
              مناديب المنصة المختارة (يشمل أي مندوب لديه طلبات هذا الشهر) — اضغط السهم لعرض السجلات اليومية وإضافة إدخال من الصف السفلي.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="w-10 px-2 py-2" />
                    <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">المندوب</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">الطلبات (الشهر)</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">كم (الشهر)</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">بنزين (الشهر)</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRiderRows}
                </tbody>
                {permissions.can_edit && (
                  <tfoot>
                    <tr className="bg-primary/5 border-t-2 border-primary/20">
                      <td colSpan={5} className="p-3">
                        <FuelForm
                          riders={ridersForTab}
                          entry={newEntry}
                          defaultEntryDate={defaultEntryDate}
                          saving={savingEntry}
                          onSubmit={submitNewEntry}
                          onChange={setNewEntry}
                        />
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
            </>
          )}
        </>
      )}

      {showImport && (
        <ImportModal
          employees={employees}
          monthYear={monthYear}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); void refetchMonthly(); }}
        />
      )}
    </div>
  );
};

export default FuelPage;

type FuelDailyFastListProps = Readonly<{
  monthYear: string;
  monthStart: string;
  monthEnd: string;
  employees: Employee[];
  filters: ReturnType<typeof createDefaultGlobalFilters>;
  onFiltersChange: (next: ReturnType<typeof createDefaultGlobalFilters>) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onBack: () => void;
}>;

function FuelDailyFastList(props: FuelDailyFastListProps) {
  const { monthYear, monthStart, monthEnd, employees, filters, onFiltersChange, page, pageSize, onPageChange, onBack } = props;
  const { toast } = useToast();
  const fuelApi = useFuel();
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useFuelDailyPaged({
    monthStart,
    monthEnd,
    page,
    pageSize,
    filters: {
      driverId: filters.driverId === 'all' ? undefined : String(filters.driverId),
      branch: filters.branch,
      search: filters.search,
    },
  });

  type Row = {
    id: string;
    employee_id: string;
    date: string;
    km_total: number;
    fuel_cost: number;
    notes: string | null;
    employees?: { id: string; name: string; city: string | null } | null;
  };
  const paged = data as unknown as { rows?: Row[]; total?: number } | undefined;
  const rows = paged?.rows || [];
  const total = paged?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isAllDrivers = filters.driverId === 'all';
  const isAllBranches = filters.branch === 'all';

  const exportExcel = async () => {
    setExporting(true);
    try {
      const employeeId = isAllDrivers ? undefined : String(filters.driverId);
      const branch: FuelBranch | undefined = isAllBranches ? undefined : (filters.branch as FuelBranch);
      const search = filters.search?.trim() || undefined;

      const out = (await fuelApi.exportDailyMileage({
        monthStart,
        monthEnd,
        filters: { employeeId, branch, search },
      })) as Row[];
      const sheet = out.map((r) => ({
        'التاريخ': r.date,
        'المندوب': r.employees?.name ?? '',
        'الفرع': r.employees?.city ?? '',
        'كيلومترات': r.km_total ?? 0,
        'بنزين': r.fuel_cost ?? 0,
        'ملاحظات': r.notes ?? '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      XLSX.utils.book_append_sheet(wb, ws, 'FuelDaily');
      XLSX.writeFile(wb, `fuel_daily_${monthYear}.xlsx`);

      await auditService.logAdminAction({
        action: 'fuel.daily.export',
        table_name: 'vehicle_mileage_daily',
        record_id: null,
        meta: { total: out.length, monthYear, employeeId: employeeId ?? null, branch: branch ?? null, search: search ?? null },
      });
    } catch (e) {
      const msg = getErrorMessage(e, 'تعذر التصدير');
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };
  const tableBodyRows = (() => {
    if (isLoading) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((slot) => (
        <tr key={`fuel-daily-skeleton-row-${slot}`}>
          <td className="px-4 py-3"><span className="text-muted-foreground">...</span></td>
          <td className="px-4 py-3"><span className="text-muted-foreground">...</span></td>
          <td className="px-4 py-3 text-center"><span className="text-muted-foreground">...</span></td>
          <td className="px-4 py-3 text-center"><span className="text-muted-foreground">...</span></td>
          <td className="px-4 py-3"><span className="text-muted-foreground">...</span></td>
        </tr>
      ));
    }
    if (rows.length === 0) {
      return (
        <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">لا توجد نتائج</td></tr>
      );
    }
    return rows.map((r) => (
      <tr key={r.id} className="hover:bg-muted/10">
        <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
        <td className="px-4 py-3 font-medium">{r.employees?.name ?? '—'}</td>
        <td className="px-4 py-3 text-center font-semibold text-primary">{Number(r.km_total || 0).toLocaleString()}</td>
        <td className="px-4 py-3 text-center text-warning">{Number(r.fuel_cost || 0).toLocaleString()}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{r.notes ?? '—'}</td>
      </tr>
    ));
  })();

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="page-title flex items-center gap-2">
              <Fuel size={18} /> الوقود — قائمة (سريعة)
            </h2>
            <p className="page-subtitle">{total.toLocaleString()} سجل — {monthYear}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onBack}>رجوع</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={exporting}>
                  <FolderOpen size={14} /> ملفات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportExcel} disabled={exporting}>
                  {exporting && <Download size={14} className="ml-2 opacity-70" />}
                  📊 تصدير Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="ds-card p-3">
        <GlobalTableFilters
          value={{
            ...createDefaultGlobalFilters(),
            search: filters.search,
            branch: filters.branch,
            driverId: filters.driverId,
            platformAppId: 'all',
            dateFrom: '',
            dateTo: '',
          }}
          onChange={(next) => onFiltersChange({ ...filters, ...next, platformAppId: 'all', dateFrom: '', dateTo: '' })}
          onReset={() => onFiltersChange(createDefaultGlobalFilters())}
          options={{
            drivers: employees.map((e) => ({ id: e.id, name: e.name })),
            enableBranch: true,
            enableDriver: true,
            enablePlatform: false,
            enableDateRange: false,
          }}
        />
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">التاريخ</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">المندوب</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">كم</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">بنزين</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tableBodyRows}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
          <div className="text-muted-foreground">{total.toLocaleString()} سجل</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
              السابق
            </Button>
            <span className="tabular-nums text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
              التالي
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
