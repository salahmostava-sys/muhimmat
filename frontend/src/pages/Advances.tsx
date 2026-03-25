/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, CreditCard, FolderOpen, Upload, Edit2, FileText, Printer, AlertTriangle, Check, X, RotateCcw, UserPlus, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { advanceService } from '@/services/advanceService';
import type { AdvancePayload } from '@/services/advanceService';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { escapeHtml } from '@/lib/security';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

// ─── Types ─────────────────────────────────────────────────────────────────────
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
  is_written_off?: boolean;
  written_off_reason?: string | null;
  employees?: { name: string; national_id: string | null } | null;
  advance_installments?: Installment[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const calcPaid = (installments: Installment[]) =>
  installments.filter(i => i.status === 'deducted').reduce((s, i) => s + i.amount, 0);
const calcPending = (installments: Installment[]) =>
  installments.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);

const buildInstallmentsPayload = (
  advanceId: string,
  firstMonthYear: string,
  totalAmount: number,
  installmentCount: number
) => {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || installmentCount <= 0) return [];
  const list = [];
  const baseAmount = Math.round(totalAmount / installmentCount);
  let remaining = totalAmount;
  let [yr, mo] = firstMonthYear.split('-').map(Number);

  for (let i = 0; i < installmentCount; i++) {
    const isLast = i === installmentCount - 1;
    const amount = isLast ? remaining : baseAmount;
    list.push({
      advance_id: advanceId,
      month_year: `${yr}-${String(mo).padStart(2, '0')}`,
      amount,
      status: 'pending' as const,
    });
    remaining -= amount;
    mo++;
    if (mo > 12) {
      mo = 1;
      yr++;
    }
  }

  return list;
};

const currentMonth = format(new Date(), 'yyyy-MM');

// ─── Inline Row Entry ──────────────────────────────────────────────────────────
interface InlineRowProps {
  employeeId: string;
  onSaved: () => void;
  onCancel: () => void;
}
const InlineRowEntry = ({ employeeId, onSaved, onCancel }: InlineRowProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '', disbursement_date: format(new Date(), 'yyyy-MM-dd'),
    first_deduction_month: format(new Date(), 'yyyy-MM'), note: '',
  });

  /** قسط واحد بكامل المبلغ (بدون حقل قسط شهري منفصل) */
  const projectedInstallments = 1;

  const saveAdvance = async () => {
    if (!form.amount || !form.disbursement_date || !form.first_deduction_month)
      return toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' });
    const amt = parseFloat(form.amount);
    if (!Number.isFinite(amt) || amt <= 0)
      return toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' });
    setSaving(true);
    const payload: AdvancePayload = {
      employee_id: employeeId, amount: amt,
      monthly_amount: amt, total_installments: projectedInstallments,
      disbursement_date: form.disbursement_date, first_deduction_month: form.first_deduction_month,
      note: form.note || null, status: 'active',
    };
    const { data: adv, error } = await advanceService.create(payload);
    if (error || !adv) { setSaving(false); return toast({ title: 'حدث خطأ', description: error?.message, variant: 'destructive' }); }
    const installments = buildInstallmentsPayload(
      adv.id,
      form.first_deduction_month,
      parseFloat(form.amount),
      projectedInstallments
    );
    if (installments.length > 0) await advanceService.createInstallments(installments);
    setSaving(false);
    toast({ title: '✅ تم إضافة السلفة' });
    onSaved();
  };

  return (
    <div className="border-b border-border/50 bg-primary/5 rounded-lg animate-in fade-in duration-150 px-3 py-3">
      <p className="text-xs font-medium text-foreground mb-3">إضافة سلفة</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">المبلغ (ر.س) *</label>
          <Input type="number" className="h-7 text-xs" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">تاريخ الصرف *</label>
          <Input type="date" className="h-7 text-xs" value={form.disbursement_date} onChange={e => setForm(p => ({ ...p, disbursement_date: e.target.value }))} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">أول شهر خصم *</label>
          <Input type="month" className="h-7 text-xs" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
        </div>
        <div className="sm:col-span-3">
          <label className="text-[11px] text-muted-foreground mb-1 block">ملاحظات</label>
          <Input className="h-7 text-xs" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="سبب السلفة..." />
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={saveAdvance} disabled={saving}>
          <Check size={12} /> {saving ? '...' : 'حفظ'}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCancel}>
          <X size={12} /> إلغاء
        </Button>
      </div>
    </div>
  );
};

