import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sendWhatsAppMessage } from '@shared/lib/whatsapp';
import { escapeHtml } from '@shared/lib/security';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Search, Wallet, FolderOpen, CheckCircle, Printer, ChevronUp, ChevronDown, ChevronsUpDown, LayoutGrid, Table2, AlertTriangle, FileText, Settings2, Globe, Archive, TrendingUp, Users, Building2 } from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { format } from 'date-fns';
import { useAppColors, AppColorData, CustomColumn } from '@shared/hooks/useAppColors';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useNavigate } from 'react-router-dom';
import { getSlipTranslations, getStatusLabel, LANGUAGE_META, type SlipLanguage } from '@shared/lib/salarySlipTranslations';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { salaryService, type PricingRule, type SalarySchemeTier } from '@services/salaryService';
import { salaryDataService } from '@services/salaryDataService';
import { salarySlipService } from '@services/salarySlipService';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { filterVisibleEmployeesInMonth } from '@shared/lib/employeeVisibility';
import { GlobalTableFilters, createDefaultGlobalFilters } from '@shared/components/table/GlobalTableFilters';
import type { BranchKey } from '@shared/components/table/GlobalTableFilters';
import { TableActions } from '@shared/components/table/TableActions';
import { SALARY_IMPORT_TEMPLATE_HEADERS, parseSalaryImportWorkbook } from '@shared/lib/salaryExcelImport';
import { isEmployeeIdUuid, isValidSalaryMonthYear } from '@shared/lib/salaryValidation';
import { printHtmlTable } from '@shared/lib/printTable';
import { defaultQueryRetry } from '@shared/lib/query';
import { useSalaryRecordsPaged } from '@shared/hooks/useSalaryRecordsPaged';
import { auditService } from '@services/auditService';
import JSZip from 'jszip';


// Kept for legacy references — populated dynamically from DB at runtime
const PLATFORM_COLORS: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {};

const statusLabels: Record<string, string> = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' };
const statusStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-info', paid: 'badge-success' };
const SALARY_CARD_SKELETON_KEYS = [
  'salary-card-skeleton-1',
  'salary-card-skeleton-2',
  'salary-card-skeleton-3',
  'salary-card-skeleton-4',
  'salary-card-skeleton-5',
  'salary-card-skeleton-6',
  'salary-card-skeleton-7',
  'salary-card-skeleton-8',
] as const;
const SALARY_TABLE_SKELETON_KEYS = [
  'salary-table-skeleton-1',
  'salary-table-skeleton-2',
  'salary-table-skeleton-3',
  'salary-table-skeleton-4',
  'salary-table-skeleton-5',
  'salary-table-skeleton-6',
  'salary-table-skeleton-7',
  'salary-table-skeleton-8',
  'salary-table-skeleton-9',
  'salary-table-skeleton-10',
  'salary-table-skeleton-11',
  'salary-table-skeleton-12',
] as const;

const toCityArabicLabel = (city?: string | null) => {
  if (city === 'makkah') return 'مكة';
  if (city === 'jeddah') return 'جدة';
  return '—';
};

const getStatusStyleForPrint = (status: SalaryRow['status']) => {
  if (status === 'paid') return 'background:#dcfce7;color:#15803d';
  if (status === 'approved') return 'background:#dbeafe;color:#1d4ed8';
  return 'background:#fef9c3;color:#92400e';
};

const getOrdersCellBackground = (
  orders: number,
  hitTarget: boolean,
  defaultBackground: string | undefined
) => {
  if (orders === 0) return undefined;
  if (hitTarget) return 'rgba(34,197,94,0.08)';
  return defaultBackground;
};

const toComparableSortValue = (value: unknown): string | number => {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return Number(value) || 0;
};

const wasFixedSchemeAlreadyCalculated = (
  platformNames: string[],
  appSchemeMap: Record<string, SchemeData | null>,
  platformSalaries: Record<string, number>,
  currentPlatform: string,
  schemeId: string,
) => {
  return platformNames.some(
    (prev) =>
      prev !== currentPlatform &&
      appSchemeMap[prev]?.id === schemeId &&
      platformSalaries[prev] !== undefined
  );
};

const loadXlsx = () => import('@e965/xlsx');
const loadHtml2Canvas = async () => (await import('html2canvas')).default;
const loadJsPdf = async () => (await import('jspdf')).default;

const calculatePlatformSalary = ({
  platformName,
  orders,
  attendanceDays,
  platformNames,
  appNameToId,
  rulesMap,
  appSchemeMap,
  platformSalaries,
}: {
  platformName: string;
  orders: number;
  attendanceDays: number;
  platformNames: string[];
  appNameToId: Record<string, string>;
  rulesMap: Record<string, PricingRule[]>;
  appSchemeMap: Record<string, SchemeData | null>;
  platformSalaries: Record<string, number>;
}) => {
  const appId = appNameToId[platformName];
  const appRules = appId ? (rulesMap[appId] || []) : [];
  const ruleResult = salaryService.applyPricingRules(appRules, orders);
  if (ruleResult.matchedRule) return Math.round(ruleResult.salary);

  const scheme = appSchemeMap[platformName];
  if (!scheme) return 0;

  if (scheme.scheme_type === 'fixed_monthly') {
    const alreadyCalculated = wasFixedSchemeAlreadyCalculated(
      platformNames,
      appSchemeMap,
      platformSalaries,
      platformName,
      scheme.id
    );
    if (alreadyCalculated) return 0;
    return salaryService.calculateFixedMonthlySalary(scheme.monthly_amount || 0, attendanceDays);
  }

  if (orders === 0) return 0;
  if (!scheme.salary_scheme_tiers) return 0;
  return salaryService.calculateTierSalary(
    orders,
    scheme.salary_scheme_tiers as SalarySchemeTier[],
    scheme.target_orders,
    scheme.target_bonus
  );
};

const generateMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = format(d, 'yyyy-MM');
    const l = d.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
    months.push({ v, l });
  }
  return months;
};
const months = generateMonths();

