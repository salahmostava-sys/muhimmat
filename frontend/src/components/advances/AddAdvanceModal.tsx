import { useState, useEffect, type ReactNode } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { advanceService } from '@/services/advanceService';
import { getErrorMessage } from '@/lib/query';

interface Props {
  onClose: () => void;
  editId?: string | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

const AdvanceField = ({ label, required, error, children }: FieldProps) => (
  <div>
    <Label className="text-sm mb-1.5 block">{label} {required && <span className="text-destructive">*</span>}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

const AddAdvanceModal = ({ onClose, editId }: Props) => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [form, setForm] = useState({
    employeeId: '',
    amount: '',
    disbursementDate: '',
    totalInstallments: '',
    monthlyAmount: '',
    firstDeductionMonth: '',
    note: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    advanceService.getEmployees().then(({ data }) => {
      if (data) setEmployees(data);
    });

    if (editId) {
      advanceService.getById(editId).then(({ data }) => {
        if (data) {
          setForm({
            employeeId: data.employee_id,
            amount: String(data.amount),
            disbursementDate: data.disbursement_date,
            totalInstallments: String(data.total_installments),
            monthlyAmount: String(data.monthly_amount),
            firstDeductionMonth: data.first_deduction_month,
            note: data.note || '',
            status: data.status,
          });
        }
      });
    }
  }, [editId]);

  const setField = (k: string, v: string) => {
    setForm(f => {
      const nf = { ...f, [k]: v };
      if ((k === 'amount' || k === 'totalInstallments') && nf.amount && nf.totalInstallments) {
        const monthly = Math.ceil(Number.parseFloat(nf.amount) / Number.parseInt(nf.totalInstallments));
        nf.monthlyAmount = String(monthly);
      }
      return nf;
    });
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!form.employeeId) errs.employeeId = 'اختر المندوب';
    if (!form.amount || Number.parseFloat(form.amount) <= 0) errs.amount = 'المبلغ مطلوب';
    if (!form.totalInstallments || Number.parseInt(form.totalInstallments) < 1) errs.totalInstallments = 'عدد الأقساط مطلوب';
    if (!form.disbursementDate) errs.disbursementDate = 'تاريخ الصرف مطلوب';
    if (!editId && !form.firstDeductionMonth) errs.firstDeductionMonth = 'شهر أول خصم مطلوب';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      if (editId) {
        const { error } = await advanceService.update(editId, {
          amount: Number.parseFloat(form.amount),
          monthly_amount: Number.parseFloat(form.monthlyAmount),
          total_installments: Number.parseInt(form.totalInstallments),
          disbursement_date: form.disbursementDate,
          note: form.note || null,
          status: form.status as 'active' | 'paused' | 'completed',
        });
        if (error) throw error;
        toast({ title: 'تم تعديل السلفة ✅' });
      } else {
        const { error } = await advanceService.create({
          employee_id: form.employeeId,
          amount: Number.parseFloat(form.amount),
          monthly_amount: Number.parseFloat(form.monthlyAmount),
          total_installments: Number.parseInt(form.totalInstallments),
          disbursement_date: form.disbursementDate,
          first_deduction_month: form.firstDeductionMonth,
          note: form.note || null,
          status: 'active' as const,
        });
        if (error) throw error;
        toast({ title: 'تم إضافة السلفة ✅' });
      }
      onClose();
    } catch (err: unknown) {
      console.error('[AddAdvanceModal] save failed', err);
      toast({ title: 'خطأ', description: getErrorMessage(err), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{editId ? 'تعديل السلفة' : 'إضافة سلفة جديدة'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <AdvanceField label="المندوب" required error={errors.employeeId}>
                <Select value={form.employeeId} onValueChange={v => setField('employeeId', v)} disabled={!!editId}>
                  <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AdvanceField>
            </div>

            <AdvanceField label="مبلغ السلفة (ر.س)" required error={errors.amount}>
              <Input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0" />
            </AdvanceField>

            <AdvanceField label="تاريخ الصرف" required error={errors.disbursementDate}>
              <Input type="date" value={form.disbursementDate} onChange={e => setField('disbursementDate', e.target.value)} />
            </AdvanceField>

            <AdvanceField label="عدد الأقساط" required error={errors.totalInstallments}>
              <Input type="number" min={1} max={36} value={form.totalInstallments} onChange={e => setField('totalInstallments', e.target.value)} />
            </AdvanceField>

            {!editId && (
              <AdvanceField label="شهر أول خصم (YYYY-MM)" required error={errors.firstDeductionMonth}>
                <Input type="month" value={form.firstDeductionMonth} onChange={e => setField('firstDeductionMonth', e.target.value)} dir="ltr" />
              </AdvanceField>
            )}

            <AdvanceField label="الحالة" required>
              <Select value={form.status} onValueChange={v => setField('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="paused">موقوفة</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                </SelectContent>
              </Select>
            </AdvanceField>

            <div className="sm:col-span-2">
              <AdvanceField label="ملاحظة">
                <textarea
                  value={form.note}
                  onChange={e => setField('note', e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="سبب السلفة..."
                />
              </AdvanceField>
            </div>
          </div>

          {form.amount && form.totalInstallments && (
            <div className="bg-muted/30 rounded-lg p-4 text-sm">
              <p className="font-medium text-foreground mb-2">ملخص السلفة</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-muted-foreground">المبلغ الإجمالي</p><p className="font-semibold">{Number.parseFloat(form.amount || '0').toLocaleString()} ر.س</p></div>
                <div><p className="text-xs text-muted-foreground">عدد الأقساط</p><p className="font-semibold">{form.totalInstallments}</p></div>
                <div><p className="text-xs text-muted-foreground">القسط الشهري</p><p className="font-semibold text-primary">{form.monthlyAmount} ر.س</p></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between p-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            <Check size={16} /> {editId ? 'حفظ التعديلات' : 'إضافة السلفة'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddAdvanceModal;
