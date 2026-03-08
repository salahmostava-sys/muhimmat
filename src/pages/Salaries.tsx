import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Wallet, Download, CheckCircle, Printer, Upload, FileUp, ChevronUp, ChevronDown, ChevronsUpDown, LayoutGrid, Table2, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAppColors, AppColorData } from '@/hooks/useAppColors';
import { useAuth } from '@/context/AuthContext';

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
  isDirty?: boolean; // true if edited after approval/save
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

interface PayslipProps { row: SalaryRow; onClose: () => void; onApprove: () => void; selectedMonth: string; }

const PayslipModal = ({ row, onClose, onApprove, selectedMonth }: PayslipProps) => {
  const totalPlatformSalary = Object.values(row.platformSalaries).reduce((s, v) => s + v, 0);
  const totalAdditions = row.incentives + row.sickAllowance;
  const totalWithSalary = totalPlatformSalary + totalAdditions;
  const totalDeductions = row.advanceDeduction + row.violations + row.walletHunger + row.walletTuyo + row.walletJahiz + row.foodDamage + row.externalDeduction;
  const netSalary = Math.max(0, totalWithSalary - totalDeductions);
  const remaining = netSalary - row.transfer;
  const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;

  const printPayslip = () => {
    const html = `<html dir="rtl"><head><meta charset="utf-8"><title>كشف راتب</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;max-width:650px;margin:0 auto;color:#222}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}.logo{font-size:22px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:8px 12px;border:1px solid #ddd;font-size:13px}.label{background:#f5f5f5;font-weight:600;width:50%}.green{color:#16a34a}.red{color:#dc2626}.blue{color:#2563eb}.total-row{background:#dbeafe;font-weight:bold;font-size:15px}.net-row{background:#dcfce7;font-weight:bold;font-size:16px}.footer{margin-top:30px;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:20px}h3{margin:20px 0 8px;font-size:14px;color:#555}</style>
      </head><body>
      <div class="header"><div class="logo">🚀 نظام إدارة التوصيل</div><p style="color:#666;margin:5px 0">كشف راتب — ${monthLabel}</p></div>
      <h3>بيانات المندوب</h3><table>
        <tr><td class="label">الاسم</td><td>${row.employeeName}</td></tr>
        <tr><td class="label">رقم الهوية</td><td>${row.nationalId}</td></tr>
        <tr><td class="label">المدينة</td><td>${row.city}</td></tr>
      </table>
      <h3>الطلبات والرواتب حسب المنصة</h3><table>
        ${row.registeredApps.map(app => {
          const orders = row.platformOrders[app] || 0;
          const salary = row.platformSalaries[app] || 0;
          return `<tr><td class="label">${app} (${orders} طلب)</td><td class="blue">${salary.toLocaleString()} ر.س</td></tr>`;
        }).join('')}
        <tr class="total-row"><td class="label">الإجمالي</td><td class="blue">${totalPlatformSalary.toLocaleString()} ر.س</td></tr>
      </table>
      <h3>المستقطعات</h3><table>
        ${row.advanceDeduction > 0 ? `<tr><td class="label">السلف</td><td class="red">- ${row.advanceDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.externalDeduction > 0 ? `<tr><td class="label">خصومات خارجية</td><td class="red">- ${row.externalDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        ${row.violations > 0 ? `<tr><td class="label">المخالفات</td><td class="red">- ${row.violations.toLocaleString()} ر.س</td></tr>` : ''}
        <tr class="total-row"><td class="label">إجمالي المستقطعات</td><td class="red">- ${totalDeductions.toLocaleString()} ر.س</td></tr>
      </table>
      <h3>الصافي</h3><table>
        <tr class="net-row"><td class="label">إجمالي الراتب الصافي</td><td class="green">${netSalary.toLocaleString()} ر.س</td></tr>
        <tr><td class="label">التحويل</td><td>${row.transfer.toLocaleString()} ر.س</td></tr>
        <tr><td class="label">المتبقي</td><td>${remaining.toLocaleString()} ر.س</td></tr>
      </table>
      <div class="footer"><div>توقيع المندوب: _______________</div><div>اعتماد الإدارة: _______________</div></div>
      </body></html>`;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
    win?.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>كشف راتب — {row.employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">الشهر: </span><span className="font-medium">{monthLabel}</span></div>
            <div><span className="text-muted-foreground">المدينة: </span><span className="font-medium">{row.city}</span></div>
            <div><span className="text-muted-foreground">رقم الهوية: </span><span className="font-medium">{row.nationalId}</span></div>
            <div><span className="text-muted-foreground">الحالة: </span><span className={statusStyles[row.status]}>{statusLabels[row.status]}</span></div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">الطلبات حسب المنصة</p>
            {row.registeredApps.map(app => {
              const orders = row.platformOrders[app] || 0;
              const salary = row.platformSalaries[app] || 0;
              const color = PLATFORM_COLORS[app]?.valueColor || 'hsl(var(--primary))';
              return (
                <div key={app} className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">{app} ({orders} طلب)</span>
                  <span className="font-semibold" style={{ color }}>{salary.toLocaleString()} ر.س</span>
                </div>
              );
            })}
            <div className="flex justify-between py-2 font-bold text-primary bg-primary/5 px-2 rounded mt-1">
              <span>إجمالي الراتب الأساسي</span>
              <span>{totalPlatformSalary.toLocaleString()} ر.س</span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">الإضافات</p>
            <div className="flex justify-between py-1.5 border-b border-border/30">
              <span className="text-success">الحوافز</span>
              <span className="font-semibold text-success">+{row.incentives.toLocaleString()} ر.س</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/30">
              <span className="text-success">بدل مرضي</span>
              <span className="font-semibold text-success">+{row.sickAllowance.toLocaleString()} ر.س</span>
            </div>
            <div className="flex justify-between py-2 font-bold text-primary bg-primary/5 px-2 rounded mt-1">
              <span>المجموع مع الراتب</span>
              <span>{totalWithSalary.toLocaleString()} ر.س</span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">المستقطعات</p>
            {[
              { l: 'قسط سلفة', v: row.advanceDeduction },
              { l: 'خصومات خارجية', v: row.externalDeduction },
              { l: 'المخالفات', v: row.violations },
              { l: 'محفظة هنقرستيشن', v: row.walletHunger },
              { l: 'محفظة تويو', v: row.walletTuyo },
              { l: 'محفظة جاهز', v: row.walletJahiz },
              { l: 'تلف طعام', v: row.foodDamage },
            ].filter(x => x.v > 0).map(x => (
              <div key={x.l} className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-destructive">{x.l}</span>
                <span className="font-semibold text-destructive">-{x.v.toLocaleString()} ر.س</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-bold text-destructive bg-destructive/5 px-2 rounded mt-1">
              <span>إجمالي المستقطعات</span>
              <span>-{totalDeductions.toLocaleString()} ر.س</span>
            </div>
          </div>
          <div className="flex justify-between items-center py-3 bg-success/10 rounded-lg px-4">
            <span className="font-bold text-lg">إجمالي الراتب الصافي</span>
            <span className="text-2xl font-black text-success">{netSalary.toLocaleString()} ر.س</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">التحويل</p>
              <p className="font-bold">{row.transfer.toLocaleString()} ر.س</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">المتبقي</p>
              <p className="font-bold">{remaining.toLocaleString()} ر.س</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">طريقة الصرف</p>
                <p className="font-bold">{row.paymentMethod === 'bank' ? '🏦 بنك' : '💵 ماش'}</p>
              </div>
          </div>
        </div>
        <div className="flex gap-2 justify-between pt-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <div className="flex gap-2">
            {row.status === 'pending' && (
              <Button variant="default" className="gap-2" onClick={onApprove}>
                <CheckCircle size={14} /> اعتماد
              </Button>
            )}
            <Button onClick={printPayslip} className="gap-2">
              <Printer size={14} /> طباعة PDF
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

  // Sync platforms & colors from DB apps
  useEffect(() => {
    if (appColorsList.length === 0) return;
    const newColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {};
    const newPlatforms: string[] = [];
    appColorsList.filter(a => a.is_active).forEach(app => {
      newPlatforms.push(app.name);
      newColors[app.name] = {
        header: app.brand_color,
        headerText: app.text_color,
        cellBg: `${app.brand_color}18`,
        valueColor: app.brand_color,
        focusBorder: app.brand_color,
      };
      // keep global in sync for legacy code paths
      PLATFORM_COLORS[app.name] = newColors[app.name];
    });
    setPlatforms(newPlatforms);
    setPlatformColors(newColors);
  }, [appColorsList]);

  // ─── Data fetching ─────────────────────────────────────────────
  useEffect(() => {
    const fetchAllData = async () => {
      setLoadingData(true);
      const [y, m] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;

      const [empRes, schemesRes, extRes, ordersRes, empSchemeRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, job_title, national_id, salary_type, base_salary, iban, city')
          .eq('status', 'active')
          .order('name'),

        supabase
          .from('salary_schemes')
          .select('id, name, name_en, status, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order)')
          .eq('status', 'active'),

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

        // Fetch employee->scheme assignments with app info via employee_apps
        supabase
          .from('employee_apps')
          .select('employee_id, app_id, apps(name), employee_scheme(scheme_id, salary_schemes(id, name, name_en, status, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order)))')
          .eq('status', 'active'),
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
      const schemes = schemesRes.data || [];

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

      // ── Build emp→platform→scheme map from employee_apps + employee_scheme ──
      const builtEmpPlatformScheme: Record<string, Record<string, SchemeData>> = {};
      empSchemeRes.data?.forEach((ea: any) => {
        const appName = ea.apps?.name;
        if (!appName) return;
        const empId = ea.employee_id;
        // employee_scheme is an array (one emp can have multiple schemes)
        const schemeLinks = Array.isArray(ea.employee_scheme) ? ea.employee_scheme : [];
        for (const link of schemeLinks) {
          const s = link.salary_schemes;
          if (!s) continue;
          if (!builtEmpPlatformScheme[empId]) builtEmpPlatformScheme[empId] = {};
          builtEmpPlatformScheme[empId][appName] = s as SchemeData;
          break; // first assignment wins per platform
        }
      });
      setEmpPlatformScheme(builtEmpPlatformScheme);

      const newRows: SalaryRow[] = employees.map(emp => {
        const empOrders = ordMap[emp.id] || {};
        const registeredApps = Object.keys(empOrders).filter(k => empOrders[k] > 0);

        const platformOrders: Record<string, number> = {};
        const platformSalaries: Record<string, number> = {};

        platforms.forEach(p => {
          const orders = empOrders[p] || 0;
          platformOrders[p] = orders;
          if (orders === 0) { platformSalaries[p] = 0; return; }

          // Priority: employee-specific scheme → name-match → fallback first scheme
          const empScheme = builtEmpPlatformScheme[emp.id]?.[p];
          const nameScheme = schemes.find(s =>
            s.name.includes(p) || (s.name_en && s.name_en.toLowerCase().includes(p.toLowerCase()))
          );
          const scheme = empScheme || nameScheme || (schemes.length > 0 ? schemes[0] : null);

          if (scheme && scheme.salary_scheme_tiers) {
            platformSalaries[p] = calcSalaryFromTiers(orders, scheme.salary_scheme_tiers, scheme.target_orders, scheme.target_bonus);
          } else {
            platformSalaries[p] = orders * 5;
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
          transfer: 0,
          advanceDeduction: advDeduction,
          advanceInstallmentIds: advInstIds[emp.id] || [],
          advanceRemaining: advRemainingMap[emp.id] || 0,
          externalDeduction: extDeduction,
          status,
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
    const totalDeductions = r.advanceDeduction + r.violations + r.walletHunger + r.walletTuyo + r.walletJahiz + r.foodDamage + r.externalDeduction;
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
        salary = value * 5;
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
      manual_deduction: row.walletHunger + row.walletTuyo + row.walletJahiz + row.foodDamage,
      net_salary: c.netSalary,
      is_approved: true,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,month_year' });
    updateRow(id, { status: 'approved', isDirty: false });
    toast({ title: '✅ تم اعتماد الراتب' });
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
        <div class="info-row"><span class="info-label">طريقة الصرف</span><span class="info-value">${row.paymentMethod === 'bank' ? '🏦 بنكي' : '💵 ماش'}</span></div>
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

    toPrint.forEach((row, idx) => {
      setTimeout(() => {
        const html = generateEmployeePDF(row, monthLabel);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Clean filename: employee name + month
        const [y, m] = selectedMonth.split('-');
        const safeName = row.employeeName.replace(/\s+/g, '_');
        a.download = `كشف_راتب_${safeName}_${m}_${y}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, idx * 150);
    });
    toast({ title: `⬇️ جارٍ تحميل ${toPrint.length} ملف...`, description: 'كل ملف باسم المندوب — يمكن فتحه في المتصفح والطباعة' });
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
          <div class="info-row"><span class="info-label">طريقة الصرف</span><span class="info-value">${row.paymentMethod === 'bank' ? '🏦 بنكي' : '💵 ماش'}</span></div>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">إجمالي الرواتب</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalNet.toLocaleString()} <span className="text-xs">ر.س</span></p>
        </div>
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
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportExcel}>
            <Download size={13} /> تصدير Excel
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-primary border-primary/40 hover:bg-primary/10" onClick={downloadAllPDFs}>
            <Download size={13} /> ⬇️ تحميل PDF كل مندوب
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-primary border-primary/40 hover:bg-primary/10" onClick={exportMergedPDF}>
            <FileText size={13} /> PDF مدمج للكل
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowImport(true)}>
            <FileUp size={13} /> استيراد Excel
          </Button>
        </div>
      </div>

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
      {viewMode === 'table' && (
      <div className="flex-1 min-h-0 rounded-xl border border-border/50 shadow-sm overflow-hidden bg-card">
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
                  <th colSpan={6} className="px-3 py-2 text-xs font-semibold text-destructive whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">المستقطعات</th>
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
                          {schemeName && <span className="text-[8px] opacity-60 font-normal">{schemeName}</span>}
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
                  <th className={thBase}>محفظة هنقرستيشن</th>
                  <th className={thBase}>محفظة طيو</th>
                  <th className={`${thBase} border-l border-border/50`}>تلف طعام</th>
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
                        return (
                          // Single cell: orders + salary below in small text
                          <td key={`${p}-col`} className={`${tdClass} text-center border-l border-border/20`}
                            style={{ background: rowBg }}
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
                                    style={{ color: orders === 0 ? undefined : pc?.valueColor }}
                                    className={`font-semibold text-xs ${orders === 0 ? 'text-muted-foreground/30' : ''}`}
                                  >
                                    {orders === 0 ? '—' : orders}
                                  </span>
                                  {orders > 0 && (
                                    <span
                                      style={{ color: pc?.valueColor }}
                                      className="text-[10px] opacity-75 font-normal"
                                    >
                                      {salary.toLocaleString()} ر.س
                                    </span>
                                  )}
                                </div>
                              </SalaryBreakdown>
                            )}
                          </td>
                        );
                      })}
                      <td className={`${tdClass} font-bold text-primary border-l border-border/20`}>{c.totalPlatformSalary.toLocaleString()}</td>
                      <td className={tdClass}><EditableCell value={r.incentives} onChange={v => updateRow(r.id, { incentives: v })} className="text-success" /></td>
                      <td className={tdClass}><EditableCell value={r.sickAllowance} onChange={v => updateRow(r.id, { sickAllowance: v })} className="text-success" /></td>
                      <td className={`${tdClass} text-success font-semibold`}>{c.totalAdditions.toLocaleString()}</td>
                      <td className={`${tdClass} font-bold text-primary border-l border-border/20`}>{c.totalWithSalary.toLocaleString()}</td>
                      <td className={`${tdClass}`}>
                        {r.advanceDeduction > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-destructive font-semibold">{r.advanceDeduction.toLocaleString()}</span>
                            <span className="text-[9px] text-warning">قسط سلفة</span>
                          </div>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={tdClass}>
                        {r.advanceRemaining > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-warning font-semibold">{r.advanceRemaining.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground">متبقي</span>
                          </div>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={`${tdClass} text-destructive`}>{r.externalDeduction > 0 ? r.externalDeduction.toLocaleString() : <span className="text-muted-foreground/30">—</span>}</td>
                      <td className={tdClass}><EditableCell value={r.violations} onChange={v => updateRow(r.id, { violations: v })} className="text-destructive" /></td>
                      <td className={tdClass}><EditableCell value={r.walletHunger} onChange={v => updateRow(r.id, { walletHunger: v })} className="text-destructive" /></td>
                      <td className={tdClass}><EditableCell value={r.walletTuyo} onChange={v => updateRow(r.id, { walletTuyo: v })} className="text-destructive" /></td>
                      <td className={`${tdClass} border-l border-border/20`}><EditableCell value={r.foodDamage} onChange={v => updateRow(r.id, { foodDamage: v })} className="text-destructive" /></td>
                      <td className={`${tdClass} font-bold text-destructive border-l border-border/20`}>
                        {c.totalDeductions > 0 ? c.totalDeductions.toLocaleString() : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className={`${tdClass} font-black text-success text-base`}>{c.netSalary.toLocaleString()}</td>
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
                          <option value="cash">💵 ماش</option>
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
                        <td key={`${p}-col`} className={`${tfClass} border-l border-border/20`} style={{ color: pc?.valueColor }}>
                          <div className="flex flex-col items-center leading-tight">
                            <span>{totalOrders.toLocaleString()}</span>
                            <span className="text-[10px] opacity-75 font-normal">{totalSal.toLocaleString()} ر.س</span>
                          </div>
                        </td>
                      );
                    })}
                   <td className={`${tfClass} text-primary border-l border-border/30`}>{totals.platformSalaries.toLocaleString()}</td>
                   <td className={`${tfClass} text-success`}>{totals.incentives.toLocaleString()}</td>
                   <td className={`${tfClass} text-success`}>{totals.sickAllowance.toLocaleString()}</td>
                   <td className={`${tfClass} text-success`}>{totals.totalAdditions.toLocaleString()}</td>
                   <td className={`${tfClass} text-primary border-l border-border/30`}>{totals.totalWithSalary.toLocaleString()}</td>
                   <td className={`${tfClass} text-destructive`}>{totals.advance.toLocaleString()}</td>
                   <td className={`${tfClass} text-warning`}>—</td>
                   <td className={`${tfClass} text-destructive`}>{totals.externalDed.toLocaleString()}</td>
                   <td className={`${tfClass} text-destructive`}>{totals.violations.toLocaleString()}</td>
                   <td className={`${tfClass} text-destructive`}>{totals.walletH.toLocaleString()}</td>
                   <td className={`${tfClass} text-destructive`}>{totals.walletT.toLocaleString()}</td>
                   <td className={`${tfClass} text-destructive border-l border-border/30`}>{totals.food.toLocaleString()}</td>
                   <td className={`${tfClass} text-destructive border-l border-border/30`}>{totals.totalDed.toLocaleString()}</td>
                   <td className={`${tfClass} text-success text-base`}>{totals.net.toLocaleString()}</td>
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
          onClose={() => setPayslipRow(null)}
          onApprove={() => { approveRow(payslipRow.id); setPayslipRow(null); }}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
};

export default Salaries;