const shortEmployeeName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]}`;
};

type SortDir = 'asc' | 'desc' | null;
type FastApprovedFilter = 'all' | 'approved' | 'pending';

interface SalaryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  nationalId: string;
  city: string;
  bankAccount: string;
  hasIban: boolean;
  paymentMethod: 'bank' | 'cash';
  registeredApps: string[];
  platformOrders: Record<string, number>;
  platformSalaries: Record<string, number>;
  incentives: number;
  sickAllowance: number;
  violations: number;
  // Dynamic deduction columns keyed by "appName___colKey"
  customDeductions: Record<string, number>;
  transfer: number;
  advanceDeduction: number;
  advanceInstallmentIds: string[];
  advanceRemaining: number;
  externalDeduction: number;
  status: 'pending' | 'approved' | 'paid';
  isDirty?: boolean;
  preferredLanguage: SlipLanguage;
  phone?: string | null;
  // New columns: work days from attendance, fuel from vehicle_mileage
  workDays: number;
  fuelCost: number;
  platformIncome: number;
  engineBaseSalary?: number;
}

interface SchemeData {
  id: string;
  name: string;
  name_en: string | null;
  status: string;
  scheme_type?: 'order_based' | 'fixed_monthly';
  monthly_amount?: number | null;
  target_orders: number | null;
  target_bonus: number | null;
  salary_scheme_tiers?: {
    from_orders: number;
    to_orders: number | null;
    price_per_order: number;
    tier_order: number;
    tier_type?: 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental';
    incremental_threshold?: number | null;
    incremental_price?: number | null;
  }[];
  snapshot?: unknown;
  scheme_id?: string;
}

type OrderWithAppRow = {
  employee_id: string;
  orders_count: number;
  apps?: { name?: string | null } | null;
};

type AppWithSchemeRow = {
  id: string;
  name: string;
  salary_schemes?: SchemeData | null;
};

type SalaryDraftPatch = Pick<
  SalaryRow,
  'platformOrders' | 'incentives' | 'sickAllowance' | 'violations' | 'customDeductions' | 'transfer' | 'advanceDeduction' | 'externalDeduction' | 'platformIncome'
>;

const getManualDeductionTotal = (row: SalaryRow) =>
  Object.values(row.customDeductions || {}).reduce((sum, value) => sum + value, 0);

const getTotalDeductions = (row: SalaryRow) =>
  row.advanceDeduction + row.externalDeduction + row.violations + getManualDeductionTotal(row);

const buildSavedMap = (savedRecords: Array<{ employee_id: string; is_approved: boolean; net_salary: number }> | null | undefined) => {
  const savedMap: Record<string, { is_approved: boolean; net_salary: number }> = {};
  savedRecords?.forEach((r) => {
    savedMap[r.employee_id] = { is_approved: r.is_approved, net_salary: r.net_salary };
  });
  return savedMap;
};

const buildPreviewMap = (previewData: Array<Record<string, unknown>> | null | undefined) => {
  const previewMap: Record<string, { base_salary: number; advance_deduction: number; external_deduction: number }> = {};
  (previewData || []).forEach((row) => {
    const employeeId = String(row.employee_id || '');
    if (!employeeId) return;
    previewMap[employeeId] = {
      base_salary: Number(row.base_salary || 0),
      advance_deduction: Number(row.advance_deduction || 0),
      external_deduction: Number(row.external_deduction || 0),
    };
  });
  return previewMap;
};

const buildAttendanceDaysMap = (rows: Array<{ employee_id: string }> | null | undefined) => {
  const attendanceDaysMap: Record<string, number> = {};
  rows?.forEach((r) => {
    attendanceDaysMap[r.employee_id] = (attendanceDaysMap[r.employee_id] || 0) + 1;
  });
  return attendanceDaysMap;
};

const buildFuelCostMap = (rows: Array<{ employee_id: string; fuel_cost: number | string }> | null | undefined) => {
  const fuelCostMap: Record<string, number> = {};
  rows?.forEach((r) => {
    fuelCostMap[r.employee_id] = (fuelCostMap[r.employee_id] || 0) + Number(r.fuel_cost);
  });
  return fuelCostMap;
};

const buildOrdersMap = (rows: OrderWithAppRow[] | null | undefined) => {
  const ordMap: Record<string, Record<string, number>> = {};
  (rows || []).forEach((r) => {
    const appName = r.apps?.name || 'غير معروف';
    if (!ordMap[r.employee_id]) ordMap[r.employee_id] = {};
    ordMap[r.employee_id][appName] = (ordMap[r.employee_id][appName] || 0) + r.orders_count;
  });
  return ordMap;
};

const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={10} className="inline ml-0.5 opacity-40" />;
  if (sortDir === 'asc') return <ChevronUp size={10} className="inline ml-0.5" />;
  return <ChevronDown size={10} className="inline ml-0.5" />;
};

const renderEngineStatusBadge = (loadingData: boolean, previewBackendError: string | null) => {
  if (loadingData) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-pulse" />
        <span>جارٍ فحص محرك الرواتب</span>
      </span>
    );
  }
  if (previewBackendError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <span>Backend Engine Offline</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success">
      <span className="h-2 w-2 rounded-full bg-success" />
      <span>Backend Engine Online</span>
    </span>
  );
};

const resolveRowStatus = (
  saved: { is_approved: boolean; net_salary: number } | undefined,
  pendingInstallmentsCount: number,
  deductedInstallmentsCount: number,
): SalaryRow['status'] => {
  if (!saved?.is_approved) return 'pending';
  if (deductedInstallmentsCount > 0 || pendingInstallmentsCount === 0) {
    return pendingInstallmentsCount === 0 ? 'paid' : 'approved';
  }
  return 'approved';
};

const buildEmpPlatformSchemeMap = (
  employeeIds: string[],
  platformNames: string[],
  appSchemeMap: Record<string, SchemeData | null>,
) => {
  const out: Record<string, Record<string, SchemeData | null>> = {};
  for (const employeeId of employeeIds) {
    out[employeeId] = {};
    for (const platformName of platformNames) {
      out[employeeId][platformName] = appSchemeMap[platformName] ?? null;
    }
  }
  return out;
};

const buildAdvanceInstallmentMaps = async (
  selectedMonth: string,
  allAdvances: Array<{ id: string; employee_id: string }> | null | undefined,
) => {
  const advInstIds: Record<string, string[]> = {};
  const deductedInstIds: Record<string, string[]> = {};
  const advRemainingMap: Record<string, number> = {};
  if (!allAdvances || allAdvances.length === 0) {
    return { advInstIds, deductedInstIds, advRemainingMap };
  }

  const advanceIds = allAdvances.map(a => a.id);
  const advIdToEmpMap: Record<string, string> = {};
  for (const advance of allAdvances) advIdToEmpMap[advance.id] = advance.employee_id;

  const { data: advInstData } = await salaryDataService.getMonthInstallmentsForAdvances(selectedMonth, advanceIds);
  const { data: allPendingInsts } = await salaryDataService.getPendingInstallmentsForAdvances(advanceIds);

  allPendingInsts?.forEach((inst) => {
    const empId = advIdToEmpMap[inst.advance_id];
    if (!empId) return;
    advRemainingMap[empId] = (advRemainingMap[empId] || 0) + Number(inst.amount);
  });

  advInstData?.forEach((inst) => {
    const empId = advIdToEmpMap[inst.advance_id];
    if (!empId) return;
    if (inst.status === 'pending' || inst.status === 'deferred') {
      if (!advInstIds[empId]) advInstIds[empId] = [];
      advInstIds[empId].push(inst.id);
      return;
    }
    if (inst.status === 'deducted') {
      if (!deductedInstIds[empId]) deductedInstIds[empId] = [];
      deductedInstIds[empId].push(inst.id);
    }
  });

  return { advInstIds, deductedInstIds, advRemainingMap };
};

const buildSalaryRows = ({
  employees,
  selectedMonth,
  platformNames,
  appNameToId,
  rulesMap,
  appSchemeMap,
  ordMap,
  attendanceDaysMap,
  savedMap,
  previewMap,
  advInstIds,
  deductedInstIds,
  advRemainingMap,
  fuelCostMap,
}: {
  employees: Array<Record<string, unknown>>;
  selectedMonth: string;
  platformNames: string[];
  appNameToId: Record<string, string>;
  rulesMap: Record<string, PricingRule[]>;
  appSchemeMap: Record<string, SchemeData | null>;
  ordMap: Record<string, Record<string, number>>;
  attendanceDaysMap: Record<string, number>;
  savedMap: Record<string, { is_approved: boolean; net_salary: number }>;
  previewMap: Record<string, { base_salary: number; advance_deduction: number; external_deduction: number }>;
  advInstIds: Record<string, string[]>;
  deductedInstIds: Record<string, string[]>;
  advRemainingMap: Record<string, number>;
  fuelCostMap: Record<string, number>;
}) => {
  const newRows: SalaryRow[] = [];
  for (const emp of employees) {
    const employeeId = String(emp.id);
    const empOrders = ordMap[employeeId] || {};
    const attendanceDays = attendanceDaysMap[employeeId] || 0;
    const registeredApps = Object.keys(empOrders).filter(k => empOrders[k] > 0);

    const platformOrders: Record<string, number> = {};
    const platformSalaries: Record<string, number> = {};
    for (const platformName of platformNames) {
      const orders = empOrders[platformName] || 0;
      platformOrders[platformName] = orders;
      platformSalaries[platformName] = calculatePlatformSalary({
        platformName,
        orders,
        attendanceDays,
        platformNames,
        appNameToId,
        rulesMap,
        appSchemeMap,
        platformSalaries,
      });
    }

    const saved = savedMap[employeeId];
    const pendingInstallmentsCount = (advInstIds[employeeId] || []).length;
    const deductedInstallmentsCount = (deductedInstIds[employeeId] || []).length;
    const status = resolveRowStatus(saved, pendingInstallmentsCount, deductedInstallmentsCount);
    const preview = previewMap[employeeId];
    const hasIban = !!emp.iban;
    const preferredLanguage = (emp as { preferred_language?: SlipLanguage | null }).preferred_language || 'ar';
    const phone = (emp as { phone?: string | null }).phone || null;

    newRows.push({
      id: `${employeeId}-${selectedMonth}`,
      employeeId,
      employeeName: String(emp.name || ''),
      jobTitle: String(emp.job_title || 'مندوب توصيل'),
      nationalId: String(emp.national_id || '—'),
      city: toCityArabicLabel((emp.city as string | null) || null),
      bankAccount: emp.iban ? String(emp.iban).slice(-6) : '',
      hasIban,
      paymentMethod: hasIban ? 'bank' : 'cash',
      registeredApps,
      platformOrders,
      platformSalaries,
      incentives: 0,
      sickAllowance: 0,
      violations: 0,
      customDeductions: {},
      transfer: 0,
      advanceDeduction: preview.advance_deduction,
      advanceInstallmentIds: advInstIds[employeeId] || [],
      advanceRemaining: advRemainingMap[employeeId] || 0,
      externalDeduction: preview.external_deduction,
      status,
      preferredLanguage,
      phone,
      workDays: attendanceDays,
      fuelCost: fuelCostMap[employeeId] || 0,
      platformIncome: 0,
      engineBaseSalary: preview.base_salary,
    });
  }

  return newRows;
};

const hydrateRowsWithDraft = (rows: SalaryRow[], draftKey: string) => {
  let hydratedRows = rows;
  try {
    const draftRaw = localStorage.getItem(draftKey);
    if (!draftRaw) return hydratedRows;
    const draft = JSON.parse(draftRaw) as Record<string, SalaryDraftPatch>;
    hydratedRows = rows.map((row) => {
      const patch = draft[row.id];
      return patch ? { ...row, ...patch, isDirty: true } : row;
    });
  } catch (e) {
    console.warn('[Salaries] ignored malformed salaries draft in localStorage', e);
  }
  return hydratedRows;
};

const buildAppMaps = (appsWithScheme: AppWithSchemeRow[] | null | undefined) => {
  const appSchemeMap: Record<string, SchemeData | null> = {};
  const appNameToId: Record<string, string> = {};
  (appsWithScheme || []).forEach((app) => {
    appSchemeMap[app.name] = app.salary_schemes ? (app.salary_schemes as SchemeData) : null;
    appNameToId[app.name] = app.id;
  });
  return { appSchemeMap, appNameToId };
};

const fetchPricingRulesMap = async (appNameToId: Record<string, string>) => {
  const appIds = Object.values(appNameToId);
  const rulesByApp = await Promise.all(
    appIds.map(async (appId) => {
      const { data } = await salaryService.getPricingRules(appId);
      return { appId, rules: data || [] };
    })
  );
  const rulesMap: Record<string, PricingRule[]> = {};
  rulesByApp.forEach(({ appId, rules }) => {
    rulesMap[appId] = rules;
  });
  return rulesMap;
};

interface PayslipProps { row: SalaryRow; onClose: () => void; onApprove: () => void; selectedMonth: string; companyName?: string; }

const PayslipModal = ({ row, onClose, onApprove, selectedMonth, companyName }: PayslipProps) => {
  const t = getSlipTranslations(row.preferredLanguage);
  const meta = LANGUAGE_META[row.preferredLanguage];
  const dir = meta.dir;
  const slipRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // ── Only active platform rows (exclude platforms with no orders that aren't in active list) ──
  const platformRows = row.registeredApps
    .filter(app => (row.platformOrders[app] || 0) > 0)
    .map(app => ({
      app,
      orders: row.platformOrders[app] || 0,
      salary: row.platformSalaries[app] || 0,
    }));

  const totalPlatformSalary = platformRows.reduce((s, r) => s + r.salary, 0);
  const totalEarnings = totalPlatformSalary + row.incentives + row.sickAllowance;

  const allDeductions = [
    { key: 'advance',   label: t.advanceInstallment,  val: row.advanceDeduction },
    { key: 'external',  label: t.externalDeductions,  val: row.externalDeduction },
    { key: 'violation', label: t.violations,           val: row.violations },
    ...Object.entries(row.customDeductions || {}).map(([k, v]) => ({ key: k, label: k.split('___')[1] || k, val: v })),
  ];

  const hasAnyDeduction = allDeductions.some(d => d.val > 0);
  const deductionItems = hasAnyDeduction ? allDeductions.filter(d => d.val > 0) : [];
  const totalDeductions = allDeductions.reduce((s, d) => s + d.val, 0);

  const netSalary = totalEarnings - totalDeductions;
  const remaining = netSalary - row.transfer;
  const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;

  const fmt = (n: number) => `${n.toLocaleString()} ${t.currency}`;

  const exportPDF = async () => {
    if (!slipRef.current) return;
    setExporting(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const JsPdf = await loadJsPdf();
      const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const finalHeight = Math.min(imgHeight, pageHeight);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, finalHeight);
      pdf.save(`salary-slip-${row.employeeName}-${selectedMonth}.pdf`);
    } catch (e) {
      console.warn('[Salaries] DOM PDF capture failed, using fallback slip', e);
      // Fallback to service-based PDF when DOM capture fails.
      const simpleSlipBlob = await salarySlipService.generateSalaryPDF(
        { name: row.employeeName, nationalId: row.nationalId || null },
        netSalary,
        selectedMonth,
        Object.values(row.platformOrders).reduce((sum, count) => sum + count, 0)
      );
      const blobUrl = URL.createObjectURL(simpleSlipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `salary-slip-${row.employeeName}-${selectedMonth}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir={dir} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {t.title} — <span className="text-foreground">{row.employeeName}</span>
            <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <Globe size={12} /> {meta.flag} {meta.label}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div ref={slipRef} className="bg-white text-[#2a1a0f] border border-[#8c6239] p-4 rounded-md space-y-4 text-sm">
          <div className="flex items-start justify-between text-[12px] font-semibold">
            <div className="space-y-1 text-left">
              <div>{companyName || 'شركة مهمة التوصيل للخدمات اللوجستية'}</div>
              <div className="font-bold">C.R. 4030530671 | VAT: 3118873674</div>
            </div>
            <div className="text-center px-2 pt-1">
              <div className="text-2xl tracking-widest text-[#8c6239]">⌁</div>
            </div>
            <div className="space-y-1 text-right">
              <div>{companyName || 'شركة مهمة التوصيل للخدمات اللوجستية'}</div>
              <div className="font-bold">س. ت: 4030530671 - الرقم الضريبي: 3118873674</div>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="font-extrabold text-3xl text-[#8c6239]">{t.title}</p>
            <p className="font-bold text-lg">راتب شهر {monthLabel}</p>
            <p className="font-bold text-xl">اسم الموظف: {row.employeeName}</p>
          </div>

          <table className="w-full border border-[#8c6239] border-collapse text-center">
            <thead>
              <tr className="bg-[#8c6239] text-white">
                {(row.registeredApps.length > 0 ? row.registeredApps : ['المنصات']).map((app) => (
                  <th key={app} className="border border-[#8c6239] px-2 py-1 font-bold">{app}</th>
                ))}
                <th className="border border-[#8c6239] px-2 py-1 font-bold">إجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white text-[#2a1a0f]">
                {(row.registeredApps.length > 0 ? row.registeredApps : ['المنصات']).map((app) => (
                  <td key={`orders-${app}`} className="border border-[#8c6239] px-2 py-1 font-bold">
                    {(row.platformOrders[app] || 0).toLocaleString()}
                  </td>
                ))}
                <td className="border border-[#8c6239] px-2 py-1 font-extrabold">
                  {platformRows.reduce((s, p) => s + p.orders, 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-0 border border-[#8c6239]">
            <div className="border-l border-[#8c6239]">
              <div className="bg-[#8c6239] text-white text-center font-bold py-1">الاستحقاقات (ر.س)</div>
              <table className="w-full border-collapse">
                <thead className="sr-only">
                  <tr>
                    <th>البند</th>
                    <th>القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">الراتب الأساسي</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(totalPlatformSalary).toLocaleString()}</td></tr>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">{t.incentives}</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(row.incentives).toLocaleString()}</td></tr>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">{t.sickAllowance}</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(row.sickAllowance).toLocaleString()}</td></tr>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">الحالة</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{getStatusLabel(row.status, row.preferredLanguage)}</td></tr>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">طريقة الصرف</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{row.paymentMethod === 'bank' ? 'تحويل بنكي' : 'كاش'}</td></tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="bg-[#8c6239] text-white text-center font-bold py-1">الاستقطاعات (ر.س)</div>
              <table className="w-full border-collapse">
                <tbody>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">{t.advanceInstallment}</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(row.advanceDeduction).toLocaleString()}</td></tr>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">{t.externalDeductions}</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(row.externalDeduction).toLocaleString()}</td></tr>
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">{t.violations}</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(row.violations).toLocaleString()}</td></tr>
                  {Object.entries(row.customDeductions || {}).map(([k, v]) => {
                    const label = k.split('___').slice(1).join('___') || k;
                    return (
                      <tr key={k}>
                        <td className="border border-[#8c6239] px-2 py-1 font-semibold">{label}</td>
                        <td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(v).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr><td className="border border-[#8c6239] px-2 py-1 font-semibold">{t.advanceBalance}</td><td className="border border-[#8c6239] px-2 py-1 text-center font-bold">{Math.round(row.advanceRemaining).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0 border border-[#8c6239] font-bold text-lg">
            <div className="border-l border-[#8c6239] text-center py-2 bg-[#f4ece5]">
              إجمالي الاستقطاعات: {Math.round(totalDeductions).toLocaleString()}
            </div>
            <div className="text-center py-2 bg-[#f4ece5]">
              إجمالي الراتب: {Math.round(totalEarnings).toLocaleString()}
            </div>
          </div>

          <div className="border border-[#8c6239] bg-[#8c6239] text-white text-center py-3 text-2xl font-extrabold">
            الراتب المستحق: {Math.round(netSalary).toLocaleString()} ر.س
          </div>

          <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="text-center text-xs">
              <div className="h-8 border-b border-[#8c6239] mb-1" />
              <span>{t.signatureDriver}</span>
            </div>
            <div className="text-center text-xs">
              <div className="h-8 border-b border-[#8c6239] mb-1" />
              <span>{t.signatureAdmin}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-between pt-2">
          <Button variant="outline" onClick={onClose}>{t.close}</Button>
          <div className="flex gap-2">
            {row.status === 'pending' && (
              <Button variant="default" className="gap-2" onClick={onApprove}>
                <CheckCircle size={14} /> {t.approve}
              </Button>
            )}
            <Button onClick={exportPDF} disabled={exporting} className="gap-2">
              <Printer size={14} /> {exporting ? '...' : t.printPdf}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const EditableCell = ({
  value, onChange, className = '', min = 0, accentColor,
}: {
  value: number; onChange: (v: number) => void;
  className?: string; min?: number; accentColor?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));

  const commit = () => {
    const n = Number.parseFloat(local);
    onChange(Number.isNaN(n) ? 0 : Math.max(min, n));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{ borderColor: accentColor }}
        className={`w-16 text-center border rounded px-1 py-0.5 text-xs bg-background outline-none ${className}`}
      />
    );
  }
  return (
    <span
      onDoubleClick={() => { setLocal(String(value)); setEditing(true); }}
      style={accentColor && value > 0 ? { color: accentColor } : undefined}
      className={`cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 text-xs min-w-[40px] inline-block text-center ${className}`}
      title="نقر مزدوج للتعديل"
    >
      {value === 0 ? <span className="text-muted-foreground/40">0</span> : value.toLocaleString()}
    </span>
  );
};

// ─── Salary breakdown tooltip ─────────────────────────────────────
interface SalaryBreakdownProps {
  orders: number;
  scheme: SchemeData | null;
  salary: number;
  children: React.ReactNode;
}
const SalaryBreakdown = ({ orders, scheme, salary, children }: SalaryBreakdownProps) => {
  const [show, setShow] = useState(false);
  if (!scheme || orders === 0) return <>{children}</>;
  const tiers = scheme.salary_scheme_tiers || [];
  const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);
  const tierLines: { label: string; amount: number }[] = [];
  for (const tier of sorted) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders < from) break;
    const inTier = Math.min(orders, to) - from + 1;
    if (inTier <= 0) continue;
    const amt = inTier * tier.price_per_order;
    tierLines.push({ label: `${from}–${tier.to_orders ?? '∞'} × ${tier.price_per_order} ر.س = ${Math.round(amt).toLocaleString()}`, amount: amt });
  }
  const hasBonus = !!(scheme.target_orders && scheme.target_bonus && orders >= scheme.target_orders);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full mb-1 right-0 z-50 bg-popover border border-border rounded-xl shadow-xl p-3 text-xs w-64 text-right" dir="rtl">
          <p className="font-bold text-foreground mb-2 border-b border-border/50 pb-1">{scheme.name}</p>
          <p className="text-muted-foreground mb-1">الطلبات: <span className="font-semibold text-foreground">{orders}</span></p>
          <div className="space-y-0.5 mb-2">
            {tierLines.map((t) => (
              <p key={t.label} className="text-muted-foreground">{t.label}</p>
            ))}
          </div>
          {hasBonus && (
            <p className="text-success font-semibold">🎯 بونص الهدف: +{scheme.target_bonus?.toLocaleString()} ر.س</p>
          )}
          <div className="border-t border-border/50 mt-2 pt-1 flex justify-between font-bold text-primary">
            <span>الإجمالي</span>
            <span>{salary.toLocaleString()} ر.س</span>
          </div>
        </div>
      )}
    </div>
  );
};

type PlatformOrderCellProps = {
  rowId: string;
  platformName: string;
  tdClass: string;
  pc?: { cellBg: string; focusBorder: string };
  orders: number;
  salary: number;
  scheme: SchemeData | null | undefined;
  editingCell: { rowId: string; platform: string } | null;
  setEditingCell: (value: { rowId: string; platform: string } | null) => void;
  updatePlatformOrders: (id: string, platform: string, value: number) => void;
};

