import { useState, useRef, useCallback, useEffect } from 'react';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Wallet, Download, CheckCircle, Printer, Upload, FileUp, ChevronUp, ChevronDown, ChevronsUpDown, LayoutGrid, Table2, AlertTriangle, FileText, Settings2, Globe, Archive, TrendingUp, Users, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from '@e965/xlsx';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAppColors, AppColorData, CustomColumn } from '@/hooks/useAppColors';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getSlipTranslations, getStatusLabel, LANGUAGE_META, type SlipLanguage } from '@/lib/salarySlipTranslations';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';


// Kept for legacy references — populated dynamically from DB at runtime
const PLATFORM_COLORS: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {};

const statusLabels: Record<string, string> = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' };
const statusStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-info', paid: 'badge-success' };

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

type SortDir = 'asc' | 'desc' | null;

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
  // Legacy fields kept for backward compatibility
  walletHunger: number;
  walletTuyo: number;
  walletJahiz: number;
  foodDamage: number;
  transfer: number;
  advanceDeduction: number;
  advanceInstallmentIds: string[];
  advanceRemaining: number;
  externalDeduction: number;
  status: 'pending' | 'approved' | 'paid';
  isDirty?: boolean;
  preferredLanguage: SlipLanguage;
  phone?: string | null;
}

interface SchemeData {
  id: string;
  name: string;
  name_en: string | null;
  status: string;
  target_orders: number | null;
  target_bonus: number | null;
  salary_scheme_tiers?: { from_orders: number; to_orders: number | null; price_per_order: number; tier_order: number }[];
  snapshot?: any;
  scheme_id?: string;
}

