import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, CreditCard, Download, Upload, Pause, Edit2, FileText, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  notes: string | null;
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
  employees?: { name: string; national_id: string | null } | null;
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

// ─── Transactions Detail Modal ────────────────────────────────────────────────
interface TransactionsModalProps {
  employeeId: string;
  employeeName: string;
  advances: Advance[];
  onClose: () => void;
  onRefresh: () => void;
}
const TransactionsModal = ({ employeeId, employeeName, advances, onClose, onRefresh }: TransactionsModalProps) => {
  const { toast } = useToast();
  const empAdvances = advances.filter(a => a.employee_id === employeeId);
  const allInstallments: (Installment & { advanceDate: string; advanceTotal: number })[] = empAdvances.flatMap(adv =>
    (adv.advance_installments || []).map(i => ({
      ...i,
      advanceDate: adv.disbursement_date,
      advanceTotal: adv.amount,
    }))
  ).sort((a, b) => a.month_year.localeCompare(b.month_year));

  const totalDebt = empAdvances.reduce((s, a) => s + a.amount, 0);
  const totalPaid = empAdvances.reduce((s, a) => s + calcPaid(a.advance_installments || []), 0);
  const totalRemaining = totalDebt - totalPaid;

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const startEditNote = (inst: Installment) => {
    setEditingNoteId(inst.id);
    setNoteValue(inst.notes || '');
  };

  const saveNote = async (instId: string) => {
    setSavingNote(true);
    const { error } = await supabase
      .from('advance_installments')
      .update({ notes: noteValue || null } as any)
      .eq('id', instId);
    setSavingNote(false);
    if (error) return toast({ title: 'خطأ في الحفظ', variant: 'destructive' });
    setEditingNoteId(null);
    onRefresh();
    toast({ title: 'تم حفظ الملاحظة ✅' });
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText size={18} />
            <span>سجل العمليات — {employeeName}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="bg-info/10 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المديونية</p>
            <p className="text-lg font-bold text-info">{totalDebt.toLocaleString()} ر.س</p>
          </div>
          <div className="bg-success/10 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المسدّد</p>
            <p className="text-lg font-bold text-success">{totalPaid.toLocaleString()} ر.س</p>
          </div>
          <div className="bg-destructive/10 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">المتبقي</p>
            <p className="text-lg font-bold text-destructive">{totalRemaining.toLocaleString()} ر.س</p>
          </div>
        </div>

        {allInstallments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد عمليات لهذا المندوب</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60">
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground w-10">#</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">اسم المندوب</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">الشهر</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">أخذ كام</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">سدّد كام</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">ملاحظات</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">تعديل</th>
                </tr>
              </thead>
              <tbody>
                {allInstallments.map((inst, idx) => (
                  <tr key={inst.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-foreground">
                      <div>
                        <p>{employeeName}</p>
                        <p className="text-[10px] text-muted-foreground">تاريخ السلفة: {inst.advanceDate}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs" dir="ltr">{inst.month_year}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-semibold text-info text-xs">{inst.advanceTotal.toLocaleString()} ر.س</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {inst.status === 'deducted' ? (
                        <span className="font-semibold text-success text-xs">{inst.amount.toLocaleString()} ر.س</span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={instStatusStyle[inst.status]}>{instStatusLabel[inst.status]}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right max-w-xs">
                      {editingNoteId === inst.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="اكتب ملاحظة..."
                            onKeyDown={e => { if (e.key === 'Enter') saveNote(inst.id); if (e.key === 'Escape') setEditingNoteId(null); }}
                          />
                          <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveNote(inst.id)} disabled={savingNote}>
                            {savingNote ? '...' : 'حفظ'}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditingNoteId(null)}>إلغاء</Button>
                        </div>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => startEditNote(inst)}
                          title="اضغط للتعديل"
                        >
                          {inst.notes || <span className="text-muted-foreground/30 italic">لا توجد ملاحظة — اضغط للإضافة</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEditNote(inst)}
                      >
                        <Edit2 size={12} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-muted/60 border-t-2 border-border/60">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-bold text-muted-foreground">الإجمالي</td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold text-info">{totalDebt.toLocaleString()} ر.س</td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold text-success">{totalPaid.toLocaleString()} ر.س</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Add Advance Modal ────────────────────────────────────────────────────────
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
  const [transactionsEmployee, setTransactionsEmployee] = useState<{ id: string; name: string } | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
      supabase.from('advances').select('*, employees(name, national_id), advance_installments(*)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
    ]);
    if (advRes.data) setAdvances(advRes.data as Advance[]);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Group advances by employee
  type EmployeeSummary = {
    employeeId: string;
    employeeName: string;
    nationalId: string;
    totalDebt: number;
    totalPaid: number;
    remaining: number;
    activeAdvances: Advance[];
    allAdvances: Advance[];
  };

  const employeeSummaries = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();
    advances.forEach(adv => {
      const empId = adv.employee_id;
      const empName = adv.employees?.name || '—';
      const nationalId = adv.employees?.national_id || '—';
      const paid = calcPaid(adv.advance_installments || []);
      const remaining = adv.amount - paid;

      if (!map.has(empId)) {
        map.set(empId, {
          employeeId: empId,
          employeeName: empName,
          nationalId,
          totalDebt: 0,
          totalPaid: 0,
          remaining: 0,
          activeAdvances: [],
          allAdvances: [],
        });
      }
      const entry = map.get(empId)!;
      entry.totalDebt += adv.amount;
      entry.totalPaid += paid;
      entry.remaining += remaining;
      entry.allAdvances.push(adv);
      if (adv.status === 'active') entry.activeAdvances.push(adv);
    });
    return Array.from(map.values());
  }, [advances]);

  // Filter
  const filtered = useMemo(() => {
    let result = employeeSummaries.filter(s => {
      const matchSearch = s.employeeName.includes(search) || s.nationalId.includes(search);
      const matchStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && s.activeAdvances.length > 0) ||
        (statusFilter === 'completed' && s.activeAdvances.length === 0 && s.allAdvances.length > 0) ||
        (statusFilter === 'has_debt' && s.remaining > 0);
      return matchSearch && matchStatus;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: any = (a as any)[sortField];
        let bVal: any = (b as any)[sortField];
        if (typeof aVal === 'string') aVal = aVal.localeCompare(bVal);
        else aVal = aVal - bVal;
        return sortDir === 'asc' ? aVal : -aVal;
      });
    }

    return result;
  }, [employeeSummaries, search, statusFilter, sortField, sortDir]);

  // Grand totals
  const grandTotals = useMemo(() => ({
    count: filtered.length,
    totalDebt: filtered.reduce((s, e) => s + e.totalDebt, 0),
    totalPaid: filtered.reduce((s, e) => s + e.totalPaid, 0),
    remaining: filtered.reduce((s, e) => s + e.remaining, 0),
  }), [filtered]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleTogglePauseById = async (advId: string, currentStatus: AdvanceStatus) => {
    const newStatus: AdvanceStatus = currentStatus === 'paused' ? 'active' : 'paused';
    const { error } = await supabase.from('advances').update({ status: newStatus }).eq('id', advId);
    if (error) return toast({ title: 'حدث خطأ', variant: 'destructive' });
    fetchAll();
    toast({ title: newStatus === 'active' ? 'تم تفعيل السلفة' : 'تم تأجيل السلفة' });
  };

  const handleExport = () => {
    const rows = filtered.map((s, idx) => ({
      '#': idx + 1,
      'اسم المندوب': s.employeeName,
      'رقم الإقامة': s.nationalId,
      'إجمالي المديونية': s.totalDebt,
      'المسدّد': s.totalPaid,
      'المتبقي': s.remaining,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'السلف');
    XLSX.writeFile(wb, `السلف_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-muted-foreground/40 text-[10px] mr-0.5">⇅</span>;
    return <span className="text-[10px] mr-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
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
          { label: 'عدد المندوبين', value: grandTotals.count, color: 'text-primary' },
          { label: 'إجمالي المديونية', value: `${grandTotals.totalDebt.toLocaleString()} ر.س`, color: 'text-info' },
          { label: 'إجمالي المسدّد', value: `${grandTotals.totalPaid.toLocaleString()} ر.س`, color: 'text-success' },
          { label: 'إجمالي المتبقي', value: `${grandTotals.remaining.toLocaleString()} ر.س`, color: 'text-destructive' },
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
          <Input placeholder="بحث بالاسم أو رقم الإقامة..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'active', l: 'نشط' }, { v: 'has_debt', l: 'عليه متبقي' }, { v: 'completed', l: 'منتهي' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground animate-pulse">
          جارٍ التحميل...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">
          لا توجد سلف مطابقة
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60">
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground w-12">#</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('employeeName')}>
                    اسم المندوب <SortIcon field="employeeName" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('nationalId')}>
                    رقم الإقامة <SortIcon field="nationalId" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-info cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('totalDebt')}>
                    المديونية <SortIcon field="totalDebt" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-success cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('totalPaid')}>
                    المسدّد <SortIcon field="totalPaid" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-destructive cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('remaining')}>
                    المتبقي <SortIcon field="remaining" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">الحالة</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={s.employeeId} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        className="font-semibold text-primary hover:underline text-sm text-right"
                        onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName })}
                        title="اضغط لعرض سجل العمليات"
                      >
                        {s.employeeName}
                      </button>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.allAdvances.length} سلفة</p>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-mono text-muted-foreground" dir="ltr">{s.nationalId}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-bold text-info text-sm">{s.totalDebt.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-bold text-success text-sm">{s.totalPaid.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-bold text-sm ${s.remaining > 0 ? 'text-destructive' : 'text-success'}`}>
                        {s.remaining.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {s.activeAdvances.length > 0 ? (
                          <span className="badge-info text-[10px]">نشطة ({s.activeAdvances.length})</span>
                        ) : s.remaining === 0 ? (
                          <span className="badge-success text-[10px]">مكتملة</span>
                        ) : (
                          <span className="badge-warning text-[10px]">موقوفة</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 px-2"
                          onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName })}
                        >
                          <FileText size={11} /> العمليات
                        </Button>
                        {permissions.can_edit && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 px-2"
                            onClick={() => { setAddDefaultEmployee(s.employeeId); setAddOpen(true); }}
                          >
                            <Plus size={11} /> سلفة
                          </Button>
                        )}
                        {s.activeAdvances.length > 0 && permissions.can_edit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-warning"
                            title="تأجيل/تفعيل السلفة النشطة"
                            onClick={() => {
                              const adv = s.activeAdvances[0];
                              handleTogglePauseById(adv.id, adv.status);
                            }}
                          >
                            <Pause size={12} />
                          </Button>
                        )}
                        {permissions.can_edit && s.allAdvances.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="تعديل آخر سلفة"
                            onClick={() => setEditAdvance(s.allAdvances[0])}
                          >
                            <Edit2 size={12} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals footer row */}
              <tfoot>
                <tr className="bg-muted/70 border-t-2 border-border/60">
                  <td colSpan={2} className="px-3 py-3 text-right text-xs font-bold text-muted-foreground">
                    الإجمالي ({grandTotals.count} مندوب)
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-muted-foreground">—</td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-info text-sm">{grandTotals.totalDebt.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-success text-sm">{grandTotals.totalPaid.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-destructive text-sm">{grandTotals.remaining.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
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

      {transactionsEmployee && (
        <TransactionsModal
          employeeId={transactionsEmployee.id}
          employeeName={transactionsEmployee.name}
          advances={advances}
          onClose={() => setTransactionsEmployee(null)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
};

export default Advances;
