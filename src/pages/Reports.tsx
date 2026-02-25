import { BarChart3, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const reports = [
  { name: 'رواتب الشهر', description: 'كشف رواتب كامل بجميع الخصومات والبدلات', filters: 'الشهر، نوع الراتب، حالة الاعتماد', export: 'Excel + PDF' },
  { name: 'الحضور', description: 'ملخص حضور المناديب بالأيام والساعات', filters: 'الشهر، المندوب، نطاق تواريخ', export: 'Excel' },
  { name: 'الطلبات', description: 'إجمالي طلبات كل مندوب حسب التطبيق', filters: 'الشهر، التطبيق، السكيمة', export: 'Excel' },
  { name: 'السلف القائمة', description: 'السلف النشطة والأقساط المتبقية', filters: 'الحالة، المبلغ', export: 'Excel' },
  { name: 'الإقامات', description: 'ترتيب حسب المدة المتبقية للإقامة', filters: 'نطاق الأيام', export: 'Excel + PDF' },
  { name: 'المركبات', description: 'التأمين والتسجيل لجميع المركبات', filters: 'النوع، نطاق التواريخ', export: 'Excel' },
  { name: 'تعيينات الدراجات', description: 'من ركب إيه ومتى', filters: 'الشهر، المندوب، الدراجة', export: 'Excel' },
  { name: 'الخصومات', description: 'خصومات الشركات الخارجية', filters: 'الشهر، المصدر، الحالة', export: 'Excel' },
  { name: 'P&L', description: 'ملخص الأرباح والخسائر', filters: 'الشهر أو نطاق شهور', export: 'Excel + PDF' },
];

const Reports = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BarChart3 size={24} /> التقارير</h1>
      <p className="text-sm text-muted-foreground mt-1">تقارير جاهزة مع إمكانية التصدير</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((r, i) => (
        <div key={i} className="bg-card rounded-xl border border-border/50 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><FileText size={20} /></div>
            <div>
              <h3 className="font-semibold text-foreground">{r.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground"><span className="font-medium">الفلاتر:</span> {r.filters}</p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">التصدير:</span> {r.export}</p>
          </div>
          <div className="flex gap-2">
            {r.export.includes('Excel') && <Button size="sm" variant="outline" className="gap-1 text-xs"><Download size={12} /> Excel</Button>}
            {r.export.includes('PDF') && <Button size="sm" variant="outline" className="gap-1 text-xs"><Download size={12} /> PDF</Button>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Reports;
