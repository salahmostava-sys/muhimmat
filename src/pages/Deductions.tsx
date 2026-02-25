import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Upload, FileDown, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { externalDeductions } from '@/data/mock';

const matchLabels: Record<string, string> = { matched: 'مطابق ✅', unmatched: 'غير مطابق ❌', duplicate: 'متكرر ⚠️' };
const matchStyles: Record<string, string> = { matched: 'badge-success', unmatched: 'badge-urgent', duplicate: 'badge-warning' };
const approvalLabels: Record<string, string> = { pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض' };
const approvalStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-urgent' };

const ReviewTab = () => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = externalDeductions.filter(d => {
    const matchSearch = d.employeeName.includes(search);
    const matchSource = sourceFilter === 'all' || d.source === sourceFilter;
    const matchApproval = statusFilter === 'all' || d.approvalStatus === statusFilter;
    return matchSearch && matchSource && matchApproval;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['all', 'هنقرستيشن', 'جاهز', 'كيتا'].map(s => (
            <button key={s} onClick={() => setSourceFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sourceFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s === 'all' ? 'الكل' : s}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'معلق' }, { v: 'approved', l: 'معتمد' }, { v: 'rejected', l: 'مرفوض' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
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
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">المطابقة</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">الاعتماد</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="p-3 text-sm font-medium text-foreground">{d.employeeName}</td>
                  <td className="p-3 text-sm text-muted-foreground">{d.source}</td>
                  <td className="p-3 text-sm text-muted-foreground">{d.type}</td>
                  <td className="p-3 text-center text-sm font-semibold text-destructive">{d.amount} ر.س</td>
                  <td className="p-3 text-center text-sm text-muted-foreground">{d.incidentDate}</td>
                  <td className="p-3 text-center text-sm text-muted-foreground">{d.deductionMonth}</td>
                  <td className="p-3 text-center"><span className={matchStyles[d.matchStatus]}>{matchLabels[d.matchStatus]}</span></td>
                  <td className="p-3 text-center"><span className={approvalStyles[d.approvalStatus]}>{approvalLabels[d.approvalStatus]}</span></td>
                  <td className="p-3 text-center">
                    {d.approvalStatus === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" className="text-success h-7 w-7 p-0"><CheckCircle size={14} /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0"><XCircle size={14} /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

const Deductions = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileDown size={24} /> الخصومات الخارجية</h1>
      <p className="text-sm text-muted-foreground mt-1">رفع ومراجعة واعتماد خصومات الشركات</p>
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

export default Deductions;