const PlatformOrderCell = ({
  rowId,
  platformName,
  tdClass,
  pc,
  orders,
  salary,
  scheme,
  editingCell,
  setEditingCell,
  updatePlatformOrders,
}: PlatformOrderCellProps) => {
  const target = scheme?.target_orders;
  const hitTarget = target && orders >= target;
  const rowBg = getOrdersCellBackground(orders, !!hitTarget, pc?.cellBg);
  const noScheme = orders > 0 && scheme === null;
  const isEditing = editingCell?.rowId === rowId && editingCell?.platform === platformName;

  const handleBlur = (value: number) => {
    updatePlatformOrders(rowId, platformName, value);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') setEditingCell(null);
  };

  let salaryMeta: React.ReactNode = null;
  if (orders > 0) {
    if (noScheme) {
      salaryMeta = (
        <span
          className="text-[10px] text-warning/90 font-medium"
          title="بدون سكيمة رواتب لهذه المنصة — راجع شريط التنبيه أعلى الصفحة"
        >
          —
        </span>
      );
    } else {
      salaryMeta = (
        <span className="text-[10px] text-foreground font-medium">
          {salary.toLocaleString()} ر.س
        </span>
      );
    }
  }

  return (
    <td
      key={`${platformName}-col`}
      className={`${tdClass} text-center border-l border-border/20`}
      style={{ background: noScheme ? 'rgba(234,179,8,0.1)' : rowBg }}
      onDoubleClick={() => setEditingCell({ rowId, platform: platformName })}
    >
      {isEditing ? (
        <input
          autoFocus
          type="number"
          defaultValue={orders}
          className="w-16 text-center border rounded px-1 py-0.5 text-xs bg-background"
          style={{ borderColor: pc?.focusBorder }}
          onBlur={e => handleBlur(Number(e.target.value))}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <SalaryBreakdown orders={orders} scheme={scheme || null} salary={salary}>
          <div className="flex flex-col items-center leading-tight">
            <span className={`font-semibold text-xs ${orders === 0 ? 'text-muted-foreground/30' : 'text-foreground'}`}>
              {orders === 0 ? '—' : orders}
            </span>
            {salaryMeta}
          </div>
        </SalaryBreakdown>
      )}
    </td>
  );
};

const CustomDeductionCell = ({
  row,
  fullKey,
  tdClass,
  updateRow,
}: {
  row: SalaryRow;
  fullKey: string;
  tdClass: string;
  updateRow: (id: string, patch: Partial<SalaryRow>) => void;
}) => {
  return (
    <td className={tdClass}>
      <EditableCell
        value={row.customDeductions?.[fullKey] || 0}
        onChange={(value) =>
          updateRow(row.id, { customDeductions: { ...row.customDeductions, [fullKey]: value } })
        }
        className="text-foreground"
      />
    </td>
  );
};

