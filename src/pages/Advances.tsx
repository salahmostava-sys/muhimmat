import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, CreditCard, Download, Upload, ChevronDown, ChevronUp, Pause, Play, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────
type AdvanceStatus = 'active' | 'completed' | 'paused';
type InstallmentStatus = 'pending' | 'deducted' | 'deferred';

type Installment = {
  id: string;
  advance_id: string;
  month_year: string;
  amount: number;
  status: InstallmentStatus;
  deducted_at: string | null;
};

type Advance = {
  id: string;
  employee_id: string;
  amount: number;
  monthly_amount: number;
  total_installments: number;
  disbursement_date: string;
  first_deduction_month: string;
  status: AdvanceStatus;
  note: string | null;
  created_at: string;
  employees?: { name: string } | null;
  advance_installments?: Installment[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusLabels: Record<string, string> = { active: 'نشطة', completed: 'مكتملة', paused: 'موقوفة' };
const statusStyles: Record<string, string> = {
  active: 'badge-info',
  completed: 'badge-success',
  paused: 'badge-warning',
};
const instStatusLabel: Record<InstallmentStatus, string> = { pending: 'معلّق', deducted: 'مخصوم', deferred: 'مؤجل' };
const instStatusStyle: Record<InstallmentStatus, string> = {
  deducted: 'badge-success',
  pending: 'badge-warning',
  deferred: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground',
};

const calcPaid = (installments: Installment[]) =>
  installments.filter(i => i.status === 'deducted').reduce((s, i) => s + i.amount, 0);

const calcRemaining = (advance: Advance) => {
  const paid = calcPaid(advance.advance_installments || []);
  return advance.amount - paid;
};

const calcRemainingInstallments = (advance: Advance) => {
  const rem = calcRemaining(advance);
  if (advance.monthly_amount <= 0) return 0;
  return Math.ceil(rem / advance.monthly_amount);
};

const currentMonth = format(new Date(), 'yyyy-MM');

// ─── Edit Advance Modal ───────────────────────────────────────────────────────
interface EditAdvanceModalProps {
  advance: Advance;
  onClose: () => void;
  onSaved: () => void;
}
const EditAdvanceModal = ({ advance, onClose, onSaved }: EditAdvanceModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: advance.amount.toString(),
    disbursement_date: advance.disbursement_date,
    monthly_amount: advance.monthly_amount.toString(),
    first_deduction_month: advance.first_deduction_month,
    status: advance.status as AdvanceStatus,
    note: advance.note || '',
  });

  const remaining = parseFloat(form.amount) || 0;
  const monthly = parseFloat(form.monthly_amount) || 1;
  const projectedInstallments = monthly > 0 ? Math.ceil(remaining / monthly) : 0;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('advances').update({
      amount: parseFloat(form.amount),
      disbursement_date: form.disbursement_date,
      monthly_amount: parseFloat(form.monthly_amount),
      total_installments: projectedInstallments,
      first_deduction_month: form.first_deduction_month,
      status: form.status,
      note: form.note || null,
    }).eq('id', advance.id);

    if (error) {
      setSaving(false);
      return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    }

    // Regenerate pending installments
    await supabase.from('advance_installments').delete()
      .eq('advance_id', advance.id).eq('status', 'pending');

    const installments = [];
    let [year, month] = form.first_deduction_month.split('-').map(Number);
    const paidCount = (advance.advance_installments || []).filter(i => i.status === 'deducted').length;
    const remaining_count = projectedInstallments - paidCount;
    for (let i = 0; i < remaining_count; i++) {
      const my = `${year}-${String(month).padStart(2, '0')}`;
      installments.push({ advance_id: advance.id, month_year: my, amount: parseFloat(form.monthly_amount), status: 'pending' as const });
      month++;
      if (month > 12) { month = 1; year++; }
    }
    if (installments.length > 0) {
      await supabase.from('advance_installments').insert(installments);
    }

    setSaving(false);
    toast({ title: 'تم تحديث السلفة ✅' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>✏️ تعديل السلفة — {advance.employees?.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">المبلغ الإجمالي (ر.س)</label>
            <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">تاريخ الصرف</label>
            <Input type="date" value={form.disbursement_date} onChange={e => setForm(p => ({ ...p, disbursement_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">القسط الشهري (ر.س)</label>
            <Input type="number" value={form.monthly_amount} onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} />
            {form.amount && form.monthly_amount && (
              <p className="text-xs text-muted-foreground mt-1">عدد الأقساط المتبقية = {projectedInstallments}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">أول شهر خصم</label>
            <Input type="month" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الحالة</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AdvanceStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="paused">موقوفة</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">ملاحظات</label>
            <textarea
              value={form.note}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="سبب السلفة أو ملاحظات..."
            />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Employee Detail Modal ─────────────────────────────────────────────────────
interface EmployeeDetailModalProps {
  employeeId: string;
  employeeName: string;
  advances: Advance[];
  onClose: () => void;
  onAddNew: () => void;
}
const EmployeeDetailModal = ({ employeeId, employeeName, advances, onClose, onAddNew }: EmployeeDetailModalProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const empAdvances = advances.filter(a => a.employee_id === employeeId);
  const totalRemaining = empAdvances.filter(a => a.status === 'active').reduce((s, a) => s + calcRemaining(a), 0);

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>سجل السلف — {employeeName}</span>
            <span className="text-sm font-normal text-muted-foreground">إجمالي المتبقي: <span className="text-destructive font-semibold">{totalRemaining.toLocaleString()} ر.س</span></span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {empAdvances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد سلف لهذا المندوب</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-right p-3 font-semibold text-muted-foreground">تاريخ الصرف</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground">المبلغ</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground">المسدّد</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground">المتبقي</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground">القسط</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground">الحالة</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {empAdvances.map(adv => {
                  const paid = calcPaid(adv.advance_installments || []);
                  const rem = adv.amount - paid;
                  const isExpanded = expandedId === adv.id;
                  return (
                    <React.Fragment key={adv.id}>
                      <tr
                        className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : adv.id)}
                      >
                        <td className="p-3 font-medium text-foreground flex items-center gap-1">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {adv.disbursement_date}
                        </td>
                        <td className="p-3 text-center">{adv.amount.toLocaleString()}</td>
                        <td className="p-3 text-center text-success">{paid.toLocaleString()}</td>
                        <td className="p-3 text-center text-destructive font-semibold">{rem.toLocaleString()}</td>
                        <td className="p-3 text-center">{adv.monthly_amount.toLocaleString()}</td>
                        <td className="p-3 text-center"><span className={statusStyles[adv.status]}>{statusLabels[adv.status]}</span></td>
                        <td className="p-3 text-muted-foreground text-xs">{adv.note || '—'}</td>
                      </tr>
                      {isExpanded && (adv.advance_installments || []).length > 0 && (
                        <tr className="bg-muted/10">
                          <td colSpan={7} className="p-0">
                            <div className="px-4 pb-3">
                              <table className="w-full text-xs mt-1">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-right py-1 pr-2">الشهر</th>
                                    <th className="text-center py-1">المبلغ</th>
                                    <th className="text-center py-1">الحالة</th>
                                    <th className="text-center py-1">تاريخ الخصم</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(adv.advance_installments || []).sort((a, b) => a.month_year.localeCompare(b.month_year)).map(inst => (
                                    <tr key={inst.id} className="border-t border-border/20">
                                      <td className="py-1.5 pr-2">{inst.month_year}</td>
                                      <td className="py-1.5 text-center">{inst.amount.toLocaleString()} ر.س</td>
                                      <td className="py-1.5 text-center">
                                        <span className={instStatusStyle[inst.status]}>{instStatusLabel[inst.status]}</span>
                                      </td>
                                      <td className="py-1.5 text-center text-muted-foreground">
                                        {inst.deducted_at ? format(new Date(inst.deducted_at), 'yyyy-MM-dd') : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={onAddNew} className="gap-2"><Plus size={15} /> سلفة جديدة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Advance Card ──────────────────────────────────────────────────────────────
interface AdvanceCardProps {
  advance: Advance;
  onEdit: (a: Advance) => void;
  onTogglePause: (a: Advance) => void;
  onEmployeeClick: (a: Advance) => void;
  onAddNew: () => void;
}
const AdvanceCard = ({ advance: a, onEdit, onTogglePause, onEmployeeClick, onAddNew }: AdvanceCardProps) => {
  const paid = calcPaid(a.advance_installments || []);
  const remaining = a.amount - paid;
  const progress = a.amount > 0 ? (paid / a.amount) * 100 : 0;
  const remInst = calcRemainingInstallments(a);
  const isCompleted = a.status === 'completed';
  const isPaused = a.status === 'paused';

  const thisMonthInst = (a.advance_installments || []).find(i => i.month_year === currentMonth);

  return (
    <div className={`bg-card rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-all ${isPaused ? 'border-yellow-400 dark:border-yellow-600' : 'border-border/50'} ${isCompleted ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onEmployeeClick(a)}
          className="text-base font-semibold text-primary hover:underline text-right"
        >
          {a.employees?.name || '—'}
        </button>
        <span className={statusStyles[a.status]}>{statusLabels[a.status]}</span>
      </div>

      {/* Date */}
      <p className="text-xs text-muted-foreground -mt-2">تاريخ الصرف: {a.disbursement_date}</p>

      {/* Amounts */}
      <div className="flex gap-4">
        <div className="flex-1 text-center bg-info/10 rounded-lg py-2 px-3">
          <p className="text-xs text-muted-foreground">إجمالي</p>
          <p className="text-sm font-bold text-info">{a.amount.toLocaleString()} ر.س</p>
        </div>
        <div className="flex-1 text-center bg-warning/10 rounded-lg py-2 px-3">
          <p className="text-xs text-muted-foreground">متبقي</p>
          <p className="text-sm font-bold text-warning">{remaining.toLocaleString()} ر.س</p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <Progress value={progress} className="h-2 bg-muted [&>div]:bg-success" />
        <p className="text-xs text-muted-foreground mt-1">
          سُدّد {paid.toLocaleString()} ر.س &nbsp;·&nbsp; {remInst} قسط متبقي
        </p>
      </div>

      {/* Monthly installment */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">القسط الشهري</span>
        <span className="font-semibold">{a.monthly_amount.toLocaleString()} ر.س</span>
      </div>

      {/* This month status */}
      {thisMonthInst && (
        <div className="text-xs flex items-center gap-1.5">
          <span className="text-muted-foreground">هذا الشهر:</span>
          <span className={instStatusStyle[thisMonthInst.status]}>{instStatusLabel[thisMonthInst.status]}</span>
        </div>
      )}

      {/* Actions */}
      {isCompleted ? (
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onAddNew}>
          <Plus size={13} /> سلفة جديدة
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => onEdit(a)}>
            <Edit2 size={13} /> تعديل السلفة
          </Button>
          <Button
            size="sm"
            variant={isPaused ? 'default' : 'outline'}
            className="gap-1 text-xs"
            onClick={() => onTogglePause(a)}
          >
            {isPaused ? <><Play size={13} /> تفعيل</> : <><Pause size={13} /> تأجيل</>}
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Add Advance Modal (inline, Supabase-connected) ────────────────────────────
interface AddAdvanceModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultEmployeeId?: string;
  allAdvances: Advance[];
  employees: { id: string; name: string }[];
}
const AddAdvanceModalInline = ({ open, onClose, onSaved, defaultEmployeeId, allAdvances, employees }: AddAdvanceModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: defaultEmployeeId || '',
    amount: '',
    disbursement_date: format(new Date(), 'yyyy-MM-dd'),
    monthly_amount: '',
    first_deduction_month: format(new Date(), 'yyyy-MM'),
    note: '',
  });

  useEffect(() => {
    if (open) setForm(p => ({ ...p, employee_id: defaultEmployeeId || '' }));
  }, [open, defaultEmployeeId]);

  const projectedInstallments = form.amount && form.monthly_amount
    ? Math.ceil(parseFloat(form.amount) / parseFloat(form.monthly_amount))
    : 0;

  const hasActiveAdvance = form.employee_id &&
    allAdvances.some(a => a.employee_id === form.employee_id && a.status === 'active');

  const handleSave = async () => {
    if (!form.employee_id || !form.amount || !form.monthly_amount || !form.disbursement_date || !form.first_deduction_month)
      return toast({ title: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });

    setSaving(true);
    const { data: adv, error } = await supabase.from('advances').insert({
      employee_id: form.employee_id,
      amount: parseFloat(form.amount),
      monthly_amount: parseFloat(form.monthly_amount),
      total_installments: projectedInstallments,
      disbursement_date: form.disbursement_date,
      first_deduction_month: form.first_deduction_month,
      note: form.note || null,
      status: 'active',
    }).select().single();

    if (error || !adv) {
      setSaving(false);
      return toast({ title: 'حدث خطأ', description: error?.message, variant: 'destructive' });
    }

    // Generate installments
    const installments = [];
    let [year, month] = form.first_deduction_month.split('-').map(Number);
    for (let i = 0; i < projectedInstallments; i++) {
      const my = `${year}-${String(month).padStart(2, '0')}`;
      installments.push({ advance_id: adv.id, month_year: my, amount: parseFloat(form.monthly_amount), status: 'pending' as const });
      month++;
      if (month > 12) { month = 1; year++; }
    }
    if (installments.length > 0) await supabase.from('advance_installments').insert(installments);

    setSaving(false);
    toast({ title: 'تم إضافة السلفة بنجاح ✅' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>إضافة سلفة جديدة</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {hasActiveAdvance && (
            <div className="col-span-2 bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
              ⚠️ هذا المندوب لديه سلفة نشطة — هل تريد المتابعة؟
            </div>
          )}
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">المندوب *</label>
            <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">المبلغ الإجمالي (ر.س) *</label>
            <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">القسط الشهري (ر.س) *</label>
            <Input type="number" value={form.monthly_amount} onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} placeholder="0" />
            {projectedInstallments > 0 && (
              <p className="text-xs text-muted-foreground mt-1">عدد الأقساط = {projectedInstallments}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">تاريخ الصرف *</label>
            <Input type="date" value={form.disbursement_date} onChange={e => setForm(p => ({ ...p, disbursement_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">أول شهر خصم *</label>
            <Input type="month" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">ملاحظات</label>
            <textarea
              value={form.note}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'إضافة السلفة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Advances = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('advances');
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultEmployee, setAddDefaultEmployee] = useState<string | undefined>(undefined);
  const [editAdvance, setEditAdvance] = useState<Advance | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<{ id: string; name: string } | null>(null);

  const importRef = useRef<HTMLInputElement>(null);

  const handleImportAdvances = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      if (!rows.length) return toast({ title: 'الملف فارغ', variant: 'destructive' });
      let success = 0;
      for (const row of rows) {
        const empName = row['الاسم'];
        if (!empName) continue;
        const emp = employees.find(e => e.name === empName);
        if (!emp) continue;
        const amount = parseFloat(row['المبلغ']) || 0;
        const monthly = parseFloat(row['القسط']) || amount;
        const installments = monthly > 0 ? Math.ceil(amount / monthly) : 1;
        await supabase.from('advances').insert({
          employee_id: emp.id,
          amount,
          monthly_amount: monthly,
          total_installments: installments,
          disbursement_date: row['تاريخ الصرف'] || format(new Date(), 'yyyy-MM-dd'),
          first_deduction_month: row['أول شهر خصم'] || format(new Date(), 'yyyy-MM'),
          status: 'active',
        });
        success++;
      }
      toast({ title: `تم استيراد ${success} سلفة ✅` });
      fetchAll();
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleAdvancesTemplate = () => {
    const headers = [['الاسم', 'المبلغ', 'القسط', 'تاريخ الصرف (YYYY-MM-DD)', 'أول شهر خصم (YYYY-MM)']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_advances.xlsx');
  };

  const fetchAll = async () => {
    setLoading(true);
    const [advRes, empRes] = await Promise.all([
      supabase.from('advances').select('*, employees(name), advance_installments(*)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
    ]);
    if (advRes.data) setAdvances(advRes.data as Advance[]);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Summary stats
  const stats = useMemo(() => {
    const active = advances.filter(a => a.status === 'active');
    const paused = advances.filter(a => a.status === 'paused');
    const totalRemaining = active.reduce((s, a) => s + calcRemaining(a), 0);
    const thisMonthDeduction = advances.flatMap(a => a.advance_installments || [])
      .filter(i => i.month_year === currentMonth && i.status === 'deducted')
      .reduce((s, i) => s + i.amount, 0);
    return { activeCount: active.length, totalRemaining, thisMonthDeduction, pausedCount: paused.length };
  }, [advances]);

  // Filter
  const filtered = advances.filter(a => {
    const name = a.employees?.name || '';
    const matchSearch = name.includes(search);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleTogglePause = async (a: Advance) => {
    const newStatus: AdvanceStatus = a.status === 'paused' ? 'active' : 'paused';
    const { error } = await supabase.from('advances').update({ status: newStatus }).eq('id', a.id);
    if (error) return toast({ title: 'حدث خطأ', variant: 'destructive' });
    setAdvances(prev => prev.map(adv => adv.id === a.id ? { ...adv, status: newStatus } : adv));
    toast({ title: newStatus === 'active' ? 'تم تفعيل السلفة' : 'تم تأجيل السلفة' });
  };

  const handleExport = () => {
    const rows = filtered.map(a => {
      const paid = calcPaid(a.advance_installments || []);
      const rem = a.amount - paid;
      const remInst = calcRemainingInstallments(a);
      return {
        'الاسم': a.employees?.name || '',
        'المبلغ': a.amount,
        'المسدّد': paid,
        'المتبقي': rem,
        'القسط': a.monthly_amount,
        'أقساط متبقية': remInst,
        'تاريخ الصرف': a.disbursement_date,
        'الحالة': statusLabels[a.status],
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'السلف');
    XLSX.writeFile(wb, `السلف_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>السلف والأقساط</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><CreditCard size={20} /> السلف والأقساط</h1>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportAdvances} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8"><Download size={14} /> 📥 تحميل ▾</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              {permissions.can_edit && (
                <DropdownMenuItem onClick={() => importRef.current?.click()}>
                  <Upload size={14} className="ml-2" /> استيراد Excel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleAdvancesTemplate}>📋 تحميل القالب</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_edit && (
          <Button size="sm" className="gap-2 h-8" onClick={() => { setAddDefaultEmployee(undefined); setAddOpen(true); }}>
            <Plus size={15} /> إضافة سلفة
          </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'عدد السلف النشطة', value: stats.activeCount, color: 'text-primary' },
          { label: 'إجمالي المبالغ المتبقية', value: `${stats.totalRemaining.toLocaleString()} ر.س`, color: 'text-destructive' },
          { label: 'خصم هذا الشهر', value: `${stats.thisMonthDeduction.toLocaleString()} ر.س`, color: 'text-success' },
          { label: 'السلف الموقوفة', value: stats.pausedCount, color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'active', l: 'نشطة' }, { v: 'paused', l: 'موقوفة' }, { v: 'completed', l: 'مكتملة' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/50 p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="flex gap-3">
                <div className="h-12 bg-muted rounded flex-1" />
                <div className="h-12 bg-muted rounded flex-1" />
              </div>
              <div className="h-2 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">لا توجد سلف مطابقة</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <AdvanceCard
              key={a.id}
              advance={a}
              onEdit={setEditAdvance}
              onTogglePause={handleTogglePause}
              onEmployeeClick={adv => setDetailEmployee({ id: adv.employee_id, name: adv.employees?.name || '' })}
              onAddNew={() => { setAddDefaultEmployee(undefined); setAddOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddAdvanceModalInline
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={fetchAll}
        defaultEmployeeId={addDefaultEmployee}
        allAdvances={advances}
        employees={employees}
      />

      {editAdvance && (
        <EditAdvanceModal
          advance={editAdvance}
          onClose={() => setEditAdvance(null)}
          onSaved={fetchAll}
        />
      )}

      {detailEmployee && (
        <EmployeeDetailModal
          employeeId={detailEmployee.id}
          employeeName={detailEmployee.name}
          advances={advances}
          onClose={() => setDetailEmployee(null)}
          onAddNew={() => {
            setAddDefaultEmployee(detailEmployee.id);
            setDetailEmployee(null);
            setAddOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default Advances;