// ─── Write-off Dialog ──────────────────────────────────────────────────────────
interface WriteOffDialogProps {
  employeeName: string;
  remaining: number;
  advanceIds: string[];
  onClose: () => void;
  onDone: () => void;
}
const WriteOffDialog = ({ employeeName, remaining, advanceIds, onClose, onDone }: WriteOffDialogProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleWriteOff = async () => {
    setSaving(true);
    const { error } = await advanceService.writeOffMany(advanceIds, reason || 'ديون معدومة');
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: `✅ تم إعدام ديون ${employeeName}` });
    onDone(); onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={18} /> إعدام الديون
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-foreground">{employeeName}</p>
            <p className="text-muted-foreground mt-1">المبلغ الذي سيتم إعدامه: <span className="font-bold text-destructive">{remaining.toLocaleString()} ر.س</span></p>
            <p className="text-xs text-muted-foreground mt-2">⚠️ يمكن التراجع عن هذا الإجراء لاحقاً من خلال زر الاسترداد.</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">سبب الإعدام</label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: المندوب هرب / ترك العمل..." />
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button variant="destructive" onClick={handleWriteOff} disabled={saving}>{saving ? '...' : 'إعدام الديون'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Restore Write-off Dialog ─────────────────────────────────────────────────
interface RestoreWriteOffDialogProps {
  employeeName: string;
  advanceIds: string[];
  onClose: () => void;
  onDone: () => void;
}
const RestoreWriteOffDialog = ({ employeeName, advanceIds, onClose, onDone }: RestoreWriteOffDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleRestore = async () => {
    setSaving(true);
    const { error } = await advanceService.restoreWrittenOffMany(advanceIds);
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: `✅ تم استرداد ديون ${employeeName}` });
    onDone(); onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <RotateCcw size={18} /> استرداد الديون المعدومة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-foreground">{employeeName}</p>
            <p className="text-muted-foreground mt-1">سيتم إعادة تفعيل السلف المعدومة وإعادتها للحالة النشطة.</p>
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleRestore} disabled={saving} className="bg-warning hover:bg-warning/90 text-warning-foreground">
            {saving ? '...' : 'استرداد الديون'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Edit Advance Modal ────────────────────────────────────────────────────────
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
    first_deduction_month: advance.first_deduction_month,
    status: advance.status as AdvanceStatus,
    note: advance.note || '',
  });

  const remaining = parseFloat(form.amount) || 0;
  const monthly = advance.monthly_amount > 0 ? advance.monthly_amount : 1;
  const projectedInstallments = monthly > 0 ? Math.ceil(remaining / monthly) : 0;

  const handleSave = async () => {
    setSaving(true);
    const payload: Partial<AdvancePayload> = {
      amount: parseFloat(form.amount),
      disbursement_date: form.disbursement_date,
      monthly_amount: monthly,
      total_installments: projectedInstallments,
      first_deduction_month: form.first_deduction_month,
      status: form.status,
      note: form.note || null,
    };
    const { error } = await advanceService.update(advance.id, payload);
    if (error) { setSaving(false); return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' }); }
    await advanceService.deletePendingInstallments(advance.id);
    const paidInstallments = (advance.advance_installments || []).filter(i => i.status === 'deducted');
    const paidCount = paidInstallments.length;
    const paidAmount = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const remaining_count = Math.max(projectedInstallments - paidCount, 0);
    const remainingAmount = Math.max((parseFloat(form.amount) || 0) - paidAmount, 0);
    const installments = buildInstallmentsPayload(
      advance.id,
      form.first_deduction_month,
      remainingAmount,
      remaining_count
    );
    if (installments.length > 0) await advanceService.createInstallments(installments);
    setSaving(false);
    toast({ title: 'تم تحديث السلفة ✅' });
    onSaved(); onClose();
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
            <label className="text-sm font-medium mb-1 block">أول شهر خصم</label>
            <Input type="month" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الحالة</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AdvanceStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">ملاحظات</label>
            <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
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

// ─── Print Slip Modal ──────────────────────────────────────────────────────────
interface PrintSlipProps {
  employeeName: string;
  nationalId: string;
  totalDebt: number;
  totalPaid: number;
  remaining: number;
  advances: Advance[];
  onClose: () => void;
}
const PrintSlip = ({ employeeName, nationalId, totalDebt, totalPaid, remaining, advances, onClose }: PrintSlipProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const contentEl = printRef.current;
    if (!contentEl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>سلف - ${escapeHtml(employeeName)}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; direction: rtl; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f3f4f6; padding: 8px; font-size: 12px; border: 1px solid #d1d5db; }
        td { padding: 7px 8px; font-size: 12px; border: 1px solid #e5e7eb; }
        .header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
        .stat { display: inline-block; margin-left: 20px; font-size: 13px; }
        .stat-val { font-weight: bold; font-size: 16px; }
        .red { color: #dc2626; } .green { color: #16a34a; } .blue { color: #2563eb; }
        @media print { button { display: none; } }
      </style></head><body>`);
    if (!win.document.body) return;
    // Append the live DOM node to avoid string-interpolating innerHTML.
    win.document.body.appendChild(contentEl.cloneNode(true));
    win.document.write(`</body></html>`);
    win.document.close();
    win.print();
  };

  const allInstallments = advances.flatMap(adv =>
    (adv.advance_installments || []).map(i => ({ ...i, advanceDate: adv.disbursement_date, advanceTotal: adv.amount }))
  ).sort((a, b) => a.month_year.localeCompare(b.month_year));

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer size={18} /> طباعة كشف السلف</DialogTitle>
        </DialogHeader>
        <div ref={printRef}>
          <div className="header">
            <h2 style={{ margin: 0, fontSize: 18 }}>كشف سلف المندوب</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>تاريخ الطباعة: {format(new Date(), 'yyyy-MM-dd')}</p>
          </div>
          <div className="mb-3">
            <p><strong>الاسم:</strong> {employeeName}</p>
            <p><strong>رقم الإقامة:</strong> {nationalId}</p>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div className="stat"><div className="stat-val blue">{totalDebt.toLocaleString()} ر.س</div><div>إجمالي المديونية</div></div>
            <div className="stat"><div className="stat-val green">{totalPaid.toLocaleString()} ر.س</div><div>إجمالي المسدّد</div></div>
            <div className="stat"><div className={`stat-val ${remaining > 0 ? 'red' : 'green'}`}>{remaining.toLocaleString()} ر.س</div><div>المتبقي</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>الشهر</th><th>تاريخ السلفة</th><th>مبلغ السلفة</th><th>المسدّد</th><th>الحالة</th><th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {allInstallments.map((inst, idx) => (
                <tr key={inst.id}>
                  <td>{idx + 1}</td>
                  <td dir="ltr">{inst.month_year}</td>
                  <td>{inst.advanceDate}</td>
                  <td>{inst.advanceTotal.toLocaleString()} ر.س</td>
                  <td>{inst.status === 'deducted' ? `${inst.amount.toLocaleString()} ر.س` : '—'}</td>
                  <td>{inst.status === 'deducted' ? 'مخصوم' : inst.status === 'pending' ? 'معلّق' : 'مؤجل'}</td>
                  <td>{inst.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={handlePrint} className="gap-2"><Printer size={14} /> طباعة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Transactions Modal ────────────────────────────────────────────────────────
interface TransactionsModalProps {
  employeeId: string;
  employeeName: string;
  nationalId: string;
  totalDebt: number;
  totalPaid: number;
  remaining: number;
  advances: Advance[];
  allAdvances: Advance[];
  isWrittenOff?: boolean;
  canEdit?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onWriteOff?: () => void;
  onRestore?: () => void;
  onEditAdvance?: (adv: Advance) => void;
}
const TransactionsModal = ({ employeeId, employeeName, nationalId, totalDebt, totalPaid, remaining, advances, allAdvances, isWrittenOff, canEdit, onClose, onRefresh, onWriteOff, onRestore, onEditAdvance }: TransactionsModalProps) => {
  const { toast } = useToast();
  const empAdvances = advances.filter(a => a.employee_id === employeeId);
  const allInstallments = empAdvances.flatMap(adv =>
    (adv.advance_installments || []).map(i => ({ ...i, advanceDate: adv.disbursement_date, advanceTotal: adv.amount }))
  ).sort((a, b) => a.month_year.localeCompare(b.month_year));

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [deleteAdvanceId, setDeleteAdvanceId] = useState<string | null>(null);
  const [deletingAdvance, setDeletingAdvance] = useState(false);
  const [deleteInstallmentId, setDeleteInstallmentId] = useState<string | null>(null);
  const [deletingInstallment, setDeletingInstallment] = useState(false);

  const handleDeleteAdvance = async () => {
    if (!deleteAdvanceId) return;
    setDeletingAdvance(true);
    const { error } = await advanceService.delete(deleteAdvanceId);
    setDeletingAdvance(false);
    if (error) return toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    toast({ title: '✅ تم حذف السلفة نهائياً' });
    setDeleteAdvanceId(null);
    onRefresh();
  };

  const handleDeleteInstallment = async () => {
    if (!deleteInstallmentId) return;
    setDeletingInstallment(true);
    const { error } = await advanceService.deleteInstallment(deleteInstallmentId);
    setDeletingInstallment(false);
    if (error) return toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    toast({ title: '✅ تم حذف الصف' });
    setDeleteInstallmentId(null);
    onRefresh();
  };

  const startEditNote = (inst: any) => { setEditingNoteId(inst.id); setNoteValue(inst.notes || ''); };
  const saveNote = async (instId: string) => {
    setSavingNote(true);
    const { error } = await advanceService.updateInstallmentNote(instId, noteValue || null);
    setSavingNote(false);
    if (error) return toast({ title: 'خطأ', variant: 'destructive' });
    setEditingNoteId(null);
    onRefresh();
    toast({ title: '✅ تم حفظ الملاحظة' });
  };

  return (
    <>
      <Dialog open onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <FileText size={18} />
                سجل العمليات — {employeeName}
              </DialogTitle>
              {/* Action buttons inside modal header */}
              {canEdit && !isWrittenOff && (
                <div className="flex items-center gap-2 ml-8">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowInlineAdd(true)}>
                    <Plus size={12} /> إضافة
                  </Button>
                  {empAdvances.length > 0 && onEditAdvance && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        // Open the most recent active advance, not always the first one
                        const activeAdv = empAdvances.find(a => a.status === 'active') || empAdvances[empAdvances.length - 1];
                        onEditAdvance(activeAdv);
                      }}
                    >
                      <Edit2 size={12} /> تعديل
                    </Button>
                  )}
                  {remaining > 0 && onWriteOff && (
                    <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={onWriteOff}>
                      <AlertTriangle size={12} /> إعدام
                    </Button>
                  )}
                </div>
              )}
              {canEdit && isWrittenOff && onRestore && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 ml-8 text-warning border-warning/40 hover:bg-warning/10" onClick={onRestore}>
                  <RotateCcw size={12} /> استرداد الديون
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Inline add form */}
          {showInlineAdd && (
            <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
              <InlineRowEntry
                employeeId={employeeId}
                onSaved={() => { setShowInlineAdd(false); onRefresh(); }}
                onCancel={() => setShowInlineAdd(false)}
              />
            </div>
          )}

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
              <p className="text-lg font-bold text-destructive">{remaining.toLocaleString()} ر.س</p>
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
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">الشهر</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">تاريخ السلفة</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">أخذ كام</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">سدّد كام</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">ملاحظات</th>
                    <th className="w-16 px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {allInstallments.map((inst, idx) => (
                    <tr key={inst.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-center text-xs" dir="ltr">{inst.month_year}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{inst.advanceDate}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-semibold text-info text-xs">{inst.advanceTotal.toLocaleString()} ر.س</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {inst.status === 'deducted'
                          ? <span className="font-semibold text-success text-xs">{inst.amount.toLocaleString()} ر.س</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center max-w-xs">
                        {editingNoteId === inst.id ? (
                          <div className="flex items-center gap-2">
                            <Input autoFocus value={noteValue} onChange={e => setNoteValue(e.target.value)} className="h-7 text-xs"
                              placeholder="اكتب ملاحظة..."
                              onKeyDown={e => { if (e.key === 'Enter') saveNote(inst.id); if (e.key === 'Escape') setEditingNoteId(null); }} />
                            <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveNote(inst.id)} disabled={savingNote}>{savingNote ? '...' : 'حفظ'}</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditingNoteId(null)}>إلغاء</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => startEditNote(inst)} title="اضغط للتعديل">
                            {inst.notes || <span className="text-muted-foreground/30 italic">اضغط للإضافة</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {canEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteInstallmentId(inst.id); }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="حذف هذا الصف"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border/60">
                    <td colSpan={3} className="px-3 py-2.5 text-center text-xs font-bold text-muted-foreground">الإجمالي</td>
                    <td className="px-3 py-2.5 text-center text-xs font-bold text-info">{totalDebt.toLocaleString()} ر.س</td>
                    <td className="px-3 py-2.5 text-center text-xs font-bold text-success">{totalPaid.toLocaleString()} ر.س</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPrint(true)}>
              <Printer size={14} /> طباعة الكشف
            </Button>
            <Button variant="outline" onClick={onClose}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPrint && (
        <PrintSlip
          employeeName={employeeName}
          nationalId={nationalId}
          totalDebt={totalDebt}
          totalPaid={totalPaid}
          remaining={remaining}
          advances={advances.filter(a => a.employee_id === employeeId)}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* ── Confirm Delete Advance Dialog ── */}
      {deleteAdvanceId && (
        <Dialog open onOpenChange={v => !v && setDeleteAdvanceId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> تأكيد حذف السلفة
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              سيتم حذف هذه السلفة وجميع أقساطها نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </p>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setDeleteAdvanceId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleDeleteAdvance} disabled={deletingAdvance}>
                {deletingAdvance ? '...' : 'حذف نهائياً'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Delete Single Installment Row ── */}
      {deleteInstallmentId && (
        <Dialog open onOpenChange={v => !v && setDeleteInstallmentId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> حذف صف من السجل
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              سيتم حذف هذا الصف من سجل العمليات نهائياً. هل تريد المتابعة؟
            </p>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setDeleteInstallmentId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleDeleteInstallment} disabled={deletingInstallment}>
                {deletingInstallment ? '...' : 'حذف الصف'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const Advances = () => {
  const { toast } = useToast();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions } = usePermissions('advances');
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; sponsorship_status?: string | null }[]>([]);
  const {
    data: advancesPageData,
    isLoading: loading,
    error: advancesPageError,
    refetch: refetchAdvancesData,
  } = useQuery({
    queryKey: ['advances', uid, 'page-data'],
    enabled,
    queryFn: async () => {
      const [advRes, empRes] = await Promise.all([
        advanceService.getAll(),
        advanceService.getEmployees(),
      ]);
      if (advRes.error) throw advRes.error;
      if (empRes.error) throw empRes.error;
      return {
        advances: (advRes.data || []) as Advance[],
        employees: (empRes.data || []) as { id: string; name: string; sponsorship_status?: string | null }[],
      };
    },
    retry: 2,
    staleTime: 60_000,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWrittenOff, setShowWrittenOff] = useState(false);
  const [editAdvance, setEditAdvance] = useState<Advance | null>(null);
  const [transactionsEmployee, setTransactionsEmployee] = useState<{ id: string; name: string; nationalId: string; totalDebt: number; totalPaid: number; remaining: number; isWrittenOff?: boolean; allAdvances: Advance[] } | null>(null);
  const [writeOffEmployee, setWriteOffEmployee] = useState<{ name: string; remaining: number; advanceIds: string[] } | null>(null);
  const [restoreWriteOffEmployee, setRestoreWriteOffEmployee] = useState<{ name: string; advanceIds: string[] } | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmpEntry, setNewEmpEntry] = useState<{ id: string; name: string } | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [inlineRowEmpId, setInlineRowEmpId] = useState<string | null>(null);
  const [deleteEmployeeAdvancesId, setDeleteEmployeeAdvancesId] = useState<string | null>(null);
  const [deletingEmployeeAdvances, setDeletingEmployeeAdvances] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleDeleteEmployeeAllAdvances = async () => {
    if (!deleteEmployeeAdvancesId) return;
    setDeletingEmployeeAdvances(true);
    const empAdvIds = advances.filter(a => a.employee_id === deleteEmployeeAdvancesId).map(a => a.id);
    if (empAdvIds.length > 0) {
      await advanceService.deleteMany(empAdvIds);
    }
    setDeletingEmployeeAdvances(false);
    toast({ title: '✅ تم حذف جميع سلف المندوب' });
    setDeleteEmployeeAdvancesId(null);
    fetchAll();
  };

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
        await advanceService.create({
          employee_id: emp.id, amount, monthly_amount: monthly, total_installments: installments,
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

  const fetchAll = () => { void refetchAdvancesData(); };

  useEffect(() => {
    if (!advancesPageData) return;
    setAdvances(advancesPageData.advances);
    setEmployees(advancesPageData.employees);
  }, [advancesPageData]);

  useEffect(() => {
    if (!advancesPageError) return;
    const message =
      advancesPageError instanceof Error
        ? advancesPageError.message
        : 'تعذر تحميل بيانات السلف';
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [advancesPageError, toast]);

  // Compute absconded employees with active debt
  const abscondedWithDebt = useMemo(() => {
    return employees
      .filter(e => e.sponsorship_status === 'absconded')
      .map(emp => {
        const empAdvances = advances.filter(a => a.employee_id === emp.id && !a.is_written_off && a.status === 'active');
        const remaining = empAdvances.reduce((sum, adv) => {
          const installments = adv.advance_installments || [];
          const pending = calcPending(installments);
          const paid = calcPaid(installments);
          const fallback = Math.max(adv.amount - paid, 0);
          return sum + (installments.length > 0 ? pending : fallback);
        }, 0);
        const activeIds = empAdvances.map(a => a.id);
        return remaining > 0 ? { ...emp, remaining, activeIds } : null;
      })
      .filter(Boolean) as { id: string; name: string; remaining: number; activeIds: string[] }[];
  }, [employees, advances]);

  type EmployeeSummary = {
    employeeId: string;
    employeeName: string;
    nationalId: string;
    totalDebt: number;
    totalPaid: number;
    remaining: number;
    activeAdvances: Advance[];
    allAdvances: Advance[];
    isWrittenOff: boolean;
  };

  const employeeSummaries = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();
    advances.forEach(adv => {
      const empId = adv.employee_id;
      const empName = adv.employees?.name || '—';
      const nationalId = adv.employees?.national_id || '—';
      const installments = adv.advance_installments || [];
      const paid = calcPaid(installments);
      const pending = calcPending(installments);
      const remaining = installments.length > 0 ? pending : Math.max(adv.amount - paid, 0);
      if (!map.has(empId)) {
        map.set(empId, { employeeId: empId, employeeName: empName, nationalId, totalDebt: 0, totalPaid: 0, remaining: 0, activeAdvances: [], allAdvances: [], isWrittenOff: false });
      }
      const entry = map.get(empId)!;
      entry.totalDebt += adv.amount;
      entry.totalPaid += paid;
      entry.remaining += remaining;
      entry.allAdvances.push(adv);
      if (adv.status === 'active') entry.activeAdvances.push(adv);
      if (adv.is_written_off) entry.isWrittenOff = true;
    });
    return Array.from(map.values());
  }, [advances]);

  const filtered = useMemo(() => {
    let result = employeeSummaries.filter(s => {
      if (showWrittenOff) return s.isWrittenOff;
      if (s.isWrittenOff) return false;
      const matchSearch = s.employeeName.includes(search) || s.nationalId.includes(search);
      const matchStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && s.activeAdvances.length > 0) ||
        (statusFilter === 'completed' && s.activeAdvances.length === 0 && s.allAdvances.length > 0) ||
        (statusFilter === 'has_debt' && s.remaining > 0);
      return matchSearch && matchStatus;
    });
    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortField];
        const bVal = (b as Record<string, unknown>)[sortField];
        let cmp: number;
        if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
        else cmp = ((aVal as number) ?? 0) - ((bVal as number) ?? 0);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [employeeSummaries, search, statusFilter, sortField, sortDir, showWrittenOff]);

  const grandTotals = useMemo(() => ({
    count: filtered.length,
    totalDebt: filtered.reduce((s, e) => s + e.totalDebt, 0),
    totalPaid: filtered.reduce((s, e) => s + e.totalPaid, 0),
    remaining: filtered.reduce((s, e) => s + e.remaining, 0),
  }), [filtered]);

  const writtenOffTotals = useMemo(() => {
    const wo = employeeSummaries.filter(s => s.isWrittenOff);
    return { count: wo.length, remaining: wo.reduce((s, e) => s + e.remaining, 0) };
  }, [employeeSummaries]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleExport = () => {
    const rows = filtered.map((s, idx) => ({
      '#': idx + 1, 'اسم المندوب': s.employeeName, 'رقم الإقامة': s.nationalId,
      'إجمالي المديونية': s.totalDebt, 'المسدّد': s.totalPaid, 'المتبقي': s.remaining,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'السلف');
    XLSX.writeFile(wb, `السلف_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleTemplate = () => {
    const headers = [['اسم المندوب', 'رقم الإقامة', 'مبلغ السلفة (ر.س)', 'تاريخ الاستحقاق (YYYY-MM-DD)', 'ملاحظات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب السلف');
    XLSX.writeFile(wb, 'template_advances.xlsx');
  };

  const handlePrintTable = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>تقرير السلف</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#666;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-size:10px;white-space:nowrap}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>تقرير السلف</h2><p class="sub">المجموع: ${filtered.length} مندوب — ${new Date().toLocaleDateString('ar-SA')}</p>`);
    if (!printWindow.document.body) return;
    // Append the live DOM table node to avoid string-interpolating table HTML.
    printWindow.document.body.appendChild(table.cloneNode(true));
    printWindow.document.write(`<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
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
            <span>السلف</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><CreditCard size={20} /> السلف</h1>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportAdvances} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}><Upload size={14} className="ml-1" /> استيراد Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrintTable}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_edit && !showWrittenOff && (
            <Button size="sm" className="gap-2 h-8" onClick={() => setShowAddEmployee(true)}>
              <UserPlus size={14} /> مندوب جديد
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

      {/* Written-off summary */}
      {writtenOffTotals.count > 0 && (
        <button
          onClick={() => { setShowWrittenOff(v => !v); setNewEmpEntry(null); setInlineRowEmpId(null); }}
          className={`w-full flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${showWrittenOff ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border/40 hover:bg-muted/50'}`}>
          <AlertTriangle size={16} className="text-destructive flex-shrink-0" />
          <span className="font-medium text-foreground">الديون المعدومة: {writtenOffTotals.count} مندوب</span>
          <span className="font-bold text-destructive mr-1">{writtenOffTotals.remaining.toLocaleString()} ر.س</span>
          <span className="mr-auto text-xs text-muted-foreground">{showWrittenOff ? 'إخفاء ←' : 'عرض ←'}</span>
        </button>
      )}

      {/* Filters */}
      {!showWrittenOff && (
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
      )}

      {/* Table */}
      {/* 🚨 Absconded employees with active debt */}
      {!showWrittenOff && abscondedWithDebt.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-destructive flex-shrink-0" />
            <span className="text-sm font-semibold text-destructive">
              تنبيه: {abscondedWithDebt.length} مندوب هارب لديه ديون غير معدومة
            </span>
          </div>
          <div className="space-y-2">
            {abscondedWithDebt.map(emp => (
              <div key={emp.id} className="flex items-center justify-between gap-3 bg-card rounded-lg px-3 py-2 border border-border/50">
                <div className="flex items-center gap-2">
                  <span className="badge-urgent text-xs">هارب</span>
                  <span className="text-sm font-medium text-foreground">{emp.name}</span>
                  <span className="text-xs text-destructive font-bold">{emp.remaining.toLocaleString()} ر.س</span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1"
                  onClick={() => setWriteOffEmployee({
                    name: emp.name,
                    remaining: emp.remaining,
                    advanceIds: emp.activeIds,
                  })}
                >
                  <AlertTriangle size={12} /> إعدام الديون
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground animate-pulse">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">لا توجد سلف مطابقة</div>
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60">
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground w-12">#</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('employeeName')}>
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
                  {permissions.can_edit && <th className="w-20 px-2 py-3 text-center text-xs font-semibold text-muted-foreground">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <React.Fragment key={s.employeeId}>
                    <tr className={`border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${s.isWrittenOff ? 'opacity-60' : ''}`}
                      onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName, nationalId: s.nationalId, totalDebt: s.totalDebt, totalPaid: s.totalPaid, remaining: s.remaining, isWrittenOff: s.isWrittenOff, allAdvances: s.allAdvances })}>
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary text-sm">{s.employeeName}</span>
                          {s.isWrittenOff && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">معدوم</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-mono text-foreground" dir="ltr">{s.nationalId}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-info text-sm">{s.totalDebt.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-success text-sm">{s.totalPaid.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold text-sm ${s.remaining > 0 ? 'text-destructive' : 'text-success'}`}>{s.remaining.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground mr-0.5">ر.س</span>
                      </td>
                      {permissions.can_edit && (
                        <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName, nationalId: s.nationalId, totalDebt: s.totalDebt, totalPaid: s.totalPaid, remaining: s.remaining, isWrittenOff: s.isWrittenOff, allAdvances: s.allAdvances })}
                              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              title="عرض وتعديل السلف"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteEmployeeAdvancesId(s.employeeId)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="حذف جميع سلف هذا المندوب"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/70 border-t-2 border-border/60">
                  <td colSpan={2} className="px-3 py-3 text-center text-xs font-bold text-muted-foreground">
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
                  {permissions.can_edit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {editAdvance && (
        <EditAdvanceModal advance={editAdvance} onClose={() => setEditAdvance(null)} onSaved={fetchAll} />
      )}

      {transactionsEmployee && (
        <TransactionsModal
          employeeId={transactionsEmployee.id}
          employeeName={transactionsEmployee.name}
          nationalId={transactionsEmployee.nationalId}
          totalDebt={transactionsEmployee.totalDebt}
          totalPaid={transactionsEmployee.totalPaid}
          remaining={transactionsEmployee.remaining}
          advances={advances}
          allAdvances={advances}
          isWrittenOff={transactionsEmployee.isWrittenOff}
          canEdit={permissions.can_edit}
          onClose={() => setTransactionsEmployee(null)}
          onRefresh={fetchAll}
          onEditAdvance={(adv) => { setTransactionsEmployee(null); setEditAdvance(adv); }}
          onWriteOff={() => {
            const s = filtered.find(x => x.employeeId === transactionsEmployee.id);
            if (s) setWriteOffEmployee({ name: s.employeeName, remaining: s.remaining, advanceIds: s.allAdvances.map(a => a.id) });
            setTransactionsEmployee(null);
          }}
          onRestore={() => {
            const s = filtered.find(x => x.employeeId === transactionsEmployee.id);
            if (s) setRestoreWriteOffEmployee({ name: s.employeeName, advanceIds: s.allAdvances.map(a => a.id) });
            setTransactionsEmployee(null);
          }}
        />
      )}

      {writeOffEmployee && (
        <WriteOffDialog
          employeeName={writeOffEmployee.name}
          remaining={writeOffEmployee.remaining}
          advanceIds={writeOffEmployee.advanceIds}
          onClose={() => setWriteOffEmployee(null)}
          onDone={fetchAll}
        />
      )}

      {restoreWriteOffEmployee && (
        <RestoreWriteOffDialog
          employeeName={restoreWriteOffEmployee.name}
          advanceIds={restoreWriteOffEmployee.advanceIds}
          onClose={() => setRestoreWriteOffEmployee(null)}
          onDone={fetchAll}
        />
      )}

      {/* Add new employee quick dialog — opens AddAdvanceModal directly */}
      {showAddEmployee && (
        <Dialog open onOpenChange={v => !v && setShowAddEmployee(false)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserPlus size={16} /> إضافة مندوب جديد للسلف</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">اختر مندوباً من القائمة لإضافة سلفة له مباشرة.</p>
              <Select onValueChange={(empId) => {
                const emp = employees.find(e => e.id === empId);
                if (emp) {
                  setTransactionsEmployee({ id: emp.id, name: emp.name, nationalId: '', totalDebt: 0, totalPaid: 0, remaining: 0, isWrittenOff: false, allAdvances: [] });
                }
                setShowAddEmployee(false);
              }}>
                <SelectTrigger><SelectValue placeholder="اختر المندوب..." /></SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => !employeeSummaries.some(s => s.employeeId === e.id))
                    .map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddEmployee(false)}>إلغاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Delete All Employee Advances ── */}
      {deleteEmployeeAdvancesId && (
        <Dialog open onOpenChange={v => !v && setDeleteEmployeeAdvancesId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> تأكيد حذف جميع السلف
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              سيتم حذف جميع سلف هذا المندوب وكافة أقساطها نهائياً. هل تريد المتابعة؟
            </p>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setDeleteEmployeeAdvancesId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleDeleteEmployeeAllAdvances} disabled={deletingEmployeeAdvances}>
                {deletingEmployeeAdvances ? '...' : 'حذف نهائياً'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Advances;
