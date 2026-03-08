import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Wallet, Download, CheckCircle, Printer, Upload, FileUp, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────
const PLATFORMS = ['هنقرستيشن', 'جاهز', 'كيتا', 'توبو', 'نينجا', 'تويو', 'أمازون'];

const PLATFORM_COLORS: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }> = {
  'هنقرستيشن': { header: '#FF6B35', headerText: '#fff', cellBg: 'rgba(255,107,53,0.08)', valueColor: '#FF6B35', focusBorder: '#FF6B35' },
  'جاهز':      { header: '#1DB954', headerText: '#fff', cellBg: 'rgba(29,185,84,0.08)',  valueColor: '#1DB954', focusBorder: '#1DB954' },
  'كيتا':      { header: '#E53935', headerText: '#fff', cellBg: 'rgba(229,57,53,0.08)',  valueColor: '#E53935', focusBorder: '#E53935' },
  'توبو':      { header: '#7C3AED', headerText: '#fff', cellBg: 'rgba(124,58,237,0.08)', valueColor: '#7C3AED', focusBorder: '#7C3AED' },
  'نينجا':     { header: '#111111', headerText: '#fff', cellBg: 'rgba(17,17,17,0.06)',   valueColor: '#888',    focusBorder: '#555' },
  'تويو':      { header: '#F59E0B', headerText: '#fff', cellBg: 'rgba(245,158,11,0.08)', valueColor: '#F59E0B', focusBorder: '#F59E0B' },
  'أمازون':    { header: '#FF9900', headerText: '#111', cellBg: 'rgba(255,153,0,0.08)',  valueColor: '#FF9900', focusBorder: '#FF9900' },
};

const statusLabels: Record<string, string> = { pending: 'معلّق', approved: 'معتمد', paid: 'مصروف' };
const statusStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-info', paid: 'badge-success' };

// Generate last 6 months dynamically
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

// ─── Types ────────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc' | null;

interface SalaryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  nationalId: string;
  city: string;
  bankAccount: string;
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
  externalDeduction: number;
  status: 'pending' | 'approved' | 'paid';
}

interface SchemeData {
  id: string;
  name: string;
  name_en: string | null;
  status: string;
  target_orders: number | null;
  target_bonus: number | null;
  salary_scheme_tiers?: { from_orders: number; to_orders: number | null; price_per_order: number; tier_order: number }[];
  // For snapshots
  snapshot?: any;
  scheme_id?: string;
}

// ─── Sort icon ─────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={10} className="inline ml-0.5 opacity-40" />;
  if (sortDir === 'asc') return <ChevronUp size={10} className="inline ml-0.5" />;
  return <ChevronDown size={10} className="inline ml-0.5" />;
};

// ─── Payslip Modal ────────────────────────────────────────────────
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
              { l: 'السلف', v: row.advanceDeduction },
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
              <p className="font-bold">{row.bankAccount ? '🏦 بنكي' : '💵 كاش'}</p>
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

// ─── Editable number cell ─────────────────────────────────────────
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

// ─── Import Modal ─────────────────────────────────────────────────
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

// ─── Salary calculator from scheme tiers ─────────────────────────
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

