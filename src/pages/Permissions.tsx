import { Shield } from 'lucide-react';

const pages = [
  { key: 'employees', name: 'الموظفون', roles: { admin: 'full', hr: 'full', finance: 'view', operations: 'view', viewer: 'view' } },
  { key: 'attendance', name: 'الحضور', roles: { admin: 'full', hr: 'full', finance: 'view', operations: 'none', viewer: 'view' } },
  { key: 'orders', name: 'الطلبات', roles: { admin: 'full', hr: 'view', finance: 'view', operations: 'full', viewer: 'view' } },
  { key: 'salaries', name: 'الرواتب', roles: { admin: 'full', hr: 'view', finance: 'full', operations: 'none', viewer: 'view' } },
  { key: 'advances', name: 'السلف', roles: { admin: 'full', hr: 'view', finance: 'full', operations: 'none', viewer: 'view' } },
  { key: 'deductions', name: 'الخصومات', roles: { admin: 'full', hr: 'none', finance: 'full', operations: 'none', viewer: 'view' } },
  { key: 'vehicles', name: 'المركبات', roles: { admin: 'full', hr: 'view', finance: 'none', operations: 'full', viewer: 'view' } },
  { key: 'alerts', name: 'التنبيهات', roles: { admin: 'full', hr: 'full', finance: 'view', operations: 'view', viewer: 'view' } },
  { key: 'settings', name: 'الإعدادات', roles: { admin: 'full', hr: 'none', finance: 'none', operations: 'none', viewer: 'none' } },
];

const permLabel: Record<string, string> = { full: '✅ كامل', view: '👁️ عرض', none: '🚫 منع' };
const permStyle: Record<string, string> = { full: 'text-success font-semibold', view: 'text-info', none: 'text-muted-foreground' };

const Permissions = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Shield size={24} /> الصلاحيات
      </h1>
      <p className="text-sm text-muted-foreground mt-1">مستوى وصول كل دور حسب الصفحة</p>
    </div>

    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الصفحة</th>
              <th className="text-center p-4 text-sm font-semibold text-destructive">مدير</th>
              <th className="text-center p-4 text-sm font-semibold text-info">موارد بشرية</th>
              <th className="text-center p-4 text-sm font-semibold text-success">مالية</th>
              <th className="text-center p-4 text-sm font-semibold text-warning">عمليات</th>
              <th className="text-center p-4 text-sm font-semibold text-muted-foreground">عارض</th>
            </tr>
          </thead>
          <tbody>
            {pages.map(p => (
              <tr key={p.key} className="border-b border-border/30 hover:bg-muted/20">
                <td className="p-4 text-sm font-medium text-foreground">{p.name}</td>
                {(['admin', 'hr', 'finance', 'operations', 'viewer'] as const).map(role => (
                  <td key={role} className={`p-4 text-center text-xs ${permStyle[p.roles[role]]}`}>
                    {permLabel[p.roles[role]]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-muted/30 rounded-xl border border-border/30 p-4">
      <p className="text-sm font-medium text-foreground mb-2">📋 ملاحظة</p>
      <p className="text-sm text-muted-foreground">الصلاحيات مطبّقة على مستوى قاعدة البيانات باستخدام سياسات RLS. التعديل على هذه الجدول يتطلب مدير النظام.</p>
    </div>
  </div>
);

export default Permissions;