const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={10} className="inline ml-0.5 opacity-40" />;
  if (sortDir === 'asc') return <ChevronUp size={10} className="inline ml-0.5" />;
  return <ChevronDown size={10} className="inline ml-0.5" />;
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

  const netSalary = Math.max(0, totalEarnings - totalDeductions);
  const remaining = netSalary - row.transfer;
  const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;

  const fmt = (n: number) => `${n.toLocaleString()} ${t.currency}`;

  const exportPDF = async () => {
    if (!slipRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const finalHeight = Math.min(imgHeight, pageHeight);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, finalHeight);
      pdf.save(`salary-slip-${row.employeeName}-${selectedMonth}.pdf`);
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
        <div ref={slipRef} className="space-y-4 text-sm bg-background p-1">

          {/* ── Company Header ── */}
          {companyName && (
            <div className="flex items-center justify-between border-b-2 border-primary pb-3 mb-1">
              <div>
                <p className="text-lg font-black text-primary">{companyName}</p>
                <p className="text-xs text-muted-foreground">{t.subtitle}</p>
              </div>
              <div className="text-left text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{t.title}</p>
                <p>{monthLabel}</p>
              </div>
            </div>
          )}

          {/* Employee Info */}
          <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div><span className="text-muted-foreground text-xs">{t.month}: </span><span className="font-semibold text-xs">{monthLabel}</span></div>
            <div><span className="text-muted-foreground text-xs">{t.city}: </span><span className="font-semibold text-xs">{row.city || '—'}</span></div>
            <div><span className="text-muted-foreground text-xs">{t.nationalId}: </span><span className="font-semibold text-xs" dir="ltr">{row.nationalId || '—'}</span></div>
            <div><span className="text-muted-foreground text-xs">{t.status}: </span><span className={`${statusStyles[row.status]} text-xs`}>{getStatusLabel(row.status, row.preferredLanguage)}</span></div>
            <div><span className="text-muted-foreground text-xs">{t.paymentMethod}: </span><span className="font-semibold text-xs">{row.paymentMethod === 'bank' ? t.payBank : t.payCash}</span></div>
          </div>

          {/* ── EARNINGS Section ─────────────────────────────── */}
          <div className="rounded-xl border border-success/20 bg-success/5 overflow-hidden">
            <div className="px-3 py-2 bg-success/10 border-b border-success/20">
              <p className="font-bold text-xs text-success uppercase tracking-wide">{t.sectionEarnings || '✅ الاستحقاقات / Earnings'}</p>
            </div>
            <div className="divide-y divide-border/30">
              {/* Platform rows — only those with orders > 0 */}
              {platformRows.length > 0 ? platformRows.map(({ app, orders, salary }) => {
                const color = PLATFORM_COLORS[app]?.valueColor || 'hsl(var(--primary))';
                return (
                  <div key={app} className="flex justify-between items-center px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{app}</span>
                      <span className="text-xs text-muted-foreground">{orders} {t.orders}</span>
                    </div>
                    <span className="font-semibold" style={{ color }}>{fmt(salary)}</span>
                  </div>
                );
              }) : (
                <div className="px-3 py-3 text-center text-xs text-muted-foreground">لا توجد طلبات مسجّلة</div>
              )}
              {/* Incentives */}
              {row.incentives > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-foreground">{t.incentives}</span>
                  <span className="font-semibold text-success">+{fmt(row.incentives)}</span>
                </div>
              )}
              {/* Sick allowance */}
              {row.sickAllowance > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-foreground">{t.sickAllowance}</span>
                  <span className="font-semibold text-success">+{fmt(row.sickAllowance)}</span>
                </div>
              )}
            </div>
            {/* Earnings subtotal */}
            <div className="flex justify-between items-center px-3 py-2.5 bg-success/15 font-bold">
              <span className="text-success">{t.platformTotal}</span>
              <span className="text-success text-base">{fmt(totalEarnings)}</span>
            </div>
          </div>

          {/* ── DEDUCTIONS Section ───────────────────────────── */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
            <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20">
              <p className="font-bold text-xs text-destructive uppercase tracking-wide">{t.sectionDeductions}</p>
            </div>
            <div className="divide-y divide-border/30">
              {/* Always show advance installment */}
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-foreground">{t.advanceInstallment}</span>
                <span className={`font-semibold ${row.advanceDeduction > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {row.advanceDeduction > 0 ? `-${fmt(row.advanceDeduction)}` : '—'}
                </span>
              </div>
              {/* Always show external deductions */}
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-foreground">{t.externalDeductions}</span>
                <span className={`font-semibold ${row.externalDeduction > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {row.externalDeduction > 0 ? `-${fmt(row.externalDeduction)}` : '—'}
                </span>
              </div>
              {/* Always show violations */}
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-foreground">{t.violations}</span>
                <span className={`font-semibold ${row.violations > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {row.violations > 0 ? `-${fmt(row.violations)}` : '—'}
                </span>
              </div>
              {/* Dynamic custom deductions */}
              {Object.entries(row.customDeductions || {}).map(([k, v]) => {
                const label = k.split('___').slice(1).join('___') || k;
                return (
                  <div key={k} className="flex justify-between items-center px-3 py-2">
                    <span className="text-foreground">{label}</span>
                    <span className={`font-semibold ${v > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {v > 0 ? `-${fmt(v)}` : '—'}
                    </span>
                  </div>
                );
              })}
              {/* Legacy wallet fields */}
              {row.walletHunger > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-foreground">{t.walletHunger}</span>
                  <span className="font-semibold text-destructive">-{fmt(row.walletHunger)}</span>
                </div>
              )}
              {row.walletTuyo > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-foreground">{t.walletTuyo}</span>
                  <span className="font-semibold text-destructive">-{fmt(row.walletTuyo)}</span>
                </div>
              )}
              {row.walletJahiz > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-foreground">{t.walletJahiz}</span>
                  <span className="font-semibold text-destructive">-{fmt(row.walletJahiz)}</span>
                </div>
              )}
              {row.foodDamage > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-foreground">{t.foodDamage}</span>
                  <span className="font-semibold text-destructive">-{fmt(row.foodDamage)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center px-3 py-2.5 bg-destructive/15 font-bold">
              <span className="text-destructive">{t.totalDeductions}</span>
              <span className="text-destructive text-base">-{fmt(totalDeductions)}</span>
            </div>
          </div>

          {/* ── NET SALARY ──────────────────────────────────── */}
          <div className="flex justify-between items-center py-3.5 bg-primary text-primary-foreground rounded-xl px-5">
            <span className="font-bold text-base">{t.netSalary}</span>
            <span className="text-2xl font-black">{fmt(netSalary)}</span>
          </div>

          {/* Summary Footer */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">{t.transfer}</p>
              <p className="font-bold text-sm">{fmt(row.transfer)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">{t.remaining}</p>
              <p className="font-bold text-sm">{fmt(remaining)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">{t.advanceBalance}</p>
              <p className={`font-bold text-sm ${row.advanceRemaining > 0 ? 'text-destructive' : ''}`}>{fmt(row.advanceRemaining)}</p>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border/50 mt-2">
            <div className="text-center text-xs text-muted-foreground">
              <div className="h-8 border-b border-border/50 mb-1" />
              <span>{t.signatureDriver}</span>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              <div className="h-8 border-b border-border/50 mb-1" />
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
    const n = parseFloat(local);
    onChange(isNaN(n) ? 0 : Math.max(min, n));
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

const ImportModal = ({ onClose }: { onClose: () => void }) => {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      const errs: Record<number, string> = {};
      rows.forEach((row, i) => {
        const missing = [];
        if (!row['اسم المندوب'] && !row['الاسم']) missing.push('الاسم');
        if (!row['رقم الهوية']) missing.push('رقم الهوية');
        if (missing.length) errs[i] = `الحقول المطلوبة مفقودة: ${missing.join(', ')}`;
      });
      setErrors(errs);
      setPreview(rows.slice(0, 20));
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'اسم المندوب': '', 'رقم الهوية': '', 'هنقرستيشن': '', 'جاهز': '',
      'كيتا': '', 'توبو': '', 'نينجا': '', 'تويو': '', 'أمازون': '',
      'الحوافز': '', 'بدل مرضي': '', 'المخالفات': '',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'رواتب');
    XLSX.writeFile(wb, 'نموذج_استيراد_الرواتب.xlsx');
  };

  const confirmImport = () => {
    const validCount = preview.filter((_, i) => !errors[i]).length;
    toast({ title: `✅ تم استيراد ${validCount} سجل بنجاح` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>استيراد بيانات الرواتب</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
              <Download size={14} /> تحميل النموذج
            </Button>
            <Button className="gap-2" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> رفع ملف Excel
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{preview.length} سطر — {Object.keys(errors).length} أخطاء</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {Object.keys(preview[0]).map(k => (
                        <th key={k} className="p-2 text-right font-semibold text-muted-foreground whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={`border-b border-border/30 ${errors[i] ? 'bg-destructive/10' : ''}`}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="p-2 whitespace-nowrap">{String(v)}</td>
                        ))}
                        {errors[i] && <td className="p-2 text-destructive text-xs">{errors[i]}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>إلغاء</Button>
                <Button onClick={confirmImport} disabled={Object.keys(errors).length === preview.length}>
                  تأكيد الاستيراد ({preview.filter((_, i) => !errors[i]).length} سجل)
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

function calcSalaryFromTiers(
  orders: number,
  tiers: { from_orders: number; to_orders: number | null; price_per_order: number; tier_order: number }[],
  targetOrders: number | null,
  targetBonus: number | null
): number {
  if (!tiers || tiers.length === 0 || orders === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);
  let total = 0;
  for (const tier of sorted) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders < from) break;
    const inTier = Math.min(orders, to) - from + 1;
    if (inTier <= 0) continue;
    total += inTier * tier.price_per_order;
  }
  if (targetOrders && targetBonus && orders >= targetOrders) {
    total += targetBonus;
  }
  return Math.round(total);
}

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
            {tierLines.map((t, i) => (
              <p key={i} className="text-muted-foreground">{t.label}</p>
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

// ─── Main Salaries Page ───────────────────────────────────────────
const Salaries = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectName } = useSystemSettings();
  const { apps: appColorsList } = useAppColors();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(months[0].v);
  const [rows, setRows] = useState<SalaryRow[]>([]);
  // empPlatformScheme[employeeId][platformName] = scheme
  const [empPlatformScheme, setEmpPlatformScheme] = useState<Record<string, Record<string, SchemeData>>>({});
  const [payslipRow, setPayslipRow] = useState<SalaryRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; platform: string } | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platformColors, setPlatformColors] = useState<Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }>>({});
  const [appsWithoutScheme, setAppsWithoutScheme] = useState<string[]>([]);
  // appCustomColumns: appName → CustomColumn[]
  const [appCustomColumns, setAppCustomColumns] = useState<Record<string, CustomColumn[]>>({});

  // ── Batch ZIP export state ────────────────────────────────────
  const [batchQueue, setBatchQueue] = useState<SalaryRow[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchZip, setBatchZip] = useState<JSZip | null>(null);
  const [batchMonth, setBatchMonth] = useState('');
  const batchSlipRef = useRef<HTMLDivElement>(null);

  // Sync platforms, colors, and custom columns from DB apps
  useEffect(() => {
    if (appColorsList.length === 0) return;
    const newColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {};
    const newPlatforms: string[] = [];
    const newCustomCols: Record<string, CustomColumn[]> = {};
    appColorsList.filter(a => a.is_active).forEach(app => {
      newPlatforms.push(app.name);
      newColors[app.name] = {
        header: app.brand_color,
        headerText: app.text_color,
        cellBg: `${app.brand_color}18`,
        valueColor: app.brand_color,
        focusBorder: app.brand_color,
      };
      newCustomCols[app.name] = app.custom_columns || [];
      // keep global in sync for legacy code paths
      PLATFORM_COLORS[app.name] = newColors[app.name];
    });
    setPlatforms(newPlatforms);
    setPlatformColors(newColors);
    setAppCustomColumns(newCustomCols);
  }, [appColorsList]);

  // ─── Data fetching ─────────────────────────────────────────────
  useEffect(() => {
    const fetchAllData = async () => {
      setLoadingData(true);
      const [y, m] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;

      const [empRes, extRes, ordersRes, appsWithSchemeRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, job_title, national_id, salary_type, base_salary, iban, city, preferred_language, phone')
          .eq('status', 'active')
          .order('name'),

        supabase
          .from('external_deductions')
          .select('employee_id, amount')
          .eq('apply_month', selectedMonth)
          .eq('approval_status', 'approved'),

        supabase
          .from('daily_orders')
          .select('employee_id, app_id, orders_count, apps(name, id)')
          .gte('date', startDate)
          .lte('date', endDate),

        // Fetch apps with their assigned scheme (scheme per platform)
        supabase
          .from('apps')
          .select('id, name, scheme_id, salary_schemes(id, name, name_en, status, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order))')
          .eq('is_active', true),
      ]);

      // ── Fetch saved salary records for this month (to restore status) ──
      const { data: savedRecords } = await supabase
        .from('salary_records')
        .select('employee_id, is_approved, advance_deduction, net_salary, manual_deduction, attendance_deduction, external_deduction')
        .eq('month_year', selectedMonth);

      const savedMap: Record<string, { is_approved: boolean; net_salary: number }> = {};
      savedRecords?.forEach(r => {
        savedMap[r.employee_id] = { is_approved: r.is_approved, net_salary: r.net_salary };
      });

      // ── Fetch advance installments via advances → employee_id ──
      // Step 1: get all active/paused advances with total amount for remaining calc
      const { data: allAdvances } = await supabase
        .from('advances')
        .select('id, employee_id, status, amount, monthly_amount')
        .in('status', ['active', 'paused']);

      const advMap: Record<string, number> = {};      // this month's installment deduction
      const advInstIds: Record<string, string[]> = {};
      const deductedInstIds: Record<string, string[]> = {};
      const advRemainingMap: Record<string, number> = {}; // total remaining balance

      if (allAdvances && allAdvances.length > 0) {
        const advIdToEmpMap: Record<string, string> = {};
        allAdvances.forEach(adv => { advIdToEmpMap[adv.id] = adv.employee_id; });

        // Fetch installments for this month
        const { data: advInstData } = await supabase
          .from('advance_installments')
          .select('id, advance_id, amount, status')
          .eq('month_year', selectedMonth)
          .in('advance_id', allAdvances.map(a => a.id));

        // Fetch all pending/deferred installments to calculate remaining balance
        const { data: allPendingInsts } = await supabase
          .from('advance_installments')
          .select('advance_id, amount, status')
          .in('status', ['pending', 'deferred'])
          .in('advance_id', allAdvances.map(a => a.id));

        // Build remaining balance per employee
        allPendingInsts?.forEach(inst => {
          const empId = advIdToEmpMap[inst.advance_id];
          if (empId) {
            advRemainingMap[empId] = (advRemainingMap[empId] || 0) + Number(inst.amount);
          }
        });

        advInstData?.forEach(inst => {
          const empId = advIdToEmpMap[inst.advance_id];
          if (empId) {
            if (inst.status === 'pending' || inst.status === 'deferred') {
              advMap[empId] = (advMap[empId] || 0) + Number(inst.amount);
              if (!advInstIds[empId]) advInstIds[empId] = [];
              advInstIds[empId].push(inst.id);
            } else if (inst.status === 'deducted') {
              if (!deductedInstIds[empId]) deductedInstIds[empId] = [];
              deductedInstIds[empId].push(inst.id);
            }
          }
        });
      }

      const employees = empRes.data || [];

      const extMap: Record<string, number> = {};
      extRes.data?.forEach(d => {
        extMap[d.employee_id] = (extMap[d.employee_id] || 0) + Number(d.amount);
      });

      const ordMap: Record<string, Record<string, number>> = {};
      ordersRes.data?.forEach(r => {
        const appName = (r.apps as any)?.name || 'غير معروف';
        if (!ordMap[r.employee_id]) ordMap[r.employee_id] = {};
        ordMap[r.employee_id][appName] = (ordMap[r.employee_id][appName] || 0) + r.orders_count;
      });

      // ── Build appName→scheme map from apps.scheme_id (scheme per platform) ──
      const appSchemeMap: Record<string, SchemeData | null> = {};
      appsWithSchemeRes.data?.forEach((a: any) => {
        appSchemeMap[a.name] = a.salary_schemes ? (a.salary_schemes as SchemeData) : null;
      });

      // Track which active platforms have no scheme
      const missing = (appsWithSchemeRes.data || [])
        .filter((a: any) => !a.salary_schemes)
        .map((a: any) => a.name);
      setAppsWithoutScheme(missing);

      // ── Build empPlatformScheme: per-employee per-platform → uses app's scheme ──
      const builtEmpPlatformScheme: Record<string, Record<string, SchemeData | null>> = {};
      employees.forEach(emp => {
        builtEmpPlatformScheme[emp.id] = {};
        platforms.forEach(p => {
          builtEmpPlatformScheme[emp.id][p] = appSchemeMap[p] ?? null;
        });
      });
      setEmpPlatformScheme(builtEmpPlatformScheme as any);

      const newRows: SalaryRow[] = employees.map(emp => {
        const empOrders = ordMap[emp.id] || {};
        const registeredApps = Object.keys(empOrders).filter(k => empOrders[k] > 0);

        const platformOrders: Record<string, number> = {};
        const platformSalaries: Record<string, number> = {};

        platforms.forEach(p => {
          const orders = empOrders[p] || 0;
          platformOrders[p] = orders;
          if (orders === 0) { platformSalaries[p] = 0; return; }

          // Use the platform's assigned scheme; if no scheme → salary = 0 + warning
          const scheme = appSchemeMap[p];
          if (scheme && scheme.salary_scheme_tiers) {
            platformSalaries[p] = calcSalaryFromTiers(orders, scheme.salary_scheme_tiers, scheme.target_orders, scheme.target_bonus);
          } else {
            // Platform has no scheme assigned → 0 salary, show warning
            platformSalaries[p] = 0;
          }
        });

        const saved = savedMap[emp.id];
        // If already paid (all deducted installments exist), mark as paid
        let status: 'pending' | 'approved' | 'paid' = 'pending';
        if (saved) {
          if (deductedInstIds[emp.id]?.length > 0 || advInstIds[emp.id]?.length === 0) {
            // check if it was saved as paid
            const hasPendingInst = (advInstIds[emp.id] || []).length > 0;
            if (!hasPendingInst && saved.is_approved) {
              status = 'paid';
            } else if (saved.is_approved) {
              status = 'approved';
            }
          } else if (saved.is_approved) {
            status = 'approved';
          }
        }

        const advDeduction = advMap[emp.id] || 0;
        const extDeduction = extMap[emp.id] || 0;
        const cityLabel = emp.city === 'makkah' ? 'مكة' : emp.city === 'jeddah' ? 'جدة' : '—';
        const bankAccount = emp.iban ? emp.iban.slice(-6) : '';
        const hasIban = !!emp.iban;

        return {
          id: `${emp.id}-${selectedMonth}`,
          employeeId: emp.id,
          employeeName: emp.name,
          jobTitle: emp.job_title || 'مندوب توصيل',
          nationalId: emp.national_id || '—',
          city: cityLabel,
          bankAccount,
          hasIban,
          paymentMethod: hasIban ? 'bank' as const : 'cash' as const,
          registeredApps,
          platformOrders,
          platformSalaries,
          incentives: 0,
          sickAllowance: 0,
          violations: 0,
          walletHunger: 0,
          walletTuyo: 0,
          walletJahiz: 0,
          foodDamage: 0,
          customDeductions: {},
          transfer: 0,
          advanceDeduction: advDeduction,
          advanceInstallmentIds: advInstIds[emp.id] || [],
          advanceRemaining: advRemainingMap[emp.id] || 0,
          externalDeduction: extDeduction,
          status,
          preferredLanguage: ((emp as any).preferred_language as SlipLanguage) || 'ar',
          phone: (emp as any).phone || null,
        };
      });

      setRows(newRows);
      setLoadingData(false);
    };

    fetchAllData();
  }, [selectedMonth, platforms]);

  const computeRow = useCallback((r: SalaryRow) => {
    const totalPlatformSalary = Object.values(r.platformSalaries).reduce((s, v) => s + v, 0);
    const totalAdditions = r.incentives + r.sickAllowance;
    const totalWithSalary = totalPlatformSalary + totalAdditions;
    const totalDeductions = r.advanceDeduction + r.violations + r.walletHunger + r.walletTuyo + r.walletJahiz + r.foodDamage + r.externalDeduction + Object.values(r.customDeductions || {}).reduce((s, v) => s + v, 0);
    const netSalary = Math.max(0, totalWithSalary - totalDeductions);
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

  const filteredBase = rows.filter(r => {
    const matchSearch = r.employeeName.includes(search);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filtered = [...filteredBase].sort((a, b) => {
    if (!sortField || !sortDir) return 0;
    let va: any, vb: any;
    const ca = computeRow(a), cb = computeRow(b);
    switch (sortField) {
      case 'employeeName': va = a.employeeName; vb = b.employeeName; break;
      case 'jobTitle': va = a.jobTitle; vb = b.jobTitle; break;
      case 'nationalId': va = a.nationalId; vb = b.nationalId; break;
      case 'platformSalaries': va = ca.totalPlatformSalary; vb = cb.totalPlatformSalary; break;
      case 'incentives': va = a.incentives; vb = b.incentives; break;
      case 'totalAdditions': va = ca.totalAdditions; vb = cb.totalAdditions; break;
      case 'advanceDeduction': va = a.advanceDeduction; vb = b.advanceDeduction; break;
      case 'totalDeductions': va = ca.totalDeductions; vb = cb.totalDeductions; break;
      case 'netSalary': va = ca.netSalary; vb = cb.netSalary; break;
      case 'status': va = a.status; vb = b.status; break;
      default:
        if (platforms.includes(sortField)) {
          va = a.platformOrders[sortField] || 0;
          vb = b.platformOrders[sortField] || 0;
        } else {
          va = (a as any)[sortField] || 0;
          vb = (b as any)[sortField] || 0;
        }
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

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
      // Recalculate salary using proper scheme
      const scheme = empPlatformScheme?.[r.employeeId]?.[platform];
      let salary = 0;
      if (scheme && scheme.salary_scheme_tiers) {
        salary = calcSalaryFromTiers(value, scheme.salary_scheme_tiers, scheme.target_orders, scheme.target_bonus);
      } else {
        // No scheme assigned → 0 salary (user needs to assign scheme)
        salary = 0;
      }
      const newSalaries = { ...r.platformSalaries, [platform]: salary };
      const isDirty = r.status !== 'pending' ? true : r.isDirty;
      return { ...r, platformOrders: newOrders, platformSalaries: newSalaries, isDirty };
    }));
  };

  const approveRow = async (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    const c = computeRow(row);
    // Save to salary_records
    await supabase.from('salary_records').upsert({
      employee_id: row.employeeId,
      month_year: selectedMonth,
      base_salary: c.totalPlatformSalary,
      allowances: c.totalAdditions,
      attendance_deduction: row.violations,
      advance_deduction: row.advanceDeduction,
      external_deduction: row.externalDeduction,
      manual_deduction: row.walletHunger + row.walletTuyo + row.walletJahiz + row.foodDamage + Object.values(row.customDeductions || {}).reduce((s, v) => s + v, 0),
      net_salary: c.netSalary,
      is_approved: true,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,month_year' });
    updateRow(id, { status: 'approved', isDirty: false });
    toast({ title: '✅ تم اعتماد الراتب' });
    if (row.phone) {
      const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
      sendWhatsAppMessage(row.phone, `مرحباً ${row.employeeName} 👋\n\nتم اعتماد راتبك لشهر ${monthLabel}\nصافي الراتب: ${computeRow(row).netSalary.toLocaleString()} ر.س\n\nللاستفسار تواصل مع الإدارة.`)
        .then(ok => { if (!ok) toast({ title: 'تعذّر إرسال إشعار واتساب' }); });
    }
  };

  // ── Mark as PAID: save to salary_records + update installments + complete advance ──
  const markAsPaid = async (row: SalaryRow) => {
    setMarkingPaid(row.id);
    try {
      const c = computeRow(row);
      const nowStr = new Date().toISOString();

      // 1. Upsert into salary_records
      const { error: srError } = await supabase.from('salary_records').upsert({
        employee_id: row.employeeId,
        month_year: selectedMonth,
        base_salary: c.totalPlatformSalary,
        allowances: c.totalAdditions,
        attendance_deduction: row.violations,
        advance_deduction: row.advanceDeduction,
        external_deduction: row.externalDeduction,
        manual_deduction: row.walletHunger + row.walletTuyo + row.walletJahiz + row.foodDamage,
        net_salary: c.netSalary,
        is_approved: true,
        approved_by: user?.id ?? null,
        approved_at: nowStr,
        payment_method: row.paymentMethod,
      }, { onConflict: 'employee_id,month_year' });

      if (srError) throw srError;

      // 2. Mark installments as deducted (if any)
      if (row.advanceInstallmentIds.length > 0) {
        await supabase
          .from('advance_installments')
          .update({ status: 'deducted', deducted_at: nowStr })
          .in('id', row.advanceInstallmentIds);

        // 3. Check if advance is fully paid
        const { data: instData } = await supabase
          .from('advance_installments')
          .select('advance_id, status')
          .in('id', row.advanceInstallmentIds);

        if (instData) {
          const advanceIds = [...new Set(instData.map(i => i.advance_id))];
          for (const advId of advanceIds) {
            const { data: allInsts } = await supabase
              .from('advance_installments')
              .select('status')
              .eq('advance_id', advId);
            if (allInsts?.every(i => i.status === 'deducted')) {
              await supabase.from('advances').update({ status: 'completed' }).eq('id', advId);
            }
          }
        }
      }

      updateRow(row.id, { status: 'paid', isDirty: false });
      toast({ title: '✅ تم الصرف وحفظ سجل الراتب' });
      if (row.phone) {
        const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
        sendWhatsAppMessage(row.phone, `مرحباً ${row.employeeName} 👋\n\n✅ تم صرف راتبك لشهر ${monthLabel}\nالمبلغ: ${computeRow(row).netSalary.toLocaleString()} ر.س\n\nشكراً لجهودك.`)
          .then(ok => { if (!ok) toast({ title: 'تعذّر إرسال إشعار واتساب' }); });
      }
    } catch (err: any) {
      toast({ title: 'خطأ أثناء الصرف', description: err.message, variant: 'destructive' });
    }
    setMarkingPaid(null);
  };

  const approveAll = async () => {
    const pendingRows = filtered.filter(r => r.status === 'pending');
    if (pendingRows.length === 0) return;

    // Upsert all to salary_records
    const nowStr = new Date().toISOString();
    const records = pendingRows.map(row => {
      const c = computeRow(row);
      return {
        employee_id: row.employeeId,
        month_year: selectedMonth,
        base_salary: c.totalPlatformSalary,
        allowances: c.totalAdditions,
        attendance_deduction: row.violations,
        advance_deduction: row.advanceDeduction,
        external_deduction: row.externalDeduction,
        manual_deduction: row.walletHunger + row.walletTuyo + row.walletJahiz + row.foodDamage,
        net_salary: c.netSalary,
        is_approved: true,
        approved_by: user?.id ?? null,
        approved_at: nowStr,
      };
    });

    const { error } = await supabase.from('salary_records').upsert(records, { onConflict: 'employee_id,month_year' });
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
        const canvas = await html2canvas(batchSlipRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
  }, [batchIndex, batchQueue, batchZip, selectedMonth]);

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

  const exportExcel = () => {
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
      row['محفظة هنقرستيشن'] = r.walletHunger;
      row['محفظة تويو'] = r.walletTuyo;
      row['محفظة جاهز'] = r.walletJahiz;
      row['تلف طعام'] = r.foodDamage;
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
      const statusStyle = r.status === 'paid' ? 'background:#dcfce7;color:#15803d' : r.status === 'approved' ? 'background:#dbeafe;color:#1d4ed8' : 'background:#fef9c3;color:#92400e';
      const statusLabel = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' }[r.status];
      return `<tr>
        <td>${r.employeeName}</td>
        <td style="text-align:center;color:#555;font-size:11px">${r.nationalId || '—'}</td>
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
      `<th style="background:#4f46e5;color:#fff">${p}</th>`
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
          <div class="company-name">${projectName || 'نظام التوصيل'}</div>
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

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  };

  // ── Generate & print individual PDF per employee ──────────────────
  const generateEmployeePDF = (row: SalaryRow, monthLabel: string) => {
    const c = computeRow(row);
    const html = `<html dir="rtl"><head><meta charset="utf-8">
    <title>كشف راتب — ${row.employeeName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px;background:#fff}
      .page{max-width:700px;margin:0 auto}
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
      @media print{body{padding:10px}.page{max-width:100%}}
    </style></head><body>
    <div class="page">
      <div class="header">
        <div>
          <div class="title">🚀 كشف راتب شهري</div>
          <div class="subtitle">${monthLabel}</div>
        </div>
        <span class="badge badge-${row.status}">${{ pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' }[row.status]}</span>
      </div>

      <div class="info-grid">
        <div class="info-row"><span class="info-label">الاسم الكامل</span><span class="info-value">${row.employeeName}</span></div>
        <div class="info-row"><span class="info-label">رقم الهوية</span><span class="info-value">${row.nationalId}</span></div>
        <div class="info-row"><span class="info-label">المدينة</span><span class="info-value">${row.city}</span></div>
        <div class="info-row"><span class="info-label">طريقة الصرف</span><span class="info-value">${row.paymentMethod === 'bank' ? '🏦 بنكي' : '💵 كاش'}</span></div>
      </div>

      <h3>الطلبات والراتب حسب المنصة</h3>
      <table>
        <tr><td class="label" style="background:#e0e7ff;color:#4338ca;font-weight:700">المنصة</td>
            <td style="background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center">عدد الطلبات</td>
            <td style="background:#e0e7ff;color:#4338ca;font-weight:700;text-align:center">الراتب</td></tr>
        ${row.registeredApps.length > 0 ? row.registeredApps.map(app => {
          const orders = row.platformOrders[app] || 0;
          const salary = row.platformSalaries[app] || 0;
          return `<tr><td class="label">${app}</td><td style="text-align:center">${orders.toLocaleString()}</td><td class="val-blue" style="text-align:center">${salary.toLocaleString()} ر.س</td></tr>`;
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
        ${row.advanceRemaining > 0 ? `<tr><td class="label">رصيد السلفة المتبقي (للمعلومية)</td><td class="val-orange">${row.advanceRemaining.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.externalDeduction > 0 ? `<tr><td class="label">خصومات خارجية</td><td class="val-red">- ${row.externalDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.violations > 0 ? `<tr><td class="label">مخالفات</td><td class="val-red">- ${row.violations.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.walletHunger > 0 ? `<tr><td class="label">محفظة هنقرستيشن</td><td class="val-red">- ${row.walletHunger.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.walletTuyo > 0 ? `<tr><td class="label">محفظة تويو</td><td class="val-red">- ${row.walletTuyo.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.walletJahiz > 0 ? `<tr><td class="label">محفظة جاهز</td><td class="val-red">- ${row.walletJahiz.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.foodDamage > 0 ? `<tr><td class="label">تلف طعام</td><td class="val-red">- ${row.foodDamage.toLocaleString()} ر.س</td></tr>` : ''}
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
    </div></body></html>`;
    return html;
  };

  // ── Download individual PDFs — one file per employee named after them ──
  const downloadAllPDFs = () => {
    const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
    const toPrint = filtered;
    if (toPrint.length === 0) { toast({ title: 'لا يوجد بيانات للتحميل' }); return; }

    import('jspdf').then(async ({ default: jsPDF }) => {
      const autoTableMod = await import('jspdf-autotable');
      const autoTable = autoTableMod.default;

      toPrint.forEach((row, idx) => {
        setTimeout(() => {
          const c = computeRow(row);
          const [y, m] = selectedMonth.split('-');
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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
            startY: (doc as any).lastAutoTable.finalY + 6,
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
              startY: (doc as any).lastAutoTable.finalY + 6,
              head: [['Deductions / المستقطعات', 'Amount / المبلغ']],
              body: dedBody,
              headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
              styles: { fontSize: 9 },
            });
          }

          // Net salary
          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 6,
            body: [['Net Salary / الراتب الصافي', c.netSalary.toLocaleString() + ' SAR']],
            styles: { fontSize: 12, fontStyle: 'bold', fillColor: [240, 253, 244], textColor: [22, 163, 74], cellPadding: 4 },
          });

          // Footer signature
          const finalY = (doc as any).lastAutoTable.finalY + 20;
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('Employee Signature: ___________________', 20, finalY);
          doc.text('Manager Approval: ___________________', 120, finalY);

          const safeName = row.employeeName.replace(/\s+/g, '_');
          doc.save(`كشف_راتب_${safeName}_${m}_${y}.pdf`);
        }, idx * 200);
      });
      toast({ title: `⬇️ جارٍ تحميل ${toPrint.length} ملف PDF...` });
    });
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
          <div class="info-row"><span class="info-label">الاسم الكامل</span><span class="info-value">${row.employeeName}</span></div>
          <div class="info-row"><span class="info-label">رقم الهوية</span><span class="info-value">${row.nationalId}</span></div>
          <div class="info-row"><span class="info-label">المدينة</span><span class="info-value">${row.city}</span></div>
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
            return `<tr><td class="label">${app}</td><td style="text-align:center">${orders.toLocaleString()}</td><td class="val-blue" style="text-align:center">${salary.toLocaleString()} ر.س</td></tr>`;
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
          ${row.walletHunger > 0 ? `<tr><td class="label">محفظة هنقرستيشن</td><td class="val-red">- ${row.walletHunger.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.walletTuyo > 0 ? `<tr><td class="label">محفظة تويو</td><td class="val-red">- ${row.walletTuyo.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.walletJahiz > 0 ? `<tr><td class="label">محفظة جاهز</td><td class="val-red">- ${row.walletJahiz.toLocaleString()} ر.س</td></tr>` : ''}
          ${row.foodDamage > 0 ? `<tr><td class="label">تلف طعام</td><td class="val-red">- ${row.foodDamage.toLocaleString()} ر.س</td></tr>` : ''}
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

    const win = window.open('', '_blank');
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
    acc.walletH += r.walletHunger;
    acc.walletT += r.walletTuyo;
    acc.walletJ += r.walletJahiz;
    acc.food += r.foodDamage;
    acc.totalDed += c.totalDeductions;
    acc.net += c.netSalary;
    acc.transfer += r.transfer;
    acc.remaining += c.remaining;
    return acc;
  }, {
    platform: {} as Record<string, number>,
    platformSalaries: 0, incentives: 0, sickAllowance: 0,
    totalAdditions: 0, totalWithSalary: 0,
    advance: 0, externalDed: 0, violations: 0, walletH: 0, walletT: 0, walletJ: 0,
    food: 0, totalDed: 0, net: 0, transfer: 0, remaining: 0,
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

  const thFrozenBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border border-border/60 bg-muted/60 text-right sticky z-20";
  const thBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border border-border/60 bg-muted/50 text-center";
  const tdFrozenClass = "px-3 py-2 text-xs whitespace-nowrap border border-border/40 bg-card sticky z-10";
  const tdClass = "px-3 py-2 text-xs whitespace-nowrap text-center border border-border/40";
  const tfClass = "px-3 py-2 text-xs font-bold whitespace-nowrap text-center border border-border/60 bg-muted/60";
  const stickyLeft = (offset: number) => ({ left: offset });

  return (
    <div className="space-y-4 h-full flex flex-col" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>الرواتب الشهرية</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><Wallet size={20} /> الرواتب الشهرية</h1>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="bg-card border-t-4 border-primary rounded-xl p-4 shadow-sm">
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
            <div key={p} className="bg-card rounded-xl p-4 shadow-sm border-t-4" style={{ borderTopColor: pc?.header || 'hsl(var(--primary))' }}>
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
            <div className="bg-card border-t-4 border-muted-foreground/30 rounded-xl p-4 shadow-sm">
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

      {/* Status mini-cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">بانتظار الاعتماد</p>
          <p className="text-2xl font-bold text-warning mt-1">{pendingCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">معتمد</p>
          <p className="text-2xl font-bold text-success mt-1">{approvedCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">مصروف</p>
          <p className="text-2xl font-bold text-info mt-1">{paidCount}</p>
        </div>
      </div>

      {/* Setup Required Banner — platforms without scheme */}
      {appsWithoutScheme.length > 0 && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
          <Settings2 size={18} className="text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">إعداد مطلوب — منصات بدون سكيمة رواتب</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              المنصات التالية لا تملك سكيمة محددة وسيكون الراتب صفر:
              <span className="font-semibold text-warning mr-1">{appsWithoutScheme.join(' · ')}</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-warning/40 text-warning hover:bg-warning/10 flex-shrink-0"
            onClick={() => navigate('/settings/schemes')}
          >
            <Settings2 size={13} /> إعداد الآن
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
          {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'معلّق' }, { v: 'approved', l: 'معتمد' }, { v: 'paid', l: 'مصروف' }].map(s => (
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
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"><Download size={13} /> 📥 تحميل ▾</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>📊 تصدير Excel</DropdownMenuItem>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowImport(true)}>
                <FileUp size={13} className="ml-2" /> استيراد Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrintTable}>
                <Printer size={13} className="ml-2" /> طباعة جدول الرواتب
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card border border-border/50 rounded-xl p-4 space-y-2 animate-pulse">
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
        // Fixed deduction columns count: advance, remaining, external, violations + dynamic custom cols + total = 4 + allCustomCols.length + 1
        const dedColCount = 4 + allCustomCols.length + 1;
        return (
      <div className="flex-1 min-h-0 rounded-xl border border-border/50 shadow-sm bg-card overflow-hidden">
        {loadingData ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            جارٍ تحميل بيانات الرواتب...
          </div>
        ) : rows.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            لا يوجد موظفون نشطون أو بيانات لهذا الشهر
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)]">
            <table className="text-sm border-collapse" style={{ minWidth: 1800 }}>
              <thead className="sticky top-0 z-30">
                <tr className="bg-muted/70 border-b border-border/50">
                  <th colSpan={3} className={`${thFrozenBase} border-l border-border/50`} style={stickyLeft(0)}>بيانات المندوب</th>
                  <th colSpan={platforms.length} className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">
                    المنصات (نقر مزدوج لتعديل الطلبات)
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">الراتب الأساسي</th>
                  <th colSpan={4} className="px-3 py-2 text-xs font-semibold text-success whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">الإضافات</th>
                  <th colSpan={dedColCount} className="px-3 py-2 text-xs font-semibold text-destructive whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">المستقطعات</th>
                  <th colSpan={3} className="px-3 py-2 text-xs font-semibold text-success whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">الصافي والصرف</th>
                  <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">معلومات الصرف</th>
                  <th colSpan={3} className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/40 text-center">الإجراءات</th>
                </tr>
                <tr className="bg-muted/50">
                  <th className={`${thFrozenBase} w-44 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(0)} onClick={() => handleSort('employeeName')}>
                    الاسم <SortIcon field="employeeName" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thFrozenBase} w-28 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(176)} onClick={() => handleSort('jobTitle')}>
                    المسمى الوظيفي <SortIcon field="jobTitle" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thFrozenBase} w-28 border-l border-border/50 cursor-pointer hover:text-foreground select-none`} style={stickyLeft(288)} onClick={() => handleSort('nationalId')}>
                    رقم الهوية <SortIcon field="nationalId" sortField={sortField} sortDir={sortDir} />
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
                  <th className={thBase}>الراتب الأساسي</th>
                  <th className={thBase}>حوافز</th>
                  <th className={thBase}>إجازة مرضية</th>
                  <th className={thBase}>إجمالي الإضافات</th>
                  <th className={`${thBase} border-l border-border/50`}>الإجمالي مع الراتب</th>
                  <th className={thBase}>قسط سلفة</th>
                  <th className={thBase}>رصيد السلف المتبقي</th>
                  <th className={thBase}>استقطاعات خارجية</th>
                  <th className={thBase}>مخالفات</th>
                  {allCustomCols.map(col => (
                    <th key={col.fullKey} className={thBase}>{col.label}</th>
                  ))}
                  <th className={`${thBase} border-l border-border/50`}>إجمالي المستقطعات</th>
                  <th className={thBase}>الصافي</th>
                  <th className={thBase}>تحويل</th>
                  <th className={`${thBase} border-l border-border/50`}>متبقي</th>
                  <th className={thBase}>طريقة الصرف</th>
                  <th className={`${thBase} border-l border-border/50`}>المدينة</th>
                  <th className={thBase}>الحالة</th>
                  <th className={thBase}>اعتماد</th>
                  <th className={thBase}>صرف</th>
                  <th className={thBase}>طباعة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const c = computeRow(r);
                  if (!c) return null;
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className={`${tdClass} sticky font-medium whitespace-nowrap`} style={{ left: 0, zIndex: 10, background: 'hsl(var(--card))' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="whitespace-nowrap">{r.employeeName}</span>
                          {r.isDirty && (
                            <span title="تم تعديل البيانات بعد الاعتماد — يرجى إعادة الاعتماد" className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/40 whitespace-nowrap cursor-help">
                              <AlertTriangle size={9} /> يحتاج إعادة اعتماد
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`} style={{ position: 'sticky', left: 176, zIndex: 10, background: 'hsl(var(--card))' }}>{r.jobTitle}</td>
                      <td className={`${tdClass} border-l border-border/30 text-muted-foreground text-xs whitespace-nowrap`} style={{ position: 'sticky', left: 288, zIndex: 10, background: 'hsl(var(--card))' }}>{r.nationalId}</td>
                      {platforms.map(p => {
                        const pc = platformColors[p];
                        const orders = r.platformOrders[p] || 0;
                        const salary = r.platformSalaries[p] || 0;
                        const scheme = empPlatformScheme?.[r.employeeId]?.[p];
                        const target = scheme?.target_orders;
                        const hitTarget = target && orders >= target;
                        const rowBg = orders === 0 ? undefined : hitTarget ? 'rgba(34,197,94,0.08)' : pc?.cellBg;
                        // Check if employee has no scheme assigned (null = registered but no scheme)
                        const noScheme = orders > 0 && scheme === null;
                        return (
                          // Single cell: orders + salary below in small text
                      <td key={`${p}-col`} className={`${tdClass} text-center border-l border-border/20`}
                            style={{ background: noScheme ? 'rgba(234,179,8,0.1)' : rowBg }}
                            onDoubleClick={() => setEditingCell({ rowId: r.id, platform: p })}>
                            {editingCell?.rowId === r.id && editingCell?.platform === p ? (
                              <input
                                autoFocus
                                type="number"
                                defaultValue={orders}
                                className="w-16 text-center border rounded px-1 py-0.5 text-xs bg-background"
                                style={{ borderColor: pc?.focusBorder }}
                                onBlur={e => { updatePlatformOrders(r.id, p, Number(e.target.value)); setEditingCell(null); }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null); }}
                              />
                            ) : (
                              <SalaryBreakdown orders={orders} scheme={scheme || null} salary={salary}>
                                <div className="flex flex-col items-center leading-tight">
                                  <span
                                    className={`font-semibold text-xs ${orders === 0 ? 'text-muted-foreground/30' : 'text-foreground'}`}
                                  >
                                    {orders === 0 ? '—' : orders}
                                  </span>
                                   {orders > 0 && (
                                     noScheme ? (
                                       <span className="text-[9px] text-warning font-semibold">⚙️ إعداد مطلوب</span>
                                     ) : (
                                      <span className="text-[10px] text-foreground opacity-75 font-normal">
                                        {salary.toLocaleString()} ر.س
                                      </span>
                                    )
                                  )}
                                </div>
                              </SalaryBreakdown>
                            )}
                          </td>
                        );
                      })}
                      <td className={`${tdClass} font-bold text-foreground border-l border-border/20`}>{c.totalPlatformSalary.toLocaleString()}</td>
                      <td className={tdClass}><EditableCell value={r.incentives} onChange={v => updateRow(r.id, { incentives: v })} className="text-foreground" /></td>
                      <td className={tdClass}><EditableCell value={r.sickAllowance} onChange={v => updateRow(r.id, { sickAllowance: v })} className="text-foreground" /></td>
                      <td className={`${tdClass} text-foreground font-semibold`}>{c.totalAdditions.toLocaleString()}</td>
                      <td className={`${tdClass} font-bold text-foreground border-l border-border/20`}>{c.totalWithSalary.toLocaleString()}</td>
                      <td className={`${tdClass}`}>
                        {r.advanceDeduction > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-foreground font-semibold">{r.advanceDeduction.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground">قسط سلفة</span>
                          </div>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={tdClass}>
                        {r.advanceRemaining > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-foreground font-semibold">{r.advanceRemaining.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground">متبقي</span>
                          </div>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={`${tdClass} text-foreground`}>{r.externalDeduction > 0 ? r.externalDeduction.toLocaleString() : <span className="text-muted-foreground/30">—</span>}</td>
                      <td className={tdClass}><EditableCell value={r.violations} onChange={v => updateRow(r.id, { violations: v })} className="text-foreground" /></td>
                      <td className={tdClass}><EditableCell value={r.walletHunger} onChange={v => updateRow(r.id, { walletHunger: v })} className="text-foreground" /></td>
                      <td className={tdClass}><EditableCell value={r.walletTuyo} onChange={v => updateRow(r.id, { walletTuyo: v })} className="text-foreground" /></td>
                      <td className={`${tdClass} border-l border-border/20`}><EditableCell value={r.foodDamage} onChange={v => updateRow(r.id, { foodDamage: v })} className="text-foreground" /></td>
                      <td className={`${tdClass} font-bold text-foreground border-l border-border/20`}>
                        {c.totalDeductions > 0 ? c.totalDeductions.toLocaleString() : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={`${tdClass} font-black text-foreground text-base`}>{c.netSalary.toLocaleString()}</td>
                      <td className={tdClass}>
                        <EditableCell value={r.transfer} onChange={v => updateRow(r.id, { transfer: Math.min(v, c.netSalary) })} />
                      </td>
                      <td className={`${tdClass} border-l border-border/20`}>{c.remaining.toLocaleString()}</td>
                      <td className={tdClass}>
                        <select
                          value={r.paymentMethod}
                          onChange={e => updateRow(r.id, { paymentMethod: e.target.value as 'bank' | 'cash' })}
                          className={`text-xs px-1.5 py-0.5 rounded-md border border-border/50 bg-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary ${r.paymentMethod === 'bank' ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                          <option value="bank">🏦 بنك</option>
                          <option value="cash">💵 كاش</option>
                        </select>
                      </td>
                      <td className={`${tdClass} border-l border-border/20`}>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.city === 'مكة' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {r.city}
                        </span>
                      </td>
                      <td className={tdClass}><span className={statusStyles[r.status]}>{statusLabels[r.status]}</span></td>
                      <td className={tdClass}>
                        {r.status === 'pending' && (
                          <button onClick={() => approveRow(r.id)} className="text-success hover:text-success/70 transition-colors" title="اعتماد">
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </td>
                      <td className={tdClass}>
                        {r.status === 'approved' && (
                          <button
                            onClick={() => markAsPaid(r)}
                            disabled={markingPaid === r.id}
                            className="text-primary hover:text-primary/70 transition-colors text-xs font-semibold"
                            title="تم الصرف"
                          >
                            {markingPaid === r.id ? '...' : '✅'}
                          </button>
                        )}
                      </td>
                      <td className={tdClass}>
                        <button onClick={() => setPayslipRow(r)} className="text-muted-foreground hover:text-primary transition-colors" title="كشف راتب PDF">
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                 {/* Totals footer */}
                 <tr className="bg-muted/60 border-t-2 border-border">
                   <td className={`${tfClass} sticky text-right border-l border-border/30`} style={{ left: 0, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}>الإجمالي</td>
                   <td className={tfClass} style={{ position: 'sticky', left: 176, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}></td>
                   <td className={`${tfClass} border-l border-border/30`} style={{ position: 'sticky', left: 288, zIndex: 20, background: 'hsl(var(--muted) / 0.6)' }}></td>
                    {platforms.map(p => {
                      const pc = platformColors[p];
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
                    <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.platformSalaries.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.incentives.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.sickAllowance.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.totalAdditions.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.totalWithSalary.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.advance.toLocaleString()}</td>
                    <td className={tfClass}>—</td>
                    <td className={`${tfClass} text-foreground`}>{totals.externalDed.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.violations.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.walletH.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground`}>{totals.walletT.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.food.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground border-l border-border/30`}>{totals.totalDed.toLocaleString()}</td>
                    <td className={`${tfClass} text-foreground text-base`}>{totals.net.toLocaleString()}</td>
                   <td className={tfClass}>{totals.transfer.toLocaleString()}</td>
                   <td className={`${tfClass} border-l border-border/30`}>{totals.remaining.toLocaleString()}</td>
                   <td className={tfClass} colSpan={6}></td>
                 </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {payslipRow && (
        <PayslipModal
          row={payslipRow}
          selectedMonth={selectedMonth}
          companyName={projectName}
          onClose={() => setPayslipRow(null)}
          onApprove={() => { approveRow(payslipRow.id); setPayslipRow(null); }}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

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
          { key: 'hunger', label: t.walletHunger, val: row.walletHunger },
          { key: 'tuyo', label: t.walletTuyo, val: row.walletTuyo },
          { key: 'jahiz', label: t.walletJahiz, val: row.walletJahiz },
          { key: 'food', label: t.foodDamage, val: row.foodDamage },
        ];
        const deductionItems = allDeductions.filter(d => d.val > 0);
        const totalDeductions = allDeductions.reduce((s, d) => s + d.val, 0);
        const netSalary = Math.max(0, totalEarnings - totalDeductions);
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
