import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Upload, FileDown, CheckCircle, XCircle, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const matchLabels: Record<string, string> = { matched: 'مطابق ✅', unmatched: 'غير مطابق ❌', duplicate: 'متكرر ⚠️' };
const matchStyles: Record<string, string> = { matched: 'badge-success', unmatched: 'badge-urgent', duplicate: 'badge-warning' };
const approvalLabels: Record<string, string> = { pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض' };
const approvalStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-urgent' };
const typeLabels: Record<string, string> = { fine: 'غرامة', return: 'مردود', delay: 'تأخير', accident: 'حادثة', other: 'أخرى' };

interface DeductionItem {
  id: string;
  employee_id: string;
  employee_name: string;
  source_app_name: string;
  type: string;
  amount: number;
  incident_date: string | null;
  apply_month: string;
  approval_status: string;
}

const ReviewTab = () => {
  const { toast } = useToast();
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDeductions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('external_deductions')
      .select('id, employee_id, type, amount, incident_date, apply_month, approval_status, employees(name), apps:source_app_id(name)')
      .order('created_at', { ascending: false });

    if (data) {
      setDeductions(data.map(d => ({
        id: d.id,
        employee_id: d.employee_id,
        employee_name: (d.employees as any)?.name || '—',
        source_app_name: (d.apps as any)?.name || '—',
        type: d.type,
        amount: Number(d.amount),
        incident_date: d.incident_date,
        apply_month: d.apply_month,
        approval_status: d.approval_status,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchDeductions(); }, []);

  const handleApprove = async (id: string) => {
    await supabase.from('external_deductions').update({ approval_status: 'approved' }).eq('id', id);
    toast({ title: 'تم الاعتماد' });
    fetchDeductions();
  };

  const handleReject = async (id: string) => {
    await supabase.from('external_deductions').update({ approval_status: 'rejected' }).eq('id', id);
    toast({ title: 'تم الرفض' });
    fetchDeductions();
  };

  const sources = [...new Set(deductions.map(d => d.source_app_name).filter(s => s !== '—'))];

  const filtered = deductions.filter(d => {
    const matchSearch = d.employee_name.includes(search);
    const matchSource = sourceFilter === 'all' || d.source_app_name === sourceFilter;
    const matchApproval = statusFilter === 'all' || d.approval_status === statusFilter;
    return matchSearch && matchSource && matchApproval;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...sources].map(s => (
            <button key={s} onClick={() => setSourceFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sourceFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s === 'all' ? 'الكل' : s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'معلق' }, { v: 'approved', l: 'معتمد' }, { v: 'rejected', l: 'مرفوض' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد خصومات مطابقة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-right p-3 text-sm font-semibold text-muted-foreground">المندوب</th>
                  <th className="text-right p-3 text-sm font-semibold text-muted-foreground">المصدر</th>
                  <th className="text-right p-3 text-sm font-semibold text-muted-foreground">نوع الخصم</th>
                  <th className="text-center p-3 text-sm font-semibold text-muted-foreground">المبلغ</th>
                  <th className="text-center p-3 text-sm font-semibold text-muted-foreground">تاريخ الحادثة</th>
                  <th className="text-center p-3 text-sm font-semibold text-muted-foreground">شهر الخصم</th>
                  <th className="text-center p-3 text-sm font-semibold text-muted-foreground">الاعتماد</th>
                  <th className="text-center p-3 text-sm font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-3 text-sm font-medium text-foreground">{d.employee_name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{d.source_app_name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{typeLabels[d.type] || d.type}</td>
                    <td className="p-3 text-center text-sm font-semibold text-destructive">{d.amount.toLocaleString()} ر.س</td>
                    <td className="p-3 text-center text-sm text-muted-foreground">{d.incident_date || '—'}</td>
                    <td className="p-3 text-center text-sm text-muted-foreground">{d.apply_month}</td>
                    <td className="p-3 text-center"><span className={approvalStyles[d.approval_status] || 'badge-info'}>{approvalLabels[d.approval_status] || d.approval_status}</span></td>
                    <td className="p-3 text-center">
                      {d.approval_status === 'pending' && (
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="ghost" className="text-success h-7 w-7 p-0" onClick={() => handleApprove(d.id)}><CheckCircle size={14} /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => handleReject(d.id)}><XCircle size={14} /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const UploadTab = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="w-full max-w-lg border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
      <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">رفع شيت الخصومات</h3>
      <p className="text-sm text-muted-foreground mb-4">اسحب ملف Excel هنا أو اضغط للاختيار</p>
      <Button variant="outline" className="gap-2"><Upload size={16} /> اختيار ملف</Button>
    </div>
  </div>
);

const Deductions = () => {
  const [deductionsForExport, setDeductionsForExport] = useState<DeductionItem[]>([]);

  useEffect(() => {
    supabase
      .from('external_deductions')
      .select('id, employee_id, type, amount, incident_date, apply_month, approval_status, employees(name), apps:source_app_id(name)')
      .then(({ data }) => {
        if (data) {
          setDeductionsForExport(data.map(d => ({
            id: d.id,
            employee_id: d.employee_id,
            employee_name: (d.employees as any)?.name || '—',
            source_app_name: (d.apps as any)?.name || '—',
            type: d.type,
            amount: Number(d.amount),
            incident_date: d.incident_date,
            apply_month: d.apply_month,
            approval_status: d.approval_status,
          })));
        }
      });
  }, []);

  const handleExport = () => {
    const rows = deductionsForExport.map(d => ({
      'المندوب': d.employee_name,
      'المصدر': d.source_app_name,
      'نوع الخصم': typeLabels[d.type] || d.type,
      'المبلغ': d.amount,
      'تاريخ الحادثة': d.incident_date || '—',
      'شهر الخصم': d.apply_month,
      'حالة الاعتماد': approvalLabels[d.approval_status] || d.approval_status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الخصومات');
    XLSX.writeFile(wb, `الخصومات_${format(new Date(), 'yyyy-MM')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileDown size={24} /> الخصومات الخارجية</h1>
          <p className="text-sm text-muted-foreground mt-1">رفع ومراجعة واعتماد خصومات الشركات</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2"><Download size={15} /> 📥 تحميل تقرير ▾</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Tabs defaultValue="review" dir="rtl">
        <TabsList>
          <TabsTrigger value="upload">رفع الشيت</TabsTrigger>
          <TabsTrigger value="review">مراجعة واعتماد</TabsTrigger>
          <TabsTrigger value="history">السجل الشهري</TabsTrigger>
        </TabsList>
        <TabsContent value="upload"><UploadTab /></TabsContent>
        <TabsContent value="review"><ReviewTab /></TabsContent>
        <TabsContent value="history"><div className="text-center py-12 text-muted-foreground">سجل الخصومات المعتمدة للأشهر السابقة</div></TabsContent>
      </Tabs>
    </div>
  );
};

export default Deductions;
