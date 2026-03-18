import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, CreditCard, Download, Upload, Edit2, FileText, ArrowDownCircle, ArrowUpCircle, Printer, AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

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

const currentMonth = format(new Date(), 'yyyy-MM');

// ─── Inline Row Entry ──────────────────────────────────────────────────────────
interface InlineRowProps {
  employeeId: string;
  allAdvances: Advance[];
  onSaved: () => void;
  onCancel: () => void;
}
const InlineRowEntry = ({ employeeId, allAdvances, onSaved, onCancel }: InlineRowProps) => {
  const { toast } = useToast();
  const [type, setType] = useState<'advance' | 'payment'>('advance');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '', monthly_amount: '', disbursement_date: format(new Date(), 'yyyy-MM-dd'),
    first_deduction_month: format(new Date(), 'yyyy-MM'), note: '',
  });
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const projectedInstallments = form.amount && form.monthly_amount
    ? Math.ceil(parseFloat(form.amount) / parseFloat(form.monthly_amount)) : 0;

  const saveAdvance = async () => {
    if (!form.amount || !form.monthly_amount || !form.disbursement_date || !form.first_deduction_month)
      return toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' });
    setSaving(true);
    const { data: adv, error } = await supabase.from('advances').insert({
      employee_id: employeeId, amount: parseFloat(form.amount),
      monthly_amount: parseFloat(form.monthly_amount), total_installments: projectedInstallments,
      disbursement_date: form.disbursement_date, first_deduction_month: form.first_deduction_month,
      note: form.note || null, status: 'active',
    }).select().single();
    if (error || !adv) { setSaving(false); return toast({ title: 'حدث خطأ', description: error?.message, variant: 'destructive' }); }
    const installments = [];
    let [yr, mo] = form.first_deduction_month.split('-').map(Number);
    for (let i = 0; i < projectedInstallments; i++) {
      installments.push({ advance_id: adv.id, month_year: `${yr}-${String(mo).padStart(2, '0')}`, amount: parseFloat(form.monthly_amount), status: 'pending' as const });
      mo++; if (mo > 12) { mo = 1; yr++; }
    }
    if (installments.length > 0) await supabase.from('advance_installments').insert(installments);
    setSaving(false);
    toast({ title: '✅ تم إضافة السلفة' });
    onSaved();
  };

  const savePayment = async () => {
    if (!payAmount) return toast({ title: 'أدخل المبلغ', variant: 'destructive' });
    const empAdvances = allAdvances.filter(a => a.employee_id === employeeId && a.status === 'active');
    const pendingInst = empAdvances
      .flatMap(a => (a.advance_installments || []).filter(i => i.status === 'pending'))
      .sort((a, b) => a.month_year.localeCompare(b.month_year));
    if (pendingInst.length === 0) return toast({ title: 'لا توجد أقساط معلّقة', variant: 'destructive' });
    setSaving(true);
    const noteText = payNote || `سداد يدوي بتاريخ ${payDate} — ${payAmount} ر.س`;
    const { error } = await supabase.from('advance_installments').update({
      status: 'deducted' as const, deducted_at: new Date().toISOString(), notes: noteText,
    } as any).eq('id', pendingInst[0].id);
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', variant: 'destructive' });
    toast({ title: `✅ تم تسجيل السداد — ${payAmount} ر.س` });
    onSaved();
  };

  return (
    <tr className="border-b border-border/50 bg-primary/3 animate-in fade-in duration-150">
      <td colSpan={7} className="px-3 py-3">
        {/* Type toggle */}
        <div className="flex gap-2 mb-3">
          <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium">
            <button
              onClick={() => setType('advance')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${type === 'advance' ? 'bg-info text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              <ArrowDownCircle size={12} /> سلفة
            </button>
            <button
              onClick={() => setType('payment')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${type === 'payment' ? 'bg-success text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              <ArrowUpCircle size={12} /> سداد
            </button>
          </div>
          <div className="mr-auto flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={type === 'advance' ? saveAdvance : savePayment} disabled={saving}>
              <Check size={12} /> {saving ? '...' : 'حفظ'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCancel}>
              <X size={12} /> إلغاء
            </Button>
          </div>
        </div>

        {type === 'advance' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">المبلغ (ر.س) *</label>
              <Input type="number" className="h-7 text-xs" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">القسط الشهري (ر.س) *</label>
              <Input type="number" className="h-7 text-xs" value={form.monthly_amount} onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} placeholder="0" />
              {projectedInstallments > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{projectedInstallments} قسط</p>}
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">تاريخ الصرف *</label>
              <Input type="date" className="h-7 text-xs" value={form.disbursement_date} onChange={e => setForm(p => ({ ...p, disbursement_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">أول شهر خصم *</label>
              <Input type="month" className="h-7 text-xs" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
            </div>
            <div className="sm:col-span-4">
              <label className="text-[11px] text-muted-foreground mb-1 block">ملاحظات</label>
              <Input className="h-7 text-xs" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="سبب السلفة..." />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">المبلغ المسدّد (ر.س) *</label>
              <Input type="number" className="h-7 text-xs" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">تاريخ السداد</label>
              <Input type="date" className="h-7 text-xs" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-muted-foreground mb-1 block">ملاحظات</label>
              <Input className="h-7 text-xs" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="مثال: سدّد يوم ..." />
            </div>
          </div>
        )}
      </td>
    </tr>
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
    const { error } = await supabase.from('advances').update({
      is_written_off: true,
      written_off_at: new Date().toISOString(),
      written_off_reason: reason || 'ديون معدومة',
    } as any).in('id', advanceIds);
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
            <p className="text-xs text-muted-foreground mt-2">⚠️ هذا الإجراء لا يمكن التراجع عنه. الديون ستُحسب ضمن إجمالي الديون المعدومة.</p>
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
    if (error) { setSaving(false); return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' }); }
    await supabase.from('advance_installments').delete().eq('advance_id', advance.id).eq('status', 'pending');
    const installments = [];
    let [year, month] = form.first_deduction_month.split('-').map(Number);
    const paidCount = (advance.advance_installments || []).filter(i => i.status === 'deducted').length;
    const remaining_count = projectedInstallments - paidCount;
    for (let i = 0; i < remaining_count; i++) {
      const my = `${year}-${String(month).padStart(2, '0')}`;
      installments.push({ advance_id: advance.id, month_year: my, amount: parseFloat(form.monthly_amount), status: 'pending' as const });
      month++; if (month > 12) { month = 1; year++; }
    }
    if (installments.length > 0) await supabase.from('advance_installments').insert(installments);
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
            <label className="text-sm font-medium mb-1 block">القسط الشهري (ر.س)</label>
            <Input type="number" value={form.monthly_amount} onChange={e => setForm(p => ({ ...p, monthly_amount: e.target.value }))} />
            {form.amount && form.monthly_amount && <p className="text-xs text-muted-foreground mt-1">عدد الأقساط = {projectedInstallments}</p>}
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
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>سلف - ${employeeName}</title>
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
      </style></head><body>${content}</body></html>`);
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
  onClose: () => void;
  onRefresh: () => void;
}
const TransactionsModal = ({ employeeId, employeeName, nationalId, totalDebt, totalPaid, remaining, advances, onClose, onRefresh }: TransactionsModalProps) => {
  const { toast } = useToast();
  const empAdvances = advances.filter(a => a.employee_id === employeeId);
  const allInstallments = empAdvances.flatMap(adv =>
    (adv.advance_installments || []).map(i => ({ ...i, advanceDate: adv.disbursement_date, advanceTotal: adv.amount }))
  ).sort((a, b) => a.month_year.localeCompare(b.month_year));

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const startEditNote = (inst: any) => { setEditingNoteId(inst.id); setNoteValue(inst.notes || ''); };
  const saveNote = async (instId: string) => {
    setSavingNote(true);
    const { error } = await supabase.from('advance_installments').update({ notes: noteValue || null } as any).eq('id', instId);
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
            <DialogTitle className="flex items-center gap-3">
              <FileText size={18} />
              <span>سجل العمليات — {employeeName}</span>
            </DialogTitle>
          </DialogHeader>
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
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">الحالة</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">ملاحظات</th>
                    <th className="w-10" />
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
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${inst.status === 'deducted' ? 'bg-success/10 text-success' : inst.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
                          {inst.status === 'deducted' ? 'مخصوم' : inst.status === 'pending' ? 'معلّق' : 'مؤجل'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right max-w-xs">
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
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEditNote(inst)}>
                          <Edit2 size={11} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
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
    </>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const Advances = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('advances');
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; sponsorship_status?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWrittenOff, setShowWrittenOff] = useState(false);
  const [editAdvance, setEditAdvance] = useState<Advance | null>(null);
  const [transactionsEmployee, setTransactionsEmployee] = useState<{ id: string; name: string; nationalId: string; totalDebt: number; totalPaid: number; remaining: number } | null>(null);
  const [writeOffEmployee, setWriteOffEmployee] = useState<{ name: string; remaining: number; advanceIds: string[] } | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // inline row state: which employee has the + row open
  const [inlineRowEmpId, setInlineRowEmpId] = useState<string | null>(null);

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

  const fetchAll = async () => {
    setLoading(true);
    const [advRes, empRes] = await Promise.all([
      supabase.from('advances').select('*, employees(name, national_id), advance_installments(*)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name, sponsorship_status').eq('status', 'active').order('name'),
    ]);
    if (advRes.data) setAdvances(advRes.data as Advance[]);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  // Compute absconded employees with active debt
  const abscondedWithDebt = useMemo(() => {
    return employees
      .filter(e => e.sponsorship_status === 'absconded')
      .map(emp => {
        const empAdvances = advances.filter(a => a.employee_id === emp.id && !a.is_written_off && a.status === 'active');
        const remaining = empAdvances.reduce((sum, adv) => {
          const paid = calcPaid(adv.advance_installments || []);
          return sum + (adv.amount - paid);
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
      const paid = calcPaid(adv.advance_installments || []);
      const remaining = adv.amount - paid;
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
        let aVal: any = (a as any)[sortField];
        let bVal: any = (b as any)[sortField];
        if (typeof aVal === 'string') aVal = aVal.localeCompare(bVal);
        else aVal = aVal - bVal;
        return sortDir === 'asc' ? aVal : -aVal;
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
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExport}><Download size={14} /> تصدير</Button>
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => importRef.current?.click()}><Upload size={14} /> استيراد</Button>
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
          onClick={() => setShowWrittenOff(v => !v)}
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
      {loading ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground animate-pulse">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">لا توجد سلف مطابقة</div>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <React.Fragment key={s.employeeId}>
                    <tr className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${s.isWrittenOff ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center gap-2">
                          <button
                            className="font-semibold text-primary hover:underline text-sm text-right"
                            onClick={() => setTransactionsEmployee({ id: s.employeeId, name: s.employeeName, nationalId: s.nationalId, totalDebt: s.totalDebt, totalPaid: s.totalPaid, remaining: s.remaining })}
                          >
                            {s.employeeName}
                          </button>
                          {s.isWrittenOff && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">معدوم</span>}
                        </div>
                        {/* Action buttons on name hover row */}
                        {!s.isWrittenOff && permissions.can_edit && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={() => setInlineRowEmpId(inlineRowEmpId === s.employeeId ? null : s.employeeId)}
                              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                              title="إضافة سلفة أو سداد">
                              {inlineRowEmpId === s.employeeId ? <ChevronUp size={11} /> : <Plus size={11} />}
                              <span>{inlineRowEmpId === s.employeeId ? 'إخفاء' : 'إضافة'}</span>
                            </button>
                            <span className="text-muted-foreground/30 mx-1">|</span>
                            <button
                              onClick={() => setEditAdvance(s.allAdvances[0] || null)}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
                              <Edit2 size={11} /> تعديل
                            </button>
                            {s.remaining > 0 && (
                              <>
                                <span className="text-muted-foreground/30 mx-1">|</span>
                                <button
                                  onClick={() => setWriteOffEmployee({ name: s.employeeName, remaining: s.remaining, advanceIds: s.allAdvances.map(a => a.id) })}
                                  className="text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5">
                                  <AlertTriangle size={11} /> إعدام
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
                    </tr>

                    {/* Inline add row */}
                    {inlineRowEmpId === s.employeeId && (
                      <InlineRowEntry
                        employeeId={s.employeeId}
                        allAdvances={advances}
                        onSaved={() => { setInlineRowEmpId(null); fetchAll(); }}
                        onCancel={() => setInlineRowEmpId(null)}
                      />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
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
          onClose={() => setTransactionsEmployee(null)}
          onRefresh={fetchAll}
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
    </div>
  );
};

export default Advances;