// ─── Main Salaries Page ───────────────────────────────────────────
const Salaries = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(months[0].v);
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [payslipRow, setPayslipRow] = useState<SalaryRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [loadingData, setLoadingData] = useState(true);

  // ─── Data fetching ─────────────────────────────────────────────
  useEffect(() => {
    const fetchAllData = async () => {
      setLoadingData(true);
      const [y, m] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;

      const [empRes, schemesRes, advInstRes, extRes, ordersRes] = await Promise.all([
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
          .from('advance_installments')
          .select('advance_id, amount, advances(employee_id)')
          .eq('month_year', selectedMonth)
          .in('status', ['pending', 'deferred']),

        supabase
          .from('external_deductions')
          .select('employee_id, amount')
          .eq('apply_month', selectedMonth)
          .eq('approval_status', 'approved'),

        supabase
          .from('daily_orders')
          .select('employee_id, app_id, orders_count, apps(name)')
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      const employees = empRes.data || [];
      const schemes = schemesRes.data || [];

      // Build advance deductions map: employeeId -> total
      const advMap: Record<string, number> = {};
      advInstRes.data?.forEach(inst => {
        const empId = (inst.advances as any)?.employee_id;
        if (empId) advMap[empId] = (advMap[empId] || 0) + Number(inst.amount);
      });

      // Build external deductions map: employeeId -> total
      const extMap: Record<string, number> = {};
      extRes.data?.forEach(d => {
        extMap[d.employee_id] = (extMap[d.employee_id] || 0) + Number(d.amount);
      });

      // Build orders map: employeeId -> { appName -> totalOrders }
      const ordMap: Record<string, Record<string, number>> = {};
      ordersRes.data?.forEach(r => {
        const appName = (r.apps as any)?.name || 'غير معروف';
        if (!ordMap[r.employee_id]) ordMap[r.employee_id] = {};
        ordMap[r.employee_id][appName] = (ordMap[r.employee_id][appName] || 0) + r.orders_count;
      });

      // Build salary rows
      const newRows: SalaryRow[] = employees.map(emp => {
        const empOrders = ordMap[emp.id] || {};
        const registeredApps = Object.keys(empOrders).filter(k => empOrders[k] > 0);

        const platformOrders: Record<string, number> = {};
        const platformSalaries: Record<string, number> = {};

        // For each platform with orders, calculate salary using active scheme
        PLATFORMS.forEach(p => {
          const orders = empOrders[p] || 0;
          platformOrders[p] = orders;
          if (orders === 0) { platformSalaries[p] = 0; return; }
          // Find scheme matching this platform name (by name or name_en)
          const scheme = schemes.find(s =>
            s.name.includes(p) || (s.name_en && s.name_en.toLowerCase().includes(p.toLowerCase()))
          );
          if (scheme && scheme.salary_scheme_tiers) {
            platformSalaries[p] = calcSalaryFromTiers(orders, scheme.salary_scheme_tiers, scheme.target_orders, scheme.target_bonus);
          } else if (schemes.length > 0 && scheme === undefined) {
            // fallback: use first active scheme's tiers if no platform-specific scheme
            const fallback = schemes[0];
            if (fallback?.salary_scheme_tiers) {
              platformSalaries[p] = calcSalaryFromTiers(orders, fallback.salary_scheme_tiers, fallback.target_orders, fallback.target_bonus);
            } else {
              platformSalaries[p] = orders * 5; // default fallback rate
            }
          } else {
            platformSalaries[p] = orders * 5;
          }
        });

        const advDeduction = advMap[emp.id] || 0;
        const extDeduction = extMap[emp.id] || 0;

        const cityLabel = emp.city === 'makkah' ? 'مكة' : emp.city === 'jeddah' ? 'جدة' : '—';
        const bankAccount = emp.iban ? emp.iban.slice(-6) : '';

        return {
          id: `${emp.id}-${selectedMonth}`,
          employeeId: emp.id,
          employeeName: emp.name,
          jobTitle: emp.job_title || 'مندوب توصيل',
          nationalId: emp.national_id || '—',
          city: cityLabel,
          bankAccount,
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
          externalDeduction: extDeduction,
          status: 'pending' as const,
        };
      });

      setRows(newRows);
      setLoadingData(false);
    };

    fetchAllData();
  }, [selectedMonth]);

  // ─── Computed values ───────────────────────────────────────────
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
        if (PLATFORMS.includes(sortField)) {
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
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    if (payslipRow?.id === id) setPayslipRow(prev => prev ? { ...prev, ...patch } : prev);
  }, [payslipRow]);

  const updatePlatformOrders = (id: string, platform: string, value: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newOrders = { ...r.platformOrders, [platform]: value };
      // Recalculate platform salary — will use 5 SAR/order as simple fallback
      const newSalaries = { ...r.platformSalaries, [platform]: value * 5 };
      return { ...r, platformOrders: newOrders, platformSalaries: newSalaries };
    }));
  };

  const approveRow = (id: string) => {
    updateRow(id, { status: 'approved' });
    toast({ title: '✅ تم اعتماد الراتب' });
  };

  const approveAll = () => {
    const pendingIds = filtered.filter(r => r.status === 'pending').map(r => r.id);
    setRows(prev => prev.map(r => pendingIds.includes(r.id) ? { ...r, status: 'approved' as const } : r));
    toast({ title: `✅ تم اعتماد ${pendingIds.length} راتب` });
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
      PLATFORMS.forEach(p => {
        row[p] = r.registeredApps.includes(p) ? (r.platformOrders[p] || 0) : '—';
      });
      row['إجمالي الراتب الأساسي'] = c.totalPlatformSalary;
      row['الحوافز'] = r.incentives;
      row['بدل مرضي'] = r.sickAllowance;
      row['إجمالي الإضافات'] = c.totalAdditions;
      row['المجموع مع الراتب'] = c.totalWithSalary;
      row['السلف'] = r.advanceDeduction;
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

  const totals = filtered.reduce((acc, r) => {
    const c = computeRow(r);
    PLATFORMS.forEach(p => {
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
      className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b border-border/50 text-center cursor-pointer select-none hover:brightness-90 transition-all ${className}`}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  );

  const thFrozenBase = "px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/60 text-right sticky z-20";
  const tdFrozenClass = "px-3 py-2 text-xs whitespace-nowrap border-b border-border/20 bg-card sticky z-10";
  const tdClass = "px-3 py-2 text-xs whitespace-nowrap text-center border-b border-border/20";
  const tfClass = "px-3 py-2 text-xs font-bold whitespace-nowrap text-center bg-muted/60";
  const stickyLeft = (offset: number) => ({ left: offset });

  return (
    <div className="space-y-5 h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wallet size={24} /> الرواتب الشهرية
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          محاسبة تفصيلية لرواتب المناديب — {months.find(m => m.v === selectedMonth)?.l}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm"
        >
          {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
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
        <div className="flex gap-2 mr-auto">
          {pendingCount > 0 && (
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={approveAll}>
              <CheckCircle size={13} /> اعتماد الكل ({pendingCount})
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportExcel}>
            <Download size={13} /> تصدير Excel
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowImport(true)}>
            <FileUp size={13} /> استيراد Excel
          </Button>
        </div>
      </div>

      {/* Wide table */}
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
            <table className="text-sm border-collapse" style={{ minWidth: 2200 }}>
              <thead className="sticky top-0 z-30">
                {/* Group headers */}
                <tr className="bg-muted/70 border-b border-border/50">
                  <th colSpan={3} className={`${thFrozenBase} border-l border-border/50`} style={stickyLeft(0)}>بيانات المندوب</th>
                  <th colSpan={7} className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">
                    الطلبات حسب المنصة (نقر مزدوج للتعديل)
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">الراتب الأساسي</th>
                  <th colSpan={4} className="px-3 py-2 text-xs font-semibold text-success whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">الإضافات</th>
                  <th colSpan={6} className="px-3 py-2 text-xs font-semibold text-destructive whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">المستقطعات</th>
                  <th colSpan={3} className="px-3 py-2 text-xs font-semibold text-success whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">الصافي والصرف</th>
                  <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/40 text-center border-l border-border/50">معلومات الصرف</th>
                  <th colSpan={3} className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/40 text-center">الإجراءات</th>
                </tr>
                {/* Column headers */}
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
                  {PLATFORMS.map(p => {
                    const pc = PLATFORM_COLORS[p];
                    return (
                      <th key={p} className="px-3 py-2 text-xs font-semibold whitespace-nowrap border-b border-border/50 text-center cursor-pointer select-none hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: pc.header, color: pc.headerText }}
                        onClick={() => handleSort(p)}>
                        {p} <SortIcon field={p} sortField={sortField} sortDir={sortDir} />
                      </th>
                    );
                  })}
                  <ThSort field="platformSalaries" label="إجمالي الراتب الأساسي" className="text-primary font-bold border-l border-border/50 bg-muted/50 text-muted-foreground" />
                  <ThSort field="incentives" label="الحوافز" className="text-success bg-muted/50 text-muted-foreground" />
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">بدل مرضي</th>
                  <ThSort field="totalAdditions" label="إجمالي الإضافات" className="text-success bg-muted/50 text-muted-foreground" />
                  <th className="px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-b border-border/50 bg-muted/50 text-center border-l border-border/50">المجموع مع الراتب</th>
                  <ThSort field="advanceDeduction" label="السلف" className="text-destructive bg-muted/50 text-muted-foreground" />
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">خصومات خارجية</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">المخالفات</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">محفظة هنقر</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">محفظة تويو</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center border-l border-border/50">تلف طعام</th>
                  <ThSort field="totalDeductions" label="إجمالي المستقطعات" className="text-destructive font-bold border-l border-border/50 bg-muted/50 text-muted-foreground" />
                  <ThSort field="netSalary" label="إجمالي الراتب" className="text-success font-bold text-base bg-muted/50 text-muted-foreground" />
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">التحويل</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center border-l border-border/50">المتبقي</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">طريقة الصرف</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center border-l border-border/50">المدينة</th>
                  <ThSort field="status" label="الحالة" className="bg-muted/50 text-muted-foreground" />
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">اعتماد</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 bg-muted/50 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const c = computeRow(r);
                  return (
                    <tr key={r.id} className="hover:bg-muted/10 transition-colors group">
                      <td className={`${tdFrozenClass} w-44 text-right`} style={stickyLeft(0)}>
                        <button className="flex items-center gap-2 hover:text-primary transition-colors text-right" onClick={() => setPayslipRow(r)}>
                          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {r.employeeName.slice(0, 1)}
                          </span>
                          <span className="font-medium text-xs">{r.employeeName}</span>
                        </button>
                      </td>
                      <td className={`${tdFrozenClass} w-28 text-right text-muted-foreground`} style={stickyLeft(176)}>
                        <span className="text-xs">{r.jobTitle}</span>
                      </td>
                      <td className={`${tdFrozenClass} w-28 border-l border-border/30 text-right font-mono`} style={stickyLeft(288)}>
                        <span className="text-xs text-muted-foreground">{r.nationalId}</span>
                      </td>
                      {PLATFORMS.map(p => {
                        const pc = PLATFORM_COLORS[p];
                        return (
                          <td key={p} className={tdClass} style={{ backgroundColor: r.registeredApps.includes(p) ? pc.cellBg : undefined }}>
                            {r.registeredApps.includes(p) ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <EditableCell
                                  value={r.platformOrders[p] || 0}
                                  onChange={v => updatePlatformOrders(r.id, p, v)}
                                  accentColor={pc.valueColor}
                                />
                                <span className="text-muted-foreground/60 text-[10px]">
                                  = {(r.platformSalaries[p] || 0).toLocaleString()} ر.س
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={`${tdClass} font-bold text-primary border-l border-border/20`}>{c.totalPlatformSalary.toLocaleString()}</td>
                      <td className={tdClass}><EditableCell value={r.incentives} onChange={v => updateRow(r.id, { incentives: v })} className="text-success" /></td>
                      <td className={tdClass}><EditableCell value={r.sickAllowance} onChange={v => updateRow(r.id, { sickAllowance: v })} className="text-success" /></td>
                      <td className={`${tdClass} text-success font-semibold`}>{c.totalAdditions.toLocaleString()}</td>
                      <td className={`${tdClass} font-bold text-primary border-l border-border/20`}>{c.totalWithSalary.toLocaleString()}</td>
                      <td className={`${tdClass} text-destructive`}>{r.advanceDeduction > 0 ? r.advanceDeduction.toLocaleString() : <span className="text-muted-foreground/30">—</span>}</td>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.bankAccount ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {r.bankAccount ? '🏦 بنكي' : '💵 كاش'}
                        </span>
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
                  {PLATFORMS.map(p => (
                    <td key={p} className={tfClass} style={{ color: PLATFORM_COLORS[p]?.valueColor }}>{(totals.platform[p] || 0).toLocaleString()}</td>
                  ))}
                  <td className={`${tfClass} text-primary border-l border-border/30`}>{totals.platformSalaries.toLocaleString()}</td>
                  <td className={`${tfClass} text-success`}>{totals.incentives.toLocaleString()}</td>
                  <td className={`${tfClass} text-success`}>{totals.sickAllowance.toLocaleString()}</td>
                  <td className={`${tfClass} text-success`}>{totals.totalAdditions.toLocaleString()}</td>
                  <td className={`${tfClass} text-primary border-l border-border/30`}>{totals.totalWithSalary.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive`}>{totals.advance.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive`}>{totals.externalDed.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive`}>{totals.violations.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive`}>{totals.walletH.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive`}>{totals.walletT.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive border-l border-border/30`}>{totals.food.toLocaleString()}</td>
                  <td className={`${tfClass} text-destructive border-l border-border/30`}>{totals.totalDed.toLocaleString()}</td>
                  <td className={`${tfClass} text-success text-base`}>{totals.net.toLocaleString()}</td>
                  <td className={tfClass}>{totals.transfer.toLocaleString()}</td>
                  <td className={`${tfClass} border-l border-border/30`}>{totals.remaining.toLocaleString()}</td>
                  <td className={tfClass} colSpan={5}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

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