// ─── Main Salaries Page ───────────────────────────────────────────
const Salaries = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const navigate = useNavigate();
  const { projectName } = useSystemSettings();
  const { apps: appColorsList } = useAppColors();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(months[0].v);
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(selectedMonth);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;
  const [rows, setRows] = useState<SalaryRow[]>([]);
  // empPlatformScheme[employeeId][platformName] = scheme
  const [empPlatformScheme, setEmpPlatformScheme] = useState<Record<string, Record<string, SchemeData | null>>>({});
  const [payslipRow, setPayslipRow] = useState<SalaryRow | null>(null);
  const [salaryActionLoading, setSalaryActionLoading] = useState(false);
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [previewBackendError, setPreviewBackendError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [pageMode, setPageMode] = useState<'detailed' | 'fast'>('detailed');
  const [fastPage, setFastPage] = useState(1);
  const [fastPageSize] = useState(50);
  const [fastFilters, setFastFilters] = useState(() => createDefaultGlobalFilters());
  const [fastApproved, setFastApproved] = useState<FastApprovedFilter>('all');
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; platform: string } | null>(null);
  const [appsWithoutScheme, setAppsWithoutScheme] = useState<string[]>([]);
  const [appsWithoutPricingRules, setAppsWithoutPricingRules] = useState<string[]>([]);
  const [appIdByName, setAppIdByName] = useState<Record<string, string>>({});
  const [pricingRulesByAppId, setPricingRulesByAppId] = useState<Record<string, PricingRule[]>>({});

  // ── Batch ZIP export state ────────────────────────────────────
  const [batchQueue, setBatchQueue] = useState<SalaryRow[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchZip, setBatchZip] = useState<JSZip | null>(null);
  const [batchMonth, setBatchMonth] = useState('');
  const batchSlipRef = useRef<HTMLDivElement>(null);
  const salariesDraftKey = useMemo(
    () => `salaries:draft:${user?.id || 'anon'}:${selectedMonth}`,
    [user?.id, selectedMonth]
  );

  /** منصات بلا Pricing Rules فقط إن لم تكن مدرجة أصلاً كـ «بدون سكيمة» لتفادي تكرار الاسم في الشريط */
  const appsWithoutPricingRulesDeduped = useMemo(
    () => appsWithoutPricingRules.filter((n) => !appsWithoutScheme.includes(n)),
    [appsWithoutPricingRules, appsWithoutScheme]
  );

  const platformMeta = useMemo(() => {
    const newColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {};
    const newPlatforms: string[] = [];
    const newCustomCols: Record<string, CustomColumn[]> = {};
    appColorsList
      .filter((a) => a.is_active)
      .forEach((app) => {
        newPlatforms.push(app.name);
        newColors[app.name] = {
          header: app.brand_color,
          headerText: app.text_color,
          cellBg: `${app.brand_color}18`,
          valueColor: app.brand_color,
          focusBorder: app.brand_color,
        };
        newCustomCols[app.name] = app.custom_columns || [];
      });
    return { platforms: newPlatforms, platformColors: newColors, appCustomColumns: newCustomCols };
  }, [appColorsList]);
  const platforms = platformMeta.platforms;
  const platformColors = platformMeta.platformColors;
  const appCustomColumns = platformMeta.appCustomColumns;
  useEffect(() => {
    Object.keys(PLATFORM_COLORS).forEach((k) => delete PLATFORM_COLORS[k]);
    Object.assign(PLATFORM_COLORS, platformColors);
  }, [platformColors]);

  const {
    data: salaryBaseContext,
    error: salaryBaseContextError,
    isLoading: salaryBaseContextLoading,
  } = useQuery({
    queryKey: ['salaries', uid, 'base-context', selectedMonth],
    enabled: enabled && isValidSalaryMonthYear(selectedMonth),
    queryFn: async () => {
      const monthlyContextPromise = salaryDataService.getMonthlyContext(selectedMonth);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('انتهت مهلة تحميل بيانات الرواتب. حاول مرة أخرى.')),
          15000
        );
      });

      let monthlyContext: Awaited<ReturnType<typeof salaryDataService.getMonthlyContext>>;
      try {
        monthlyContext = await Promise.race([monthlyContextPromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const { data: previewData, error: previewError } = await salaryDataService.getSalaryPreviewForMonth(selectedMonth);
      if (previewError) {
        throw new Error(`PREVIEW_BACKEND: ${previewError.message}`);
      }

      return {
        monthlyContext,
        previewData: previewData || [],
      };
    },
    retry: defaultQueryRetry,
    staleTime: 20_000,
  });

  // ─── Data fetching ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchAllData = async () => {
      if (salaryBaseContextLoading) {
        setLoadingData(true);
        return;
      }
      setLoadingData(true);
      setPreviewBackendError(null);
      if (salaryBaseContextError) {
        if (!cancelled) {
          setLoadingData(false);
          toast({
            title: 'تعذر تحميل البيانات',
            description: salaryBaseContextError instanceof Error ? salaryBaseContextError.message : 'حدث خطأ غير متوقع أثناء تحميل الرواتب',
            variant: 'destructive',
          });
        }
        return;
      }
      if (!salaryBaseContext) return;
      if (cancelled) return;
      try {
        const { monthlyContext, previewData } = salaryBaseContext;
        const { empRes, ordersRes, appsWithSchemeRes, attendanceRes, fuelRes, savedRecords, allAdvances } = monthlyContext;
        const savedMap = buildSavedMap(savedRecords as Array<{ employee_id: string; is_approved: boolean; net_salary: number }> | null | undefined);
        const previewMap = buildPreviewMap((previewData || []) as Array<Record<string, unknown>>);

        const { advInstIds, deductedInstIds, advRemainingMap } = await buildAdvanceInstallmentMaps(
          selectedMonth,
          (allAdvances as Array<{ id: string; employee_id: string }> | null | undefined) || []
        );
        if (cancelled) return;

        const employees = filterVisibleEmployeesInMonth(
          (empRes.data || []) as unknown as { id: string; sponsorship_status?: string | null }[],
          activeEmployeeIdsInMonth
        );
        if (employees.some((emp) => !previewMap[emp.id])) {
          throw new Error('PREVIEW_BACKEND: تعذر تحميل نتائج المعاينة من الخادم لكل الموظفين');
        }

        const attendanceDaysMap = buildAttendanceDaysMap(attendanceRes.data as Array<{ employee_id: string }> | null | undefined);
        const fuelCostMap = buildFuelCostMap(fuelRes.data as Array<{ employee_id: string; fuel_cost: number | string }> | null | undefined);
        const ordMap = buildOrdersMap(ordersRes.data as OrderWithAppRow[] | null);
        const appsFromApi = (appsWithSchemeRes.data as AppWithSchemeRow[] | null) || [];
        const { appSchemeMap, appNameToId } = buildAppMaps(appsFromApi);
        const platformNames = appsFromApi.map(a => a.name);
        const rulesMap = await fetchPricingRulesMap(appNameToId);
        if (cancelled) return;

        const builtEmpPlatformScheme = buildEmpPlatformSchemeMap(
          employees.map(emp => emp.id),
          platformNames,
          appSchemeMap
        );
        const newRows = buildSalaryRows({
          employees: employees as Array<Record<string, unknown>>,
          selectedMonth,
          platformNames,
          appNameToId,
          rulesMap,
          appSchemeMap,
          ordMap,
          attendanceDaysMap,
          savedMap,
          previewMap,
          advInstIds,
          deductedInstIds,
          advRemainingMap,
          fuelCostMap,
        });
        const hydratedRows = hydrateRowsWithDraft(newRows, salariesDraftKey);

        if (cancelled) return;
        setAppIdByName(appNameToId);
        setPricingRulesByAppId(rulesMap);
        setAppsWithoutPricingRules(appsFromApi.filter((a) => !rulesMap[a.id] || rulesMap[a.id].length === 0).map((a) => a.name));
        setAppsWithoutScheme(appsFromApi.filter((a) => !a.salary_schemes).map((a) => a.name));
        setEmpPlatformScheme(builtEmpPlatformScheme);
        setRows(hydratedRows);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء تحميل الرواتب';
          if (message.startsWith('PREVIEW_BACKEND:')) {
            const normalized = message.replace('PREVIEW_BACKEND:', '').trim();
            setRows([]);
            setPreviewBackendError(normalized || 'تعذر تحميل معاينة الرواتب من الخادم');
          }
          toast({
            title: 'تعذر تحميل البيانات',
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };

    void fetchAllData();
    return () => {
      cancelled = true;
    };
  }, [
    selectedMonth,
    salariesDraftKey,
    salaryBaseContext,
    salaryBaseContextError,
    salaryBaseContextLoading,
    activeEmployeeIdsInMonth,
    toast,
  ]);

  // Auto-save editable salary draft per month/user.
  useEffect(() => {
    if (loadingData || rows.length === 0) return;
    const timer = setTimeout(() => {
      const draft: Record<string, SalaryDraftPatch> = {};
      rows.forEach((row) => {
        draft[row.id] = {
          platformOrders: row.platformOrders,
          incentives: row.incentives,
          sickAllowance: row.sickAllowance,
          violations: row.violations,
          customDeductions: row.customDeductions,
          transfer: row.transfer,
          advanceDeduction: row.advanceDeduction,
          externalDeduction: row.externalDeduction,
          platformIncome: row.platformIncome,
        };
      });
      localStorage.setItem(salariesDraftKey, JSON.stringify(draft));
    }, 600);
    return () => clearTimeout(timer);
  }, [rows, loadingData, salariesDraftKey]);

  const computeRow = useCallback((r: SalaryRow) => {
    const totalPlatformSalary = Number(r.engineBaseSalary || 0);
    const totalAdditions = r.incentives + r.sickAllowance;
    const totalWithSalary = totalPlatformSalary + totalAdditions;
    const totalDeductions = getTotalDeductions(r);
    const netSalary = totalWithSalary - totalDeductions;
    const remaining = netSalary - r.transfer;
    return { totalPlatformSalary, totalAdditions, totalWithSalary, totalDeductions, netSalary, remaining };
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── City filter for salaries table
  const [cityFilter, setCityFilter] = useState('all');

  const filteredBase = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchSearch = q === '' || r.employeeName.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchCity = cityFilter === 'all' || r.city === (cityFilter === 'makkah' ? 'مكة' : 'جدة');
      return matchSearch && matchStatus && matchCity;
    });
  }, [rows, search, statusFilter, cityFilter]);

  const filtered = useMemo(() => {
    if (!sortField || !sortDir) return filteredBase;
    const getSortValue = (row: SalaryRow) => {
      const computed = computeRow(row);
      switch (sortField) {
        case 'employeeName': return row.employeeName;
        case 'jobTitle': return row.jobTitle;
        case 'nationalId': return row.nationalId;
        case 'platformSalaries': return computed.totalPlatformSalary;
        case 'incentives': return row.incentives;
        case 'totalAdditions': return computed.totalAdditions;
        case 'advanceDeduction': return row.advanceDeduction;
        case 'totalDeductions': return computed.totalDeductions;
        case 'netSalary': return computed.netSalary;
        case 'status': return row.status;
        default:
          if (platforms.includes(sortField)) return row.platformOrders[sortField] || 0;
          return toComparableSortValue((row as Record<string, unknown>)[sortField]);
      }
    };

    return [...filteredBase].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBase, sortField, sortDir, computeRow, platforms]);

  const updateRow = useCallback((id: string, patch: Partial<SalaryRow>) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      // Mark as dirty if editing after approved/paid
      if (r.status !== 'pending' && !('status' in patch) && !('isDirty' in patch)) {
        updated.isDirty = true;
      }
      return updated;
    }));
    if (payslipRow?.id === id) setPayslipRow(prev => prev ? { ...prev, ...patch } : prev);
  }, [payslipRow]);

  const updatePlatformOrders = (id: string, platform: string, value: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newOrders = { ...r.platformOrders, [platform]: value };
      const appId = appIdByName[platform];
      const appRules = appId ? (pricingRulesByAppId[appId] || []) : [];
      const ruleResult = salaryService.applyPricingRules(appRules, value);
      let salary = Math.round(ruleResult.salary || 0);
      if (!ruleResult.matchedRule) {
        // Fallback to scheme behavior when pricing_rules are not configured.
        const scheme = empPlatformScheme?.[r.employeeId]?.[platform];
        if (scheme?.salary_scheme_tiers) {
          salary = salaryService.calculateTierSalary(
            value,
            scheme.salary_scheme_tiers as SalarySchemeTier[],
            scheme.target_orders,
            scheme.target_bonus
          );
        }
      }
      const newSalaries = { ...r.platformSalaries, [platform]: salary };
      const isDirty = r.status !== 'pending' ? true : r.isDirty;
      return { ...r, platformOrders: newOrders, platformSalaries: newSalaries, isDirty };
    }));
  };

  const approveRow = async (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    if (!isEmployeeIdUuid(row.employeeId) || !isValidSalaryMonthYear(selectedMonth)) {
      toast({
        title: 'تعذّر الاعتماد',
        description: 'معرف الموظف أو الشهر غير صالح',
        variant: 'destructive',
      });
      return;
    }
    const manualDeduction = getManualDeductionTotal(row);
    const { data: calcData, error: calcError } = await salaryDataService.calculateSalaryForEmployeeMonth(
      row.employeeId,
      selectedMonth,
      row.paymentMethod,
      manualDeduction,
      null
    );
    if (calcError) {
      toast({ title: 'تعذّر حساب الراتب من الخادم', description: calcError.message, variant: 'destructive' });
      return;
    }
    const calc = (Array.isArray(calcData) ? calcData[0] : calcData) as Record<string, number> | undefined;
    const baseSalary = Number(calc?.base_salary ?? 0);
    const advanceDeduction = Number(calc?.advance_deduction ?? row.advanceDeduction ?? 0);
    const externalDeduction = Number(calc?.external_deduction ?? row.externalDeduction ?? 0);
    const totalAdditions = row.incentives + row.sickAllowance;
    const totalDeductions = row.violations + manualDeduction + advanceDeduction + externalDeduction;
    const netSalary = Math.max(baseSalary + totalAdditions - totalDeductions, 0);

    const { error } = await salaryDataService.upsertSalaryRecord({
      employee_id: row.employeeId,
      month_year: selectedMonth,
      base_salary: baseSalary,
      allowances: totalAdditions,
      attendance_deduction: row.violations,
      advance_deduction: advanceDeduction,
      external_deduction: externalDeduction,
      manual_deduction: manualDeduction,
      net_salary: netSalary,
      is_approved: true,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    });
    if (error) {
      toast({ title: 'تعذّر حفظ الاعتماد', description: error.message, variant: 'destructive' });
      return;
    }
    updateRow(id, { status: 'approved', isDirty: false, advanceDeduction, externalDeduction });
    toast({ title: '✅ تم اعتماد الراتب' });
    if (row.phone) {
      const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
      sendWhatsAppMessage(row.phone, `مرحباً ${row.employeeName} 👋\n\nتم اعتماد راتبك لشهر ${monthLabel}\nصافي الراتب: ${netSalary.toLocaleString()} ر.س\n\nللاستفسار تواصل مع الإدارة.`)
        .then(ok => { if (!ok) toast({ title: 'تعذّر إرسال إشعار واتساب' }); });
    }
  };

  const computeServerSalaryForPayment = useCallback(async (row: SalaryRow, monthYear: string) => {
    const manualDeduction = getManualDeductionTotal(row);
    const { data: calcData, error: calcError } = await salaryDataService.calculateSalaryForEmployeeMonth(
      row.employeeId,
      monthYear,
      row.paymentMethod,
      manualDeduction,
      null
    );
    if (calcError) throw calcError;
    const calc = (Array.isArray(calcData) ? calcData[0] : calcData) as Record<string, number> | undefined;
    const baseSalary = Number(calc?.base_salary ?? 0);
    const advanceDeduction = Number(calc?.advance_deduction ?? row.advanceDeduction ?? 0);
    const externalDeduction = Number(calc?.external_deduction ?? row.externalDeduction ?? 0);
    const totalAdditions = row.incentives + row.sickAllowance;
    const totalDeductions = row.violations + manualDeduction + advanceDeduction + externalDeduction;
    const netSalary = Math.max(baseSalary + totalAdditions - totalDeductions, 0);
    return { manualDeduction, baseSalary, advanceDeduction, externalDeduction, totalAdditions, netSalary };
  }, []);

  const settleAdvanceInstallments = useCallback(async (row: SalaryRow, nowStr: string) => {
    if (row.advanceInstallmentIds.length === 0) return;

    await salaryDataService.markInstallmentsDeducted(row.advanceInstallmentIds, nowStr);
    const { data: instData } = await salaryDataService.getInstallmentsByIds(row.advanceInstallmentIds);
    if (!instData) return;

    const advanceIds = [...new Set(instData.map(i => i.advance_id))];
    for (const advId of advanceIds) {
      const { data: allInsts } = await salaryDataService.getAdvanceInstallmentStatuses(advId);
      if (allInsts?.every(i => i.status === 'deducted')) {
        await salaryDataService.markAdvanceCompleted(advId);
      }
    }
  }, []);

  // ── Mark as PAID: save to salary_records + update installments + complete advance ──
  const markAsPaid = async (row: SalaryRow) => {
    if (!isEmployeeIdUuid(row.employeeId) || !isValidSalaryMonthYear(selectedMonth)) {
      toast({
        title: 'تعذّر الصرف',
        description: 'معرف الموظف أو الشهر غير صالح',
        variant: 'destructive',
      });
      return;
    }
    setMarkingPaid(row.id);
    try {
      const { manualDeduction, baseSalary, advanceDeduction, externalDeduction, totalAdditions, netSalary } =
        await computeServerSalaryForPayment(row, selectedMonth);
      const nowStr = new Date().toISOString();

      // 1. Upsert into salary_records
      const { error: srError } = await salaryDataService.upsertSalaryRecord({
        employee_id: row.employeeId,
        month_year: selectedMonth,
        base_salary: baseSalary,
        allowances: totalAdditions,
        attendance_deduction: row.violations,
        advance_deduction: advanceDeduction,
        external_deduction: externalDeduction,
        manual_deduction: manualDeduction,
        net_salary: netSalary,
        is_approved: true,
        approved_by: user?.id ?? null,
        approved_at: nowStr,
        payment_method: row.paymentMethod,
      });

      if (srError) throw srError;

      // 2. Mark installments as deducted (if any), then complete fully paid advances.
      await settleAdvanceInstallments(row, nowStr);

      updateRow(row.id, { status: 'paid', isDirty: false, advanceDeduction, externalDeduction });
      toast({ title: '✅ تم الصرف وحفظ سجل الراتب' });
      if (row.phone) {
        const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
        sendWhatsAppMessage(row.phone, `مرحباً ${row.employeeName} 👋\n\n✅ تم صرف راتبك لشهر ${monthLabel}\nالمبلغ: ${netSalary.toLocaleString()} ر.س\n\nشكراً لجهودك.`)
          .then(ok => { if (!ok) toast({ title: 'تعذّر إرسال إشعار واتساب' }); });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ أثناء الصرف', description: message, variant: 'destructive' });
    }
    setMarkingPaid(null);
  };

  const approveAll = async () => {
    const pendingRows = filtered.filter(r => r.status === 'pending');
    if (pendingRows.length === 0) return;
    if (!isValidSalaryMonthYear(selectedMonth)) {
      toast({ title: 'خطأ', description: 'الشهر المحدد غير صالح', variant: 'destructive' });
      return;
    }

    const { data: monthCalcData, error: monthCalcError } = await salaryDataService.calculateSalaryForMonth(selectedMonth);
    if (monthCalcError) {
      toast({ title: 'خطأ أثناء الحساب من الخادم', description: monthCalcError.message, variant: 'destructive' });
      return;
    }
    const monthCalcMap = new Map<string, Record<string, number>>(
      (Array.isArray(monthCalcData) ? monthCalcData : []).map((item) => [
        String((item as Record<string, unknown>).employee_id),
        item as Record<string, number>,
      ])
    );

    // Upsert all to salary_records
    const nowStr = new Date().toISOString();
    const records = pendingRows.map(row => {
      const calc = monthCalcMap.get(row.employeeId);
      const manualDeduction = getManualDeductionTotal(row);
      const baseSalary = Number(calc?.base_salary ?? 0);
      const advanceDeduction = Number(calc?.advance_deduction ?? row.advanceDeduction ?? 0);
      const externalDeduction = Number(calc?.external_deduction ?? row.externalDeduction ?? 0);
      const totalAdditions = row.incentives + row.sickAllowance;
      const totalDeductions = row.violations + manualDeduction + advanceDeduction + externalDeduction;
      const netSalary = Math.max(baseSalary + totalAdditions - totalDeductions, 0);

      return {
        employee_id: row.employeeId,
        month_year: selectedMonth,
        base_salary: baseSalary,
        allowances: totalAdditions,
        attendance_deduction: row.violations,
        advance_deduction: advanceDeduction,
        external_deduction: externalDeduction,
        manual_deduction: manualDeduction,
        net_salary: netSalary,
        is_approved: true,
        approved_by: user?.id ?? null,
        approved_at: nowStr,
      };
    });

    const { error } = await salaryDataService.upsertSalaryRecords(records);
    if (error) {
      toast({ title: 'خطأ أثناء الاعتماد', description: error.message, variant: 'destructive' });
      return;
    }

    const pendingIds = pendingRows.map(r => r.id);
    setRows(prev => prev.map(r => pendingIds.includes(r.id) ? { ...r, status: 'approved' as const } : r));
    toast({ title: `✅ تم اعتماد ${pendingRows.length} راتب وحفظها` });
  };

  // ── Batch ZIP export: capture each slip sequentially ─────────
  useEffect(() => {
    if (batchQueue.length === 0 || !batchZip) return;
    if (batchIndex >= batchQueue.length) {
      // All done — generate & download ZIP
      const [y, m] = selectedMonth.split('-');
      batchZip.generateAsync({ type: 'blob' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `كشوف_رواتب_${m}_${y}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: `✅ تم تحميل ${batchQueue.length} كشف راتب في ملف ZIP` });
        setBatchQueue([]);
        setBatchIndex(0);
        setBatchZip(null);
      });
      return;
    }

    // Wait a tick so React paints the hidden slip
    const timer = setTimeout(async () => {
      if (!batchSlipRef.current) return;
      try {
        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(batchSlipRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const JsPdf = await loadJsPdf();
        const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, Math.min(imgHeight, pdf.internal.pageSize.getHeight()));
        const pdfBlob = pdf.output('blob');
        const row = batchQueue[batchIndex];
        const safeName = row.employeeName.replace(/\s+/g, '_');
        const [y, m] = selectedMonth.split('-');
        batchZip.file(`كشف_راتب_${safeName}_${m}_${y}.pdf`, pdfBlob);
        setBatchIndex(i => i + 1);
      } catch (e) {
        setBatchIndex(i => i + 1); // skip on error
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [batchIndex, batchQueue, batchZip, selectedMonth, toast]);

  const startBatchZipExport = () => {
    if (filtered.length === 0) { toast({ title: 'لا توجد بيانات للتصدير' }); return; }
    const zip = new JSZip();
    const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
    setBatchMonth(monthLabel);
    setBatchZip(zip);
    setBatchIndex(0);
    setBatchQueue([...filtered]);
    toast({ title: `⏳ جارٍ تجهيز ${filtered.length} كشف راتب...`, description: 'يرجى الانتظار حتى يكتمل التحميل' });
  };

  const totalNet = filtered.reduce((s, r) => s + computeRow(r).netSalary, 0);
  const pendingCount = filtered.filter(r => r.status === 'pending').length;
  const approvedCount = filtered.filter(r => r.status === 'approved').length;
  const paidCount = filtered.filter(r => r.status === 'paid').length;

  const exportExcel = async () => {
    const XLSX = await loadXlsx();
    const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
    const data = filtered.map(r => {
      const c = computeRow(r);
      const row: Record<string, string | number> = {
        'الاسم': r.employeeName,
        'المسمى الوظيفي': r.jobTitle,
        'رقم الهوية': r.nationalId,
      };
      platforms.forEach(p => {
        row[p] = r.registeredApps.includes(p) ? (r.platformOrders[p] || 0) : '—';
      });
      row['إجمالي الراتب الأساسي'] = c.totalPlatformSalary;
      row['الحوافز'] = r.incentives;
      row['بدل مرضي'] = r.sickAllowance;
      row['إجمالي الإضافات'] = c.totalAdditions;
      row['المجموع مع الراتب'] = c.totalWithSalary;
      row['قسط سلفة'] = r.advanceDeduction;
      row['خصومات خارجية'] = r.externalDeduction;
      row['المخالفات'] = r.violations;
      row['إجمالي المستقطعات'] = c.totalDeductions;
      row['إجمالي الراتب'] = c.netSalary;
      row['التحويل'] = r.transfer;
      row['المتبقي'] = c.remaining;
      row['طريقة الصرف'] = r.bankAccount ? 'بنكي' : 'كاش';
      row['المدينة'] = r.city;
      row['الحالة'] = statusLabels[r.status];
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الرواتب');
    const [year, month] = selectedMonth.split('-');
    XLSX.writeFile(wb, `رواتب_${month}_${year}.xlsx`);
    toast({ title: '📊 تم التصدير بنجاح' });
  };

  // ── Formatted print for salary table ─────────────────────────────
  const handlePrintTable = () => {
    const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
    const printRows = filtered;
    if (printRows.length === 0) { toast({ title: 'لا يوجد بيانات للطباعة' }); return; }

    const rows = printRows.map(r => {
      const c = computeRow(r);
      const platformCols = platforms.map(p =>
        r.registeredApps.includes(p)
          ? `<td style="text-align:center">${r.platformOrders[p] || 0}</td>`
          : `<td style="text-align:center;color:#ccc">—</td>`
      ).join('');
      const statusStyle = getStatusStyleForPrint(r.status);
      const statusLabel = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' }[r.status];
      return `<tr>
        <td>${escapeHtml(r.employeeName)}</td>
        <td style="text-align:center;color:#555;font-size:11px">${escapeHtml(r.nationalId || '—')}</td>
        ${platformCols}
        <td style="text-align:center;font-weight:700;color:#1d4ed8">${c.totalPlatformSalary.toLocaleString()}</td>
        <td style="text-align:center">${c.totalAdditions > 0 ? `+${c.totalAdditions.toLocaleString()}` : '—'}</td>
        <td style="text-align:center;color:#dc2626">${c.totalDeductions > 0 ? `-${c.totalDeductions.toLocaleString()}` : '—'}</td>
        <td style="text-align:center;font-weight:800;font-size:14px;color:#15803d">${c.netSalary.toLocaleString()} ر.س</td>
        <td style="text-align:center">${r.transfer > 0 ? r.transfer.toLocaleString() : '—'}</td>
        <td style="text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;${statusStyle}">${statusLabel}</span></td>
      </tr>`;
    }).join('');

    const platformHeaders = platforms.map(p =>
      `<th style="background:#4f46e5;color:#fff">${escapeHtml(p)}</th>`
    ).join('');

    const totalNet = printRows.reduce((s, r) => s + computeRow(r).netSalary, 0);
    const totalPlatformSalary = printRows.reduce((s, r) => s + computeRow(r).totalPlatformSalary, 0);
    const totalDeductions = printRows.reduce((s, r) => s + computeRow(r).totalDeductions, 0);

    const html = `<!DOCTYPE html><html dir="rtl"><head>
      <meta charset="utf-8">
      <title>تقرير رواتب — ${monthLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #111; background: #fff; font-size: 12px; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px; }
        .company-name { font-size: 22px; font-weight: 900; color: #4f46e5; }
        .report-title { font-size: 15px; font-weight: 700; color: #333; margin-top: 4px; }
        .report-meta { font-size: 11px; color: #777; margin-top: 2px; }
        .summary { display: flex; gap: 16px; margin-bottom: 18px; }
        .summary-card { flex: 1; background: #f8f9ff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
        .summary-label { font-size: 10px; color: #888; }
        .summary-value { font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { padding: 8px 10px; background: #f3f4f6; color: #555; font-size: 11px; text-align: center; border: 1px solid #ddd; white-space: nowrap; }
        th:first-child { text-align: right; }
        td { padding: 7px 10px; border: 1px solid #e5e7eb; font-size: 12px; white-space: nowrap; }
        tr:nth-child(even) { background: #f9f9ff; }
        tr:hover { background: #f0f0ff; }
        .tfoot td { background: #eff6ff; font-weight: 800; border-top: 2px solid #4f46e5; }
        .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 14px; }
        @media print {
          body { padding: 8px; }
          .no-print { display: none; }
          @page { margin: 10mm; size: landscape; }
        }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="company-name">${escapeHtml(projectName || 'مهمة التوصيل')}</div>
          <div class="report-title">تقرير الرواتب الشهرية</div>
          <div class="report-meta">${monthLabel} • تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} • عدد الموظفين: ${printRows.length}</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:11px;color:#888">إجمالي صافي الرواتب</div>
          <div style="font-size:24px;font-weight:900;color:#15803d">${totalNet.toLocaleString()} ر.س</div>
        </div>
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="summary-label">إجمالي الرواتب الأساسية</div>
          <div class="summary-value" style="color:#1d4ed8">${totalPlatformSalary.toLocaleString()} ر.س</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">إجمالي المستقطعات</div>
          <div class="summary-value" style="color:#dc2626">${totalDeductions.toLocaleString()} ر.س</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">صافي الرواتب</div>
          <div class="summary-value" style="color:#15803d">${totalNet.toLocaleString()} ر.س</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">عدد الموظفين</div>
          <div class="summary-value">${printRows.length}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align:right">اسم الموظف</th>
            <th>رقم الهوية</th>
            ${platformHeaders}
            <th>الراتب الأساسي</th>
            <th>الإضافات</th>
            <th>المستقطعات</th>
            <th style="background:#dcfce7;color:#15803d">الصافي</th>
            <th>التحويل</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="tfoot">
            <td><strong>الإجمالي (${printRows.length} موظف)</strong></td>
            <td></td>
            ${platforms.map(() => '<td></td>').join('')}
            <td style="text-align:center;color:#1d4ed8">${totalPlatformSalary.toLocaleString()}</td>
            <td></td>
            <td style="text-align:center;color:#dc2626">-${totalDeductions.toLocaleString()}</td>
            <td style="text-align:center;color:#15803d;font-size:15px">${totalNet.toLocaleString()} ر.س</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="footer">
        <span>توقيع المدير المالي: _______________________</span>
        <span>توقيع المدير العام: _______________________</span>
        <span>تاريخ الاعتماد: _______________________</span>
      </div>
    </body></html>`;

    const win = globalThis.open('', '_blank', 'width=1100,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  };

  const downloadSalaryTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = [Array.from(SALARY_IMPORT_TEMPLATE_HEADERS)];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'رواتب');
    XLSX.writeFile(wb, 'قالب_استيراد_الرواتب.xlsx');
  };

  const handleSalaryImportFile = async (file: File) => {
    setSalaryActionLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const { rows: parsed, parseErrors } = parseSalaryImportWorkbook(buf, { defaultMonthYear: selectedMonth });
      if (parsed.length === 0) {
        toast({
          title: 'بيانات ناقصة في ملف الإكسيل',
          description: parseErrors.slice(0, 5).join(' · ') || 'لا توجد صفوف صالحة',
          variant: 'destructive',
        });
        return;
      }
      const records = parsed.map((p) => p.record);
      const { error } = await salaryDataService.upsertSalaryRecords(records);
      if (error) throw error;
      await auditService.logAdminAction({
        action: 'salary_records.import_excel',
        table_name: 'salary_records',
        record_id: null,
        meta: { count: parsed.length, month: selectedMonth },
      });
      await queryClient.invalidateQueries({ queryKey: ['salaries', uid, 'base-context', selectedMonth] });
      toast({ title: `تم استيراد ${parsed.length} سجل بنجاح` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'فشل الاستيراد';
      toast({ title: 'فشل الاستيراد', description: msg, variant: 'destructive' });
    } finally {
      setSalaryActionLoading(false);
    }
  };

  const runExportExcel = async () => {
    setSalaryActionLoading(true);
    try {
      exportExcel();
    } finally {
      setSalaryActionLoading(false);
    }
  };

  const runPrintTable = async () => {
    setSalaryActionLoading(true);
    try {
      handlePrintTable();
    } finally {
      setSalaryActionLoading(false);
    }
  };

  // ── Download individual PDFs — one file per employee named after them ──
  const downloadAllPDFs = async () => {
    const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
    const toPrint = filtered;
    if (toPrint.length === 0) { toast({ title: 'لا يوجد بيانات للتحميل' }); return; }

    const autoTableMod = await import('jspdf-autotable');
    const autoTable = autoTableMod.default;

    for (const row of toPrint) {
          const c = computeRow(row);
          const [y, m] = selectedMonth.split('-');
          const JsPdf = await loadJsPdf();
          const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const docWithTables = doc as jsPDF & { lastAutoTable?: { finalY: number } };
          const lastAutoTableY = () => docWithTables.lastAutoTable?.finalY ?? 40;

          // Header
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.setTextColor(79, 70, 229);
          doc.text('Salary Slip / كشف راتب', 105, 18, { align: 'center' });
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(`${monthLabel}  |  ${new Date().toLocaleDateString()}`, 105, 25, { align: 'center' });

          // Info table
          autoTable(doc, {
            startY: 32,
            body: [
              ['Employee / الاسم', row.employeeName, 'ID / الهوية', row.nationalId],
              ['City / المدينة', row.city, 'Payment / طريقة الدفع', row.paymentMethod === 'bank' ? 'Bank' : 'Cash'],
            ],
            styles: { fontSize: 9, cellPadding: 2.5 },
            alternateRowStyles: { fillColor: [245, 245, 255] },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 255] }, 2: { fontStyle: 'bold', fillColor: [240, 240, 255] } },
          });

          // Platform orders
          const platformBody = row.registeredApps.map(app => [
            app,
            (row.platformOrders[app] || 0).toLocaleString(),
            (row.platformSalaries[app] || 0).toLocaleString() + ' SAR',
          ]);
          platformBody.push(['Total / الإجمالي', '', c.totalPlatformSalary.toLocaleString() + ' SAR']);

          autoTable(doc, {
            startY: lastAutoTableY() + 6,
            head: [['Platform / المنصة', 'Orders / الطلبات', 'Salary / الراتب']],
            body: platformBody,
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, halign: 'center' },
            columnStyles: { 0: { halign: 'left' } },
          });

          // Deductions if any
          if (c.totalDeductions > 0) {
            const dedBody: string[][] = [];
            if (row.advanceDeduction > 0) dedBody.push(['Advance / سلفة', `-${row.advanceDeduction.toLocaleString()} SAR`]);
            if (row.externalDeduction > 0) dedBody.push(['External / خارجي', `-${row.externalDeduction.toLocaleString()} SAR`]);
            if (row.violations > 0) dedBody.push(['Violations / مخالفات', `-${row.violations.toLocaleString()} SAR`]);
            dedBody.push(['Total Deductions', `-${c.totalDeductions.toLocaleString()} SAR`]);
            autoTable(doc, {
              startY: lastAutoTableY() + 6,
              head: [['Deductions / المستقطعات', 'Amount / المبلغ']],
              body: dedBody,
              headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
              styles: { fontSize: 9 },
            });
          }

          // Net salary
          autoTable(doc, {
            startY: lastAutoTableY() + 6,
            body: [['Net Salary / الراتب الصافي', c.netSalary.toLocaleString() + ' SAR']],
            styles: { fontSize: 12, fontStyle: 'bold', fillColor: [240, 253, 244], textColor: [22, 163, 74], cellPadding: 4 },
          });

          // Footer signature
          const finalY = lastAutoTableY() + 20;
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Employee Signature: ___________________', 20, finalY);
          doc.text('Manager Approval: ___________________', 120, finalY);

          const safeName = row.employeeName.replace(/\s+/g, '_');
          doc.save(`كشف_راتب_${safeName}_${m}_${y}.pdf`);
    }

    toast({ title: `⬇️ جارٍ تحميل ${toPrint.length} ملف PDF...` });
  };

  // ── Merged PDF: all employees in a single printable page ──
  const exportMergedPDF = () => {
    const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
    const toPrint = filtered;
    if (toPrint.length === 0) { toast({ title: 'لا يوجد بيانات' }); return; }

    const pages = toPrint.map((row, idx) => {
      const c = computeRow(row);
      return `
      <div class="page-break${idx > 0 ? ' break-before' : ''}">
        <div class="header">
          <div>
            <div class="title">🚀 كشف راتب شهري</div>
            <div class="subtitle">${monthLabel}</div>
          </div>
          <span class="badge badge-${row.status}">${{ pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' }[row.status]}</span>
        </div>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">الاسم الكامل</span><span class="info-value">${escapeHtml(row.employeeName)}</span></div>
          <div class="info-row"><span class="info-label">رقم الهوية</span><span class="info-value">${escapeHtml(row.nationalId)}</span></div>
          <div class="info-row"><span class="info-label">المدينة</span><span class="info-value">${escapeHtml(row.city)}</span></div>
          <div class="info-row"><span class="info-label">طريقة الصرف</span><span class="info-value">${row.paymentMethod === 'bank' ? '🏦 بنكي' : '💵 كاش'}</span></div>
        </div>
        <h3>الطلبات والراتب حسب المنصة</h3>
        <table>
          <tr><td class="label" style="background:#e0e7ff;color:#4338ca;font-weight:700">المنصة</td>
              <td style="background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center">الطلبات</td>
              <td style="background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center">الراتب</td></tr>
          ${row.registeredApps.length > 0 ? row.registeredApps.map(app => {
            const orders = row.platformOrders[app] || 0;
            const salary = row.platformSalaries[app] || 0;
            return `<tr><td class="label">${escapeHtml(app)}</td><td style="text-align:center">${orders.toLocaleString()}</td><td class="val-blue" style="text-align:center">${salary.toLocaleString()} ر.س</td></tr>`;
          }).join('') : `<tr><td colspan="3" style="text-align:center;color:#999">لا توجد منصات مسجلة</td></tr>`}
          <tr class="total-row"><td class="label">إجمالي الراتب الأساسي</td><td></td><td class="val-blue" style="text-align:center">${c.totalPlatformSalary.toLocaleString()} ر.س</td></tr>
        </table>
        ${c.totalAdditions > 0 ? `
        <h3>الإضافات</h3>
        <table>
          ${row.incentives > 0 ? `<tr><td class="label">الحوافز</td><td class="val-green">+ ${row.incentives.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.sickAllowance > 0 ? `<tr><td class="label">بدل مرضي</td><td class="val-green">+ ${row.sickAllowance.toLocaleString()} ر.س</td></tr>` : ''}
          <tr class="total-row"><td class="label">المجموع مع الراتب</td><td class="val-blue">${c.totalWithSalary.toLocaleString()} ر.س</td></tr>
        </table>` : ''}
        ${c.totalDeductions > 0 ? `
        <h3>المستقطعات</h3>
        <table>
          ${row.advanceDeduction > 0 ? `<tr><td class="label">قسط سلفة</td><td class="val-red">- ${row.advanceDeduction.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.advanceRemaining > 0 ? `<tr><td class="label">رصيد السلفة المتبقي</td><td class="val-orange">${row.advanceRemaining.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.externalDeduction > 0 ? `<tr><td class="label">خصومات خارجية</td><td class="val-red">- ${row.externalDeduction.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.violations > 0 ? `<tr><td class="label">مخالفات</td><td class="val-red">- ${row.violations.toLocaleString()} ر.س</td></tr>` : ''}
          <tr class="deduction-total"><td class="label">إجمالي المستقطعات</td><td class="val-red">- ${c.totalDeductions.toLocaleString()} ر.س</td></tr>
        </table>` : ''}
        <h3>الصافي</h3>
        <table>
          <tr class="net-row"><td class="label">إجمالي الراتب الصافي</td><td class="val-green">${c.netSalary.toLocaleString()} ر.س</td></tr>
          ${row.transfer > 0 ? `<tr><td class="label">المبلغ المحوّل</td><td>${row.transfer.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.transfer > 0 ? `<tr><td class="label">المتبقي نقداً</td><td class="val-orange">${c.remaining.toLocaleString()} ر.س</td></tr>` : ''}
        </table>
        <div class="footer">
          <div>توقيع المندوب: _______________________</div>
          <div>اعتماد المدير: _______________________</div>
          <div>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
      </div>`;
    }).join('\n');

    const mergedHtml = `<html dir="rtl"><head><meta charset="utf-8">
    <title>كشوف الرواتب — ${monthLabel}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;padding:0;color:#1a1a1a;font-size:13px;background:#fff}
      .page-break{max-width:700px;margin:0 auto;padding:24px}
      .break-before{page-break-before:always}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px}
      .title{font-size:20px;font-weight:800;color:#4f46e5}
      .subtitle{font-size:11px;color:#666;margin-top:2px}
      .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700}
      .badge-paid{background:#dcfce7;color:#15803d}
      .badge-approved{background:#dbeafe;color:#1d4ed8}
      .badge-pending{background:#fef9c3;color:#b45309}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8f8ff;border-radius:8px;padding:12px;margin-bottom:14px}
      .info-row{display:flex;flex-direction:column}
      .info-label{font-size:10px;color:#888;margin-bottom:1px}
      .info-value{font-size:12px;font-weight:600;color:#111}
      h3{font-size:12px;font-weight:700;color:#4f46e5;margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px}
      table{width:100%;border-collapse:collapse;margin-bottom:10px}
      td{padding:7px 10px;border:1px solid #e5e7eb;font-size:12px}
      .label{background:#f3f4f6;font-weight:600;width:55%}
      .val-blue{color:#2563eb;font-weight:700}
      .val-green{color:#16a34a;font-weight:700}
      .val-red{color:#dc2626;font-weight:700}
      .val-orange{color:#ea580c;font-weight:600}
      .total-row td{background:#eff6ff;font-weight:700;font-size:13px}
      .deduction-total td{background:#fff1f2;font-weight:700}
      .net-row td{background:#f0fdf4;font-size:15px;font-weight:800}
      .footer{display:flex;justify-content:space-between;margin-top:28px;border-top:1px solid #ddd;padding-top:16px;font-size:11px;color:#555}
      @media print{body{padding:0}.page-break{padding:20px;max-width:100%}}
    </style></head><body>${pages}</body></html>`;

    const win = globalThis.open('', '_blank');
    if (win) {
      win.document.write(mergedHtml);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
    toast({ title: `📄 تم فتح ملف PDF مدمج لـ ${toPrint.length} مندوب` });
  };

  const totals = filtered.reduce((acc, r) => {
    const c = computeRow(r);
    platforms.forEach(p => {
      acc.platform[p] = (acc.platform[p] || 0) + (r.platformOrders[p] || 0);
    });
    acc.platformSalaries += c.totalPlatformSalary;
    acc.incentives += r.incentives;
    acc.sickAllowance += r.sickAllowance;
    acc.totalAdditions += c.totalAdditions;
    acc.totalWithSalary += c.totalWithSalary;
    acc.advance += r.advanceDeduction;
    acc.externalDed += r.externalDeduction;
    acc.violations += r.violations;
    acc.totalDed += c.totalDeductions;
    acc.net += c.netSalary;
    acc.transfer += r.transfer;
    acc.remaining += c.remaining;
    return acc;
  }, {
    platform: {} as Record<string, number>,
    platformSalaries: 0, incentives: 0, sickAllowance: 0,
    totalAdditions: 0, totalWithSalary: 0,
    advance: 0, externalDed: 0, violations: 0,
    totalDed: 0, net: 0, transfer: 0, remaining: 0,
  });

  const ThSort = ({ field, label, className = '' }: { field: string; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border border-border/60 text-center cursor-pointer select-none hover:brightness-90 transition-all ${className}`}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  );

  const thFrozenBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border border-border/40 bg-muted/60 text-right sticky z-20";
  const thBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border border-border/40 bg-muted/50 text-center";
  const tdClass = "px-3 py-2 text-xs whitespace-nowrap text-center border border-border/40 text-foreground";
  const tfClass = "px-3 py-2 text-xs font-bold whitespace-nowrap text-center border border-border/40 bg-muted/60 text-foreground";
  const stickyLeft = (offset: number) => ({ left: offset });

  const [detailRow, setDetailRow] = useState<SalaryRow | null>(null);
  const [detailOrders, setDetailOrders] = useState<{appName: string; orders: number; salary: number}[]>([]);

  const openEmployeeDetail = (row: SalaryRow) => {
    setDetailRow(row);
    // Build orders breakdown from row data
    const orders = platforms
      .filter(p => row.registeredApps.includes(p))
      .map(p => ({
        appName: p,
        orders: row.platformOrders[p] || 0,
        salary: row.platformSalaries[p] || 0,
      }));
    setDetailOrders(orders);
  };

  if (pageMode === 'fast') {
    return (
      <SalariesFastList
        monthYear={selectedMonth}
        branch={fastFilters.branch}
        search={fastFilters.search}
        approved={fastApproved}
        onApprovedChange={setFastApproved}
        onFiltersChange={(next) => { setFastFilters(next); setFastPage(1); }}
        page={fastPage}
        pageSize={fastPageSize}
        onPageChange={setFastPage}
        onBack={() => setPageMode('detailed')}
        onSalaryTemplate={downloadSalaryTemplate}
        onSalaryImport={handleSalaryImportFile}
        salaryActionLoading={salaryActionLoading}
      />
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>الرواتب الشهرية</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><Wallet size={20} /> الرواتب الشهرية</h1>
          <div className="mt-1">
            {renderEngineStatusBadge(loadingData, previewBackendError)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPageMode('fast')}>
            <Table2 size={16} />
            <span>قائمة (سريعة)</span>
          </Button>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-background text-xs"
          >
            {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards — total + per-platform + admin */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))` }}>
        {/* Total Grand Card */}
        <div className="bg-card border-t-4 border-primary rounded-xl p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-tight">إجمالي الرواتب</p>
              <p className="text-[22px] font-semibold text-foreground leading-tight mt-1">{totalNet.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ريال سعودي</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={14} className="text-primary" />
            </div>
          </div>
        </div>

        {/* Per-platform cards */}
        {platforms.map(p => {
          const pc = platformColors[p];
          const platformTotal = filtered.reduce((s, r) => s + (r.platformSalaries[p] || 0), 0);
          return (
            <div key={p} className="bg-card rounded-xl p-4 shadow-card border-t-4" style={{ borderTopColor: pc?.header || 'hsl(var(--primary))' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight truncate">{p}</p>
                  <p className="text-[22px] font-semibold text-foreground leading-tight mt-1">{platformTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">ريال سعودي</p>
                </div>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${pc?.header}20` }}>
                  <Users size={14} style={{ color: pc?.header || 'hsl(var(--primary))' }} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Admin salaries card */}
        {(() => {
          const adminTotal = filtered
            .filter(r => r.jobTitle !== 'مندوب توصيل' && r.jobTitle !== 'Delivery Rider')
            .reduce((s, r) => s + computeRow(r).netSalary, 0);
          return (
            <div className="bg-card border-t-4 border-muted-foreground/30 rounded-xl p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight">الرواتب الإدارية</p>
                  <p className="text-[22px] font-semibold text-foreground leading-tight mt-1">{adminTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">ريال سعودي</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 size={14} className="text-muted-foreground" />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Setup Required Banner — unified to avoid duplicate alerts */}
      {previewBackendError && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-destructive flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">المعاينة الخلفية غير متاحة</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              تم إيقاف الحساب المحلي حفاظاً على الدقة. {previewBackendError}
            </p>
          </div>
        </div>
      )}

      {(appsWithoutScheme.length > 0 || appsWithoutPricingRulesDeduped.length > 0) && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">إعداد مطلوب للمنصات</p>
            {appsWithoutScheme.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                بدون سكيمة رواتب:{' '}
                <span className="font-semibold text-warning mr-1">{appsWithoutScheme.join(' · ')}</span>
              </p>
            )}
            {appsWithoutPricingRulesDeduped.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                بدون Pricing Rules:{' '}
                <span className="font-semibold text-warning mr-1">{appsWithoutPricingRulesDeduped.join(' · ')}</span>
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-warning/40 text-warning hover:bg-warning/10 flex-shrink-0"
            onClick={() => navigate('/settings/schemes')}
          >
            <Settings2 size={13} />
            <span>فتح الإعداد</span>
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9 h-9 w-48" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {[{ v: 'all', l: 'الكل' }, { v: 'approved', l: 'معتمد' }, { v: 'paid', l: 'مصروف' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mr-auto items-center">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <Table2 size={13} /> جدول
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs border-r border-l border-border transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid size={13} /> بطاقات
            </button>
          </div>
          {pendingCount > 0 && (
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={approveAll}>
              <CheckCircle size={13} /> اعتماد الكل ({pendingCount})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-9"><FolderOpen size={14} /> أدوات إضافية</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={startBatchZipExport}
                disabled={batchQueue.length > 0}
              >
                <Archive size={13} className="ml-2" />
                {batchQueue.length > 0 ? `جارٍ التصدير ${batchIndex}/${batchQueue.length}...` : 'تحميل ZIP كل الكشوف'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportMergedPDF}>
                <FileText size={13} className="ml-2" /> PDF مدمج للكل
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 shadow-sm">
        <TableActions
          loading={salaryActionLoading}
          onDownloadTemplate={downloadSalaryTemplate}
          onImportFile={handleSalaryImportFile}
          onExport={runExportExcel}
          onPrint={runPrintTable}
        />
      </div>

      {/* Progress bar for batch ZIP export */}
      {batchQueue.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <Archive size={14} className="text-primary flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-primary font-medium">جارٍ تجهيز كشوف الرواتب ({batchMonth})</span>
              <span className="text-muted-foreground">{batchIndex} / {batchQueue.length}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(batchIndex / batchQueue.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cards view */}
      {viewMode === 'cards' && (
        <div>
          {loadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {SALARY_CARD_SKELETON_KEYS.map((skeletonKey) => (
                <div key={skeletonKey} className="bg-card border border-border/50 rounded-xl p-4 space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded mt-3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground rounded-xl border border-border/50">
              لا يوجد موظفون لهذا الشهر
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(r => {
                const c = computeRow(r);
                return (
                  <div key={r.id} className="bg-card border border-border/50 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {r.employeeName.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.employeeName}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.jobTitle}</p>
                      </div>
                      <span className={statusStyles[r.status]}>{statusLabels[r.status]}</span>
                    </div>
                    {r.registeredApps.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.registeredApps.map(app => (
                          <span key={app} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-muted text-muted-foreground">
                            {app}: {r.platformOrders[app] || 0}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-muted-foreground">الراتب الأساسي</p>
                        <p className="font-bold text-primary">{c.totalPlatformSalary.toLocaleString()} ر.س</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-muted-foreground">المستقطعات</p>
                        <p className="font-bold text-destructive">{c.totalDeductions > 0 ? `-${c.totalDeductions.toLocaleString()}` : '—'} {c.totalDeductions > 0 ? 'ر.س' : ''}</p>
                      </div>
                    </div>
                    {r.advanceDeduction > 0 && (
                      <div className="text-[10px] bg-warning/10 rounded px-2 py-1 text-warning border border-warning/30">
                        💳 قسط سلفة: <span className="font-bold">{r.advanceDeduction.toLocaleString()} ر.س</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-success/10 rounded-lg px-3 py-2 mt-auto">
                      <span className="text-xs text-muted-foreground">الصافي</span>
                      <span className="text-base font-black text-success">{c.netSalary.toLocaleString()} ر.س</span>
                    </div>
                    <div className="flex gap-2">
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-success border-success/30 hover:bg-success/10" onClick={() => approveRow(r.id)}>
                          <CheckCircle size={11} /> اعتماد
                        </Button>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                          onClick={() => markAsPaid(r)} disabled={markingPaid === r.id}>
                          {markingPaid === r.id ? '...' : '✅ تم الصرف'}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => setPayslipRow(r)}>
                        <Printer size={11} /> كشف راتب
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Wide table */}
      {viewMode === 'table' && (() => {
        // Build all custom deduction column definitions across all active apps
        const allCustomCols: { appName: string; key: string; label: string; fullKey: string }[] = [];
        platforms.forEach(p => {
          (appCustomColumns[p] || []).forEach(col => {
            allCustomCols.push({ appName: p, key: col.key, label: col.label, fullKey: `${p}___${col.key}` });
          });
        });
        // Fixed deduction columns count: سلف (manual), violations + dynamic custom cols + total = 2 + allCustomCols.length + 1
        const dedColCount = 2 + allCustomCols.length + 1;
        return (
      <div className="rounded-xl shadow-card bg-card overflow-hidden">
        {loadingData && (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            جارٍ تحميل بيانات الرواتب...
          </div>
        )}
        {!loadingData && rows.length === 0 && (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            لا يوجد موظفون نشطون أو بيانات لهذا الشهر
          </div>
        )}
        {!loadingData && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse" style={{ minWidth: 1800 }}>
              <thead className="sticky top-0 z-30">
                <tr className="bg-muted/70 border-b border-border/50">
                  <th className={`${thFrozenBase} w-10 text-center`} style={stickyLeft(0)}>#</th>
                  <th colSpan={3} className={`${thFrozenBase} border-l border-border/50`} style={stickyLeft(40)}>بيانات المندوب</th>
                  <th colSpan={3} className="px-3 py-2 text-xs font-semibold text-info whitespace-nowrap border-b border-border/40 bg-info/10 text-center border-l border-border/40">📊 بيانات المندوب الشهرية</th>
                  <th colSpan={platforms.length} className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">
                    المنصات (نقر مزدوج لتعديل الطلبات)
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/40 bg-primary/10 text-center border-l border-border/40">إجمالي الطلبات + الراتب الثابت</th>
                  <th colSpan={4} className="px-3 py-2 text-xs font-semibold text-success whitespace-nowrap border-b border-border/40 bg-success/10 text-center border-l border-border/40">✅ الإضافات</th>
                  <th colSpan={dedColCount} className="px-3 py-2 text-xs font-semibold text-destructive whitespace-nowrap border-b border-border/40 bg-destructive/10 text-center border-l border-border/40">🔻 المستقطعات</th>
                  <th colSpan={1} className="px-3 py-2 text-xs font-semibold text-success whitespace-nowrap border-b border-border/40 bg-muted/40 text-center border-l border-border/40">المستحق</th>
                  <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/40 bg-muted/40 text-center border-l border-border/40">معلومات الصرف</th>
                  <th colSpan={1} className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/40 bg-muted/40 text-center border-l border-border/40">الإجراءات</th>
                </tr>
                <tr className="bg-muted/50">
                  <th className={`${thFrozenBase} w-10 text-center`} style={stickyLeft(0)}>#</th>
                  <th className={`${thFrozenBase} w-32 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(40)} onClick={() => handleSort('employeeName')}>
                    الاسم <SortIcon field="employeeName" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thFrozenBase} w-24 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(168)} onClick={() => handleSort('jobTitle')}>
                    المسمى الوظيفي <SortIcon field="jobTitle" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thFrozenBase} w-28 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(264)} onClick={() => handleSort('nationalId')}>
                    رقم الهوية <SortIcon field="nationalId" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {/* ── New info columns ── */}
                  <th className="px-2 py-2 text-xs font-semibold text-info whitespace-nowrap border border-border/40 bg-info/10 text-center cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('platformIncome')}>
                    دخل <SortIcon field="platformIncome" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="px-2 py-2 text-xs font-semibold text-info whitespace-nowrap border border-border/40 bg-info/10 text-center cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('workDays')}>
                    أيام العمل <SortIcon field="workDays" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="px-2 py-2 text-xs font-semibold text-info whitespace-nowrap border border-border/40 bg-info/10 text-center cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('fuelCost')}>
                    البنزين <SortIcon field="fuelCost" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {platforms.map(p => {
                    const pc = platformColors[p];
                    const headerScheme = empPlatformScheme
                      ? Object.values(empPlatformScheme).find(m => m[p])?.[p]
                      : null;
                    const schemeName = headerScheme?.name || '';
                    return (
                      <th key={`${p}-col`}
                        className="px-2 py-2 text-xs font-semibold whitespace-nowrap border-b border-l border-border/30 text-center cursor-pointer select-none hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: pc?.header, color: pc?.headerText }}
                        onClick={() => handleSort(p)}>
                         <div className="flex flex-col items-center gap-0">
                           <span>{p}</span>
                           <span className="text-[9px] opacity-80 font-normal">طلبات / راتب <SortIcon field={p} sortField={sortField} sortDir={sortDir} /></span>
                         </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-xs font-semibold text-foreground whitespace-nowrap border border-border/30 bg-primary/10 text-center cursor-pointer select-none hover:brightness-95" onClick={() => handleSort('totalPlatformOrders')}>
                    إجمالي الطلبات <SortIcon field="totalPlatformOrders" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thBase} bg-primary/10`}>الراتب الأساسي</th>
                  <th className={`${thBase} bg-success/5`}>حوافز</th>
                  <th className={`${thBase} bg-success/5`}>إجازة مرضية</th>
                  <th className={`${thBase} bg-success/5`}>إجمالي الإضافات</th>
                  <th className={`${thBase} bg-success/10 border-l border-border/40`}>الإجمالي مع الراتب</th>
                  <th className={`${thBase} bg-destructive/5`}>سلف</th>
                  <th className={`${thBase} bg-destructive/5`}>مخالفات</th>
                  {allCustomCols.map(col => (
                    <th key={col.fullKey} className={`${thBase} bg-destructive/5`}>{col.label}</th>
                  ))}
                  <th className={`${thBase} bg-destructive/10 border-l border-border/40`}>إجمالي المستقطعات</th>
                  <th className={thBase}>المستحق</th>
                  <th className={thBase}>المحوّل</th>
                  <th className={`${thBase} border-l border-border/40`}>المتبقي</th>
                  <th className={`${thBase} border-l border-border/50`}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, rowIdx) => {
                  const c = computeRow(r);
                  if (!c) return null;
                  return (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/25 transition-colors">
                      <td className={`${tdClass} sticky text-center text-xs text-muted-foreground font-mono`} style={{ left: 0, zIndex: 10, background: 'hsl(var(--card))' }}>{rowIdx + 1}</td>
                      <td className={`${tdClass} sticky font-medium whitespace-nowrap`} style={{ left: 40, zIndex: 10, background: 'hsl(var(--card))' }}>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="whitespace-nowrap text-primary hover:underline font-medium text-right"
                            onClick={() => openEmployeeDetail(r)}
                          >
                            {shortEmployeeName(r.employeeName)}
                          </button>
                          {r.isDirty && (
                            <span title="تم تعديل البيانات بعد الاعتماد — يرجى إعادة الاعتماد" className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/40 whitespace-nowrap cursor-help">
                              <AlertTriangle size={9} /> يحتاج إعادة اعتماد
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`} style={{ position: 'sticky', left: 168, zIndex: 10, background: 'hsl(var(--card))' }}>{r.jobTitle}</td>
                      <td className={`${tdClass} border-l border-border/40 text-muted-foreground text-xs whitespace-nowrap`} style={{ position: 'sticky', left: 264, zIndex: 10, background: 'hsl(var(--card))' }}>{r.nationalId}</td>
                      {/* ── New info columns: income (manual), work days, fuel ── */}
                      <td className="px-2 py-2 text-xs text-center border border-border/40 bg-info/5 whitespace-nowrap">
                        <EditableCell value={r.platformIncome} onChange={v => updateRow(r.id, { platformIncome: v })} className="text-foreground" />
                      </td>
                      <td className="px-2 py-2 text-xs text-center border border-border/40 bg-info/5 whitespace-nowrap">
                        {r.workDays > 0
                          ? <span className="font-semibold text-foreground">{r.workDays}</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-center border border-border/40 bg-info/5 whitespace-nowrap">
                        {r.fuelCost > 0
                          ? <span className="font-semibold text-foreground">{r.fuelCost.toLocaleString()}</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      {platforms.map(p => {
                        const pc = platformColors[p];
                        const orders = r.platformOrders[p] || 0;
                        const salary = r.platformSalaries[p] || 0;
                        const scheme = empPlatformScheme?.[r.employeeId]?.[p];
                        return (
                          <PlatformOrderCell
                            key={`${p}-col`}
                            rowId={r.id}
                            platformName={p}
                            tdClass={tdClass}
                            pc={pc}
                            orders={orders}
                            salary={salary}
                            scheme={scheme}
                            editingCell={editingCell}
                            setEditingCell={setEditingCell}
                            updatePlatformOrders={updatePlatformOrders}
                          />
                        );
                      })}
                      <td className={`${tdClass} text-center font-bold text-foreground border-l border-border/20 bg-primary/[0.04]`}>
                        {Object.values(r.platformOrders).reduce((s, v) => s + v, 0) || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={`${tdClass} font-bold text-foreground border-l border-border/20 bg-primary/[0.06]`}>{c.totalPlatformSalary.toLocaleString()}</td>
                      <td className={`${tdClass} bg-success/[0.04] border-l border-border/40`}><EditableCell value={r.incentives} onChange={v => updateRow(r.id, { incentives: v })} className="text-foreground" /></td>
                      <td className={`${tdClass} bg-success/[0.04]`}><EditableCell value={r.sickAllowance} onChange={v => updateRow(r.id, { sickAllowance: v })} className="text-foreground" /></td>
                      <td className={`${tdClass} text-foreground font-semibold bg-success/[0.04]`}>{c.totalAdditions.toLocaleString()}</td>
                      <td className={`${tdClass} font-bold text-foreground border-l border-border/40 bg-success/[0.06]`}>{c.totalWithSalary.toLocaleString()}</td>
                      <td className={`${tdClass} border-l border-border/40 bg-destructive/[0.04]`}>
                        <EditableCell value={r.advanceDeduction} onChange={v => updateRow(r.id, { advanceDeduction: v })} className="text-foreground" />
                      </td>
                      <td className={tdClass}><EditableCell value={r.violations} onChange={v => updateRow(r.id, { violations: v })} className="text-foreground" /></td>
                      {allCustomCols.map(col => (
                        <CustomDeductionCell
                          key={col.fullKey}
                          row={r}
                          fullKey={col.fullKey}
                          tdClass={tdClass}
                          updateRow={updateRow}
                        />
                      ))}
                      <td className={`${tdClass} font-bold text-foreground border-l border-border/20 bg-destructive/[0.06]`}>
                        {c.totalDeductions > 0 ? c.totalDeductions.toLocaleString() : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={`${tdClass} font-black text-foreground text-base ${c.netSalary < 0 ? 'text-destructive' : ''}`}>{c.netSalary.toLocaleString()}</td>
                      <td className={tdClass}>
                        <EditableCell value={r.transfer} onChange={v => updateRow(r.id, { transfer: Math.max(0, Math.min(v, Math.max(0, c.netSalary))) })} />
                      </td>
                      <td className={`${tdClass} border-l border-border/20`}>{c.remaining.toLocaleString()}</td>
                      <td className={`${tdClass} border-l border-border`}>
                        <div className="flex items-center justify-center gap-1.5">
                          {r.status === 'pending' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-success border-success/40 hover:bg-success/10" onClick={() => approveRow(r.id)}>
                              <CheckCircle size={11} /> اعتماد
                            </Button>
                          )}
                          {r.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1 text-primary border-primary/40 hover:bg-primary/10"
                              onClick={() => void markAsPaid(r)}
                              disabled={markingPaid === r.id}
                            >
                              {markingPaid === r.id ? <Loader2 size={11} className="animate-spin" /> : <>✅ تم الصرف</>}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setPayslipRow(r)}>
                            <Printer size={11} /> كشف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals footer */}
                 <tr className="bg-muted/60 border-t-2 border-border">
                   <td className={`${tfClass} sticky text-center`} style={{ left: 0, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}>—</td>
                  <td className={`${tfClass} sticky text-center border-l border-border/30`} style={{ left: 40, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}>الإجمالي</td>
                   <td className={tfClass} style={{ position: 'sticky', left: 168, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}></td>
                   <td className={`${tfClass} border-l border-border/30`} style={{ position: 'sticky', left: 264, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}></td>
                   {/* New info columns totals */}
                   <td className="px-2 py-2 text-xs font-bold text-center border border-border/40 bg-info/10 text-foreground">
                     {filtered.reduce((s, r) => s + r.platformIncome, 0).toLocaleString()}
                   </td>
                   <td className="px-2 py-2 text-xs font-bold text-center border border-border/40 bg-info/10 text-foreground">
                     {Math.round(filtered.reduce((s, r) => s + r.workDays, 0) / Math.max(filtered.length, 1))}
                   </td>
                   <td className="px-2 py-2 text-xs font-bold text-center border border-border/40 bg-info/10 text-foreground">
                     {filtered.reduce((s, r) => s + r.fuelCost, 0).toLocaleString()}
                   </td>
                  {platforms.map(p => {
                    const totalOrders = totals.platform[p] || 0;
                    const totalSal = filtered.reduce((s, r) => s + (r.platformSalaries[p] || 0), 0);
                    return (
                      <td key={`${p}-col`} className={`${tfClass} border-l border-border/20 text-foreground`}>
                        <div className="flex flex-col items-center leading-tight">
                          <span>{totalOrders.toLocaleString()}</span>
                          <span className="text-[10px] opacity-75 font-normal">{totalSal.toLocaleString()} ر.س</span>
                        </div>
                      </td>
                    );
                   })}
                   <td className={`${tfClass} text-center font-bold text-foreground border-l border-border/20`}>
                     {filtered.reduce((s, r) => s + Object.values(r.platformOrders).reduce((a, v) => a + v, 0), 0).toLocaleString()}
                   </td>
                   <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.platformSalaries.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground`}>{totals.incentives.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground`}>{totals.sickAllowance.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground`}>{totals.totalAdditions.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.totalWithSalary.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground`}>{totals.advance.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground`}>{totals.violations.toLocaleString()}</td>
                  {allCustomCols.map(col => {
                    const colTotal = filtered.reduce((s, r) => s + (r.customDeductions?.[col.fullKey] || 0), 0);
                    return <td key={col.fullKey} className={`${tfClass} text-foreground`}>{colTotal > 0 ? colTotal.toLocaleString() : '—'}</td>;
                  })}
                  <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.totalDed.toLocaleString()}</td>
                  <td className={`${tfClass} text-foreground text-base ${totals.net < 0 ? 'text-destructive' : ''}`}>{totals.net.toLocaleString()}</td>
                  <td className={tfClass}>{totals.transfer.toLocaleString()}</td>
                  <td className={`${tfClass} border-l border-border/30`}>{totals.remaining.toLocaleString()}</td>
                  <td className={tfClass} colSpan={1}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
        );
      })()}

      {payslipRow && (
        <PayslipModal
          row={payslipRow}
          selectedMonth={selectedMonth}
          companyName={projectName}
          onClose={() => setPayslipRow(null)}
          onApprove={() => { approveRow(payslipRow.id); setPayslipRow(null); }}
        />
      )}

      {/* Employee Detail Dialog */}
      {detailRow && (() => {
        const c = computeRow(detailRow);
        const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
        // All custom deduction columns across apps
        const allCustomCols: { appName: string; key: string; label: string; fullKey: string }[] = [];
        platforms.forEach(p => {
          (appCustomColumns[p] || []).forEach(col => {
            allCustomCols.push({ appName: p, key: col.key, label: col.label, fullKey: `${p}___${col.key}` });
          });
        });
        return (
          <Dialog open onOpenChange={() => setDetailRow(null)}>
            <DialogContent dir="rtl" className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {detailRow.employeeName.slice(0, 1)}
                  </div>
                  {detailRow.employeeName}
                  <span className={`${statusStyles[detailRow.status]} text-xs`}>{statusLabels[detailRow.status]}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {/* Info */}
                <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div><span className="text-muted-foreground">المسمى الوظيفي: </span><span className="font-semibold">{detailRow.jobTitle || '—'}</span></div>
                  <div><span className="text-muted-foreground">رقم الهوية: </span><span className="font-semibold" dir="ltr">{detailRow.nationalId || '—'}</span></div>
                  <div><span className="text-muted-foreground">المدينة: </span><span className="font-semibold">{detailRow.city || '—'}</span></div>
                  <div><span className="text-muted-foreground">الشهر: </span><span className="font-semibold">{monthLabel}</span></div>
                  <div><span className="text-muted-foreground">طريقة الصرف: </span><span className="font-semibold">{detailRow.paymentMethod === 'bank' ? '🏦 بنكي' : '💵 كاش'}</span></div>
                  {detailRow.phone && <div><span className="text-muted-foreground">الهاتف: </span><span className="font-semibold" dir="ltr">{detailRow.phone}</span></div>}
                </div>

                {/* Orders per platform */}
                <div className="rounded-xl border border-success/20 bg-success/5 overflow-hidden">
                  <div className="px-3 py-2 bg-success/10 border-b border-success/20">
                    <p className="font-bold text-xs text-success uppercase tracking-wide">✅ الطلبات والاستحقاقات</p>
                  </div>
                  <div className="divide-y divide-border/30">
                    {/* All platforms — show orders + salary for each */}
                    {platforms.map(p => {
                      const orders = detailRow.platformOrders[p] || 0;
                      const salary = detailRow.platformSalaries[p] || 0;
                      if (orders === 0 && salary === 0) return null;
                      const pc = platformColors[p];
                      return (
                        <div key={p} className="flex justify-between items-center px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pc?.header || 'hsl(var(--primary))' }} />
                            <div>
                              <span className="font-medium text-xs text-foreground">{p}</span>
                              <span className="text-[10px] text-muted-foreground mr-1.5">{orders.toLocaleString()} طلب</span>
                            </div>
                          </div>
                          <span className="font-semibold text-xs" style={{ color: pc?.header || 'hsl(var(--primary))' }}>{salary.toLocaleString()} ر.س</span>
                        </div>
                      );
                    })}
                    {detailOrders.length === 0 && platforms.every(p => !detailRow.platformOrders[p]) && (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">لا توجد طلبات مسجّلة لهذا الشهر</div>
                    )}
                    {detailRow.incentives > 0 && (
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="text-xs text-foreground">حوافز</span>
                        <span className="text-xs font-semibold text-success">+{detailRow.incentives.toLocaleString()} ر.س</span>
                      </div>
                    )}
                    {detailRow.sickAllowance > 0 && (
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="text-xs text-foreground">بدل مرضي</span>
                        <span className="text-xs font-semibold text-success">+{detailRow.sickAllowance.toLocaleString()} ر.س</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5 bg-success/15 font-bold">
                    <span className="text-xs text-success">إجمالي الاستحقاقات</span>
                    <span className="text-sm text-success">{c.totalWithSalary.toLocaleString()} ر.س</span>
                  </div>
                </div>

                {/* Deductions — always show all including custom columns */}
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
                  <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20">
                    <p className="font-bold text-xs text-destructive uppercase tracking-wide">🔻 الاستقطاعات</p>
                  </div>
                  <div className="divide-y divide-border/30">
                    <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-xs text-foreground">قسط سلفة</span>
                      <span className={`text-xs font-semibold ${detailRow.advanceDeduction > 0 ? 'text-destructive' : 'text-muted-foreground/40'}`}>
                        {detailRow.advanceDeduction > 0 ? `-${detailRow.advanceDeduction.toLocaleString()} ر.س` : '—'}
                      </span>
                    </div>
                    {detailRow.advanceRemaining > 0 && (
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="text-xs text-muted-foreground">رصيد السلفة المتبقي</span>
                        <span className="text-xs font-semibold text-warning">{detailRow.advanceRemaining.toLocaleString()} ر.س</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-xs text-foreground">خصومات خارجية</span>
                      <span className={`text-xs font-semibold ${detailRow.externalDeduction > 0 ? 'text-destructive' : 'text-muted-foreground/40'}`}>
                        {detailRow.externalDeduction > 0 ? `-${detailRow.externalDeduction.toLocaleString()} ر.س` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-xs text-foreground">مخالفات</span>
                      <span className={`text-xs font-semibold ${detailRow.violations > 0 ? 'text-destructive' : 'text-muted-foreground/40'}`}>
                        {detailRow.violations > 0 ? `-${detailRow.violations.toLocaleString()} ر.س` : '—'}
                      </span>
                    </div>
                    {/* All custom columns from apps — always visible */}
                    {allCustomCols.map(col => {
                      const v = detailRow.customDeductions?.[col.fullKey] || 0;
                      return (
                        <div key={col.fullKey} className="flex justify-between items-center px-3 py-2.5">
                          <span className="text-xs text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: platformColors[col.appName]?.header || 'hsl(var(--muted-foreground))' }} />
                            {col.label}
                            <span className="text-[9px] text-muted-foreground">({col.appName})</span>
                          </span>
                          <span className={`text-xs font-semibold ${v > 0 ? 'text-destructive' : 'text-muted-foreground/40'}`}>
                            {v > 0 ? `-${v.toLocaleString()} ر.س` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5 bg-destructive/15 font-bold">
                    <span className="text-xs text-destructive">إجمالي الاستقطاعات</span>
                    <span className="text-sm text-destructive">-{c.totalDeductions.toLocaleString()} ر.س</span>
                  </div>
                </div>

                {/* Net salary */}
                <div className="flex justify-between items-center py-3.5 bg-primary text-primary-foreground rounded-xl px-5">
                  <span className="font-bold text-sm">صافي الراتب</span>
                  <span className="text-xl font-black">{c.netSalary.toLocaleString()} ر.س</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => setDetailRow(null)}>إغلاق</Button>
                  <Button size="sm" className="gap-1.5" onClick={() => { setPayslipRow(detailRow); setDetailRow(null); }}>
                    <Printer size={13} /> كشف الراتب
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Hidden off-screen renderer for batch ZIP export */}
      {batchQueue.length > 0 && batchIndex < batchQueue.length && (() => {
        const row = batchQueue[batchIndex];
        const t = getSlipTranslations(row.preferredLanguage);
        const meta = LANGUAGE_META[row.preferredLanguage];
        const platformRows = row.registeredApps
          .filter(app => (row.platformOrders[app] || 0) > 0)
          .map(app => ({ app, orders: row.platformOrders[app] || 0, salary: row.platformSalaries[app] || 0 }));
        const totalPlatformSalary = platformRows.reduce((s, r) => s + r.salary, 0);
        const totalEarnings = totalPlatformSalary + row.incentives + row.sickAllowance;
        const allDeductions = [
          { key: 'advance', label: t.advanceInstallment, val: row.advanceDeduction },
          { key: 'external', label: t.externalDeductions, val: row.externalDeduction },
          { key: 'violation', label: t.violations, val: row.violations },
        ];
        const deductionItems = allDeductions.filter(d => d.val > 0);
        const totalDeductions = allDeductions.reduce((s, d) => s + d.val, 0);
        const netSalary = totalEarnings - totalDeductions;
        const remaining = netSalary - row.transfer;
        const monthLabel = batchMonth;
        const fmt = (n: number) => `${n.toLocaleString()} ${t.currency}`;
        return (
          <div
            ref={batchSlipRef}
            dir={meta.dir}
            style={{ position: 'fixed', left: '-9999px', top: 0, width: '600px', background: '#ffffff', padding: '16px', fontFamily: meta.fontFamily, zIndex: -1 }}
          >
            <div style={{ marginBottom: 12, borderBottom: '2px solid #465FFF', paddingBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {projectName && <div style={{ fontSize: 18, fontWeight: 900, color: '#465FFF' }}>{projectName}</div>}
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a' }}>{t.title} — {row.employeeName}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{monthLabel} · {meta.flag} {meta.label}</div>
                </div>
                <div style={{ fontSize: 12, color: '#888', textAlign: 'left' }}>{new Date().toLocaleDateString('ar-SA')}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f8f8ff', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12 }}>
              <div><span style={{ color: '#888', fontSize: 10 }}>{t.month}: </span><strong>{monthLabel}</strong></div>
              <div><span style={{ color: '#888', fontSize: 10 }}>{t.city}: </span><strong>{row.city || '—'}</strong></div>
              <div><span style={{ color: '#888', fontSize: 10 }}>{t.nationalId}: </span><strong>{row.nationalId || '—'}</strong></div>
              <div><span style={{ color: '#888', fontSize: 10 }}>{t.paymentMethod}: </span><strong>{row.paymentMethod === 'bank' ? t.payBank : t.payCash}</strong></div>
            </div>
            <div style={{ border: '1px solid #bbf7d0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ background: '#f0fdf4', padding: '6px 10px', fontWeight: 700, fontSize: 11, color: '#16a34a' }}>{t.sectionEarnings}</div>
              {platformRows.map(({ app, orders, salary }) => (
                <div key={app} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #e5e7eb', fontSize: 12 }}>
                  <div><div style={{ fontWeight: 600 }}>{app}</div><div style={{ fontSize: 10, color: '#888' }}>{orders} {t.orders}</div></div>
                  <strong style={{ color: PLATFORM_COLORS[app]?.valueColor || '#465FFF' }}>{fmt(salary)}</strong>
                </div>
              ))}
              {row.incentives > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #e5e7eb', fontSize: 12 }}><span>{t.incentives}</span><strong style={{ color: '#16a34a' }}>+{fmt(row.incentives)}</strong></div>}
              {row.sickAllowance > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #e5e7eb', fontSize: 12 }}><span>{t.sickAllowance}</span><strong style={{ color: '#16a34a' }}>+{fmt(row.sickAllowance)}</strong></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#dcfce7', fontWeight: 700, fontSize: 13 }}><span style={{ color: '#16a34a' }}>{t.platformTotal}</span><span style={{ color: '#16a34a' }}>{fmt(totalEarnings)}</span></div>
            </div>
            {deductionItems.length > 0 && (
              <div style={{ border: '1px solid #fecaca', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ background: '#fff1f2', padding: '6px 10px', fontWeight: 700, fontSize: 11, color: '#dc2626' }}>{t.sectionDeductions}</div>
                {deductionItems.map(d => (
                  <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #e5e7eb', fontSize: 12 }}><span>{d.label}</span><strong style={{ color: '#dc2626' }}>-{fmt(d.val)}</strong></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#fee2e2', fontWeight: 700, fontSize: 13 }}><span style={{ color: '#dc2626' }}>{t.totalDeductions}</span><span style={{ color: '#dc2626' }}>-{fmt(totalDeductions)}</span></div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#465FFF', color: '#fff', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t.netSalary}</span>
              <span style={{ fontWeight: 900, fontSize: 22 }}>{fmt(netSalary)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
              <div style={{ background: '#f8fafc', borderRadius: 6, padding: 8, textAlign: 'center' }}><div style={{ color: '#888', marginBottom: 2 }}>{t.transfer}</div><strong>{fmt(row.transfer)}</strong></div>
              <div style={{ background: '#f8fafc', borderRadius: 6, padding: 8, textAlign: 'center' }}><div style={{ color: '#888', marginBottom: 2 }}>{t.remaining}</div><strong>{fmt(remaining)}</strong></div>
              <div style={{ background: '#f8fafc', borderRadius: 6, padding: 8, textAlign: 'center' }}><div style={{ color: '#888', marginBottom: 2 }}>{t.advanceBalance}</div><strong style={{ color: row.advanceRemaining > 0 ? '#dc2626' : undefined }}>{fmt(row.advanceRemaining)}</strong></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Salaries;

function SalariesFastList(props: Readonly<{
  monthYear: string;
  branch: BranchKey;
  search: string;
  approved: FastApprovedFilter;
  onApprovedChange: (v: FastApprovedFilter) => void;
  onFiltersChange: (next: ReturnType<typeof createDefaultGlobalFilters>) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onBack: () => void;
  onSalaryTemplate: () => void;
  onSalaryImport: (file: File) => void | Promise<void>;
  salaryActionLoading: boolean;
}>) {
  const { toast } = useToast();
  const {
    monthYear,
    branch,
    search,
    approved,
    onApprovedChange,
    onFiltersChange,
    page,
    pageSize,
    onPageChange,
    onBack,
    onSalaryTemplate,
    onSalaryImport,
    salaryActionLoading,
  } = props;
  const [exporting, setExporting] = useState(false);
  const fastTableRef = useRef<HTMLTableElement>(null);

  const { data, isLoading } = useSalaryRecordsPaged({
    monthYear,
    page,
    pageSize,
    filters: { branch, search, approved },
  });

  type Row = {
    id: string;
    employee_id: string;
    month_year: string;
    net_salary: number | null;
    base_salary: number | null;
    advance_deduction: number | null;
    external_deduction: number | null;
    manual_deduction: number | null;
    attendance_deduction: number | null;
    is_approved: boolean | null;
    created_at: string;
    employees?: { id: string; name: string; national_id: string | null; city: string | null } | null;
  };
  const paged = data as { data?: Row[]; count?: number } | undefined;
  const rows = paged?.data || [];
  const total = paged?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleFastPrint = () => {
    const table = fastTableRef.current;
    if (!table) return;
    printHtmlTable(table, {
      title: `سجلات الرواتب — ${monthYear}`,
      subtitle: `إجمالي النتائج: ${total.toLocaleString()}`,
    });
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await loadXlsx();
      const branchKey: Exclude<BranchKey, 'all'> | undefined = branch === 'all' ? undefined : branch;
      const q = search?.trim() || undefined;

      const res = await salaryService.exportMonth({
        monthYear,
        filters: { branch: branchKey, search: q, approved },
      });
      if (res.error) throw res.error;

      const out = (res.data || []) as Row[];
      const sheet = out.map((r) => ({
        'الموظف': r.employees?.name ?? '',
        'الهوية': r.employees?.national_id ?? '',
        'الفرع': r.employees?.city ?? '',
        'صافي الراتب': r.net_salary ?? 0,
        'الأساسي': r.base_salary ?? 0,
        'سلفة': r.advance_deduction ?? 0,
        'خصم خارجي': r.external_deduction ?? 0,
        'خصم يدوي': r.manual_deduction ?? 0,
        'خصم حضور': r.attendance_deduction ?? 0,
        'معتمد': r.is_approved ? 'نعم' : 'لا',
        'تاريخ الإنشاء': r.created_at ?? '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      XLSX.utils.book_append_sheet(wb, ws, 'SalaryRecords');
      XLSX.writeFile(wb, `salary_records_${monthYear}.xlsx`);

      await auditService.logAdminAction({
        action: 'salary_records.export',
        table_name: 'salary_records',
        record_id: null,
        meta: { total: out.length, monthYear, branch: branchKey ?? null, approved, search: q ?? null },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر التصدير';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  let tableRowsNode: React.ReactNode;
  if (isLoading) {
    tableRowsNode = SALARY_TABLE_SKELETON_KEYS.map((skeletonKey) => (
      <tr key={skeletonKey}>
        <td className="px-4 py-3 text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
      </tr>
    ));
  } else if (rows.length === 0) {
    tableRowsNode = <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد نتائج</td></tr>;
  } else {
    tableRowsNode = rows.map((r) => (
      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 font-semibold">{r.employees?.name ?? '—'}</td>
        <td className="px-4 py-3 text-center">{toCityArabicLabel(r.employees?.city)}</td>
        <td className="px-4 py-3 text-center font-bold">{Number(r.net_salary || 0).toLocaleString()}</td>
        <td className="px-4 py-3 text-center">{r.is_approved ? 'نعم' : 'لا'}</td>
        <td className="px-4 py-3 text-center font-mono text-xs">{(r.created_at || '').slice(0, 10)}</td>
      </tr>
    ));
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2"><Wallet size={20} /> الرواتب — قائمة (سريعة)</h1>
            <p className="page-subtitle">{total.toLocaleString()} سجل — {monthYear}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onBack}>رجوع</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 shadow-sm">
        <TableActions
          loading={salaryActionLoading || exporting}
          onDownloadTemplate={onSalaryTemplate}
          onImportFile={onSalaryImport}
          onExport={exportExcel}
          onPrint={handleFastPrint}
        />
      </div>

      <div className="ds-card p-3 space-y-3">
        <GlobalTableFilters
          value={{
            ...createDefaultGlobalFilters(),
            branch,
            search,
            driverId: 'all',
            platformAppId: 'all',
            dateFrom: '',
            dateTo: '',
          }}
          onChange={(next) => onFiltersChange({ ...next, driverId: 'all', platformAppId: 'all', dateFrom: '', dateTo: '' })}
          onReset={() => onFiltersChange(createDefaultGlobalFilters())}
          options={{
            enableBranch: true,
            enableDriver: false,
            enablePlatform: false,
            enableDateRange: false,
          }}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">الاعتماد</span>
          <Select value={approved} onValueChange={(v) => onApprovedChange(v as 'all' | 'approved' | 'pending')}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue placeholder="الكل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="pending">غير معتمد</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="ds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={fastTableRef} className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-center font-semibold px-4 py-3">الموظف</th>
                <th className="text-center font-semibold px-4 py-3">الفرع</th>
                <th className="text-center font-semibold px-4 py-3">صافي</th>
                <th className="text-center font-semibold px-4 py-3">معتمد</th>
                <th className="text-center font-semibold px-4 py-3">تاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableRowsNode}
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
