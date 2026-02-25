import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Plus, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { salarySchemes } from '@/data/mock';

const SchemesTab = () => (
  <div className="space-y-4">
    <div className="flex justify-end">
      <Button className="gap-2"><Plus size={16} /> إضافة سكيمة</Button>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {salarySchemes.map(s => (
        <div key={s.id} className={`bg-card rounded-xl border shadow-sm p-5 ${s.status === 'active' ? 'border-border/50' : 'border-border/30 opacity-70'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">{s.name}</h3>
              <p className="text-xs text-muted-foreground">{s.app} — {s.assignedCount} مناديب</p>
            </div>
            <span className={s.status === 'active' ? 'badge-success' : 'badge-warning'}>{s.status === 'active' ? 'نشطة' : 'مؤرشفة'}</span>
          </div>
          <div className="space-y-1.5 mb-3">
            <p className="text-xs font-medium text-muted-foreground">الشرائح:</p>
            {s.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                <span className="text-muted-foreground">من {t.from} إلى {t.to === 9999 ? '∞' : t.to}</span>
                <span className="mr-auto font-semibold text-primary">{t.pricePerOrder} ر.س/طلب</span>
              </div>
            ))}
          </div>
          {s.targetBonus && (
            <div className="bg-success/10 rounded-lg px-3 py-2 text-sm">
              <span className="text-success font-medium">🎯 Target Bonus:</span> عند {s.targetBonus.target} طلب → {s.targetBonus.bonus} ر.س
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const UsersTab = () => {
  const users = [
    { name: 'أدمن رئيسي', role: 'Admin', email: 'admin@delivery.sa' },
    { name: 'محمد المحاسب', role: 'Accountant', email: 'accountant@delivery.sa' },
    { name: 'سارة المديرة', role: 'Manager', email: 'manager@delivery.sa' },
  ];
  const roleLabels: Record<string, string> = { Admin: 'مدير', Manager: 'مشرف', Accountant: 'محاسب', Viewer: 'عارض' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2"><Plus size={16} /> إضافة مستخدم</Button>
      </div>
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الاسم</th>
              <th className="text-right p-4 text-sm font-semibold text-muted-foreground">البريد</th>
              <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الدور</th>
              <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الصلاحيات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                <td className="p-4 text-sm font-medium text-foreground">{u.name}</td>
                <td className="p-4 text-sm text-muted-foreground" dir="ltr">{u.email}</td>
                <td className="p-4 text-center"><span className="badge-info">{roleLabels[u.role]}</span></td>
                <td className="p-4 text-center text-xs text-muted-foreground">
                  {u.role === 'Admin' ? 'كل شيء' : u.role === 'Manager' ? 'الرواتب، السلف، الحضور، الطلبات' : 'الرواتب، P&L، السلف'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RolesInfo = () => (
  <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
    <table className="w-full">
      <thead>
        <tr className="border-b border-border/50 bg-muted/30">
          <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الدور</th>
          <th className="text-right p-4 text-sm font-semibold text-muted-foreground">يقدر يشوف</th>
          <th className="text-right p-4 text-sm font-semibold text-muted-foreground">ما يقدر يوصل</th>
        </tr>
      </thead>
      <tbody>
        {[
          { role: 'Admin', see: 'كل شيء بدون قيود', cant: '—' },
          { role: 'Manager', see: 'كل البيانات', cant: 'الإعدادات' },
          { role: 'Accountant', see: 'الرواتب + P&L + السلف', cant: 'البيانات الشخصية للموظفين' },
          { role: 'Viewer', see: 'التقارير فقط', cant: 'لا شيء — عرض فقط' },
        ].map((r, i) => (
          <tr key={i} className="border-b border-border/30">
            <td className="p-4 text-sm font-semibold text-foreground">{r.role}</td>
            <td className="p-4 text-sm text-muted-foreground">{r.see}</td>
            <td className="p-4 text-sm text-muted-foreground">{r.cant}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Settings = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><SettingsIcon size={24} /> الإعدادات</h1>
      <p className="text-sm text-muted-foreground mt-1">السكيمات والمستخدمين والصلاحيات</p>
    </div>
    <Tabs defaultValue="schemes" dir="rtl">
      <TabsList>
        <TabsTrigger value="schemes">إدارة السكيمات</TabsTrigger>
        <TabsTrigger value="users">المستخدمون</TabsTrigger>
        <TabsTrigger value="roles">الصلاحيات</TabsTrigger>
      </TabsList>
      <TabsContent value="schemes"><SchemesTab /></TabsContent>
      <TabsContent value="users"><UsersTab /></TabsContent>
      <TabsContent value="roles"><RolesInfo /></TabsContent>
    </Tabs>
  </div>
);

export default Settings;
