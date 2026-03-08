import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Plus, Users, Shield, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// ─── Schemes Tab — redirects to /salary-schemes ───────────────────
const SchemesTab = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
        <Settings as SettingsIcon size={26} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">إدارة سكيمات الرواتب</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          يمكنك إنشاء وتعديل سكيمات الرواتب وشرائح الأسعار والمستهدفات من صفحة السكيمات المخصصة.
        </p>
      </div>
      <Button onClick={() => navigate('/settings/schemes')} className="gap-2">
        <ExternalLink size={16} /> الانتقال إلى صفحة السكيمات
      </Button>
    </div>
  );
};

// ─── Users Tab ────────────────────────────────────────────────────
const UsersTab = () => {
  const { toast } = useToast();
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'hr' | 'finance' | 'operations' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);

  const roleLabels: Record<string, string> = { admin: 'مدير', hr: 'موارد بشرية', finance: 'مالية', operations: 'عمليات', viewer: 'عارض' };
  const roleColors: Record<string, string> = { admin: 'badge-urgent', hr: 'badge-info', finance: 'badge-success', operations: 'badge-warning', viewer: 'badge-info' };

  const handleAddUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Create user via Supabase Auth admin
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { name: newName } },
      });
      if (error) throw error;
      if (data.user) {
        // Assign role
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: newRole });
        // Update profile name
        await supabase.from('profiles').upsert({ id: data.user.id, email: newEmail, name: newName, is_active: true });
        toast({ title: 'تم الإنشاء', description: `تم إنشاء حساب ${newName} بدور ${roleLabels[newRole]}` });
        setShowAddUser(false);
        setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('viewer');
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const staticUsers = [
    { name: 'أدمن رئيسي', role: 'admin', email: 'admin@delivery.sa', active: true },
    { name: 'محمد المحاسب', role: 'finance', email: 'accountant@delivery.sa', active: true },
    { name: 'سارة المديرة', role: 'hr', email: 'manager@delivery.sa', active: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setShowAddUser(true)}><Plus size={16} /> إضافة مستخدم جديد</Button>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الاسم</th>
              <th className="text-right p-4 text-sm font-semibold text-muted-foreground">البريد</th>
              <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الدور</th>
              <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {staticUsers.map((u, i) => (
              <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                <td className="p-4 text-sm font-medium text-foreground">{u.name}</td>
                <td className="p-4 text-sm text-muted-foreground" dir="ltr">{u.email}</td>
                <td className="p-4 text-center"><span className={roleColors[u.role]}>{roleLabels[u.role]}</span></td>
                <td className="p-4 text-center"><span className="badge-success">نشط</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="أحمد محمد" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني *</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@delivery.sa" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>الدور والصلاحيات *</Label>
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">🔴 مدير — صلاحيات كاملة</SelectItem>
                  <SelectItem value="hr">🔵 موارد بشرية — الموظفون والحضور</SelectItem>
                  <SelectItem value="finance">🟢 مالية — الرواتب والسلف والخصومات</SelectItem>
                  <SelectItem value="operations">🟠 عمليات — الطلبات والمركبات</SelectItem>
                  <SelectItem value="viewer">⚪ عارض — عرض فقط</SelectItem>
                </SelectContent>
              </Select>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                {newRole === 'admin' && '✅ وصول كامل لكل شيء بدون قيود'}
                {newRole === 'hr' && '✅ الموظفون، الحضور، التطبيقات، التنبيهات'}
                {newRole === 'finance' && '✅ الرواتب، السلف، الخصومات، P&L'}
                {newRole === 'operations' && '✅ الطلبات اليومية، المركبات، التتبع'}
                {newRole === 'viewer' && '✅ عرض التقارير فقط — لا يمكن التعديل'}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddUser(false)}>إلغاء</Button>
            <Button onClick={handleAddUser} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin ml-1" /> : <Plus size={14} className="ml-1" />}
              إنشاء الحساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Permissions Tab ──────────────────────────────────────────────
const PermissionsTab = () => {
  const pages = [
    { key: 'employees', name: 'الموظفون', roles: { admin: 'full', hr: 'full', finance: 'view', operations: 'view', viewer: 'view' } },
    { key: 'attendance', name: 'الحضور', roles: { admin: 'full', hr: 'full', finance: 'view', operations: 'none', viewer: 'view' } },
    { key: 'orders', name: 'الطلبات', roles: { admin: 'full', hr: 'view', finance: 'view', operations: 'full', viewer: 'view' } },
    { key: 'salaries', name: 'الرواتب', roles: { admin: 'full', hr: 'view', finance: 'full', operations: 'none', viewer: 'view' } },
    { key: 'advances', name: 'السلف', roles: { admin: 'full', hr: 'view', finance: 'full', operations: 'none', viewer: 'view' } },
    { key: 'deductions', name: 'الخصومات', roles: { admin: 'full', hr: 'none', finance: 'full', operations: 'none', viewer: 'view' } },
    { key: 'pl', name: 'P&L', roles: { admin: 'full', hr: 'none', finance: 'full', operations: 'none', viewer: 'view' } },
    { key: 'vehicles', name: 'المركبات', roles: { admin: 'full', hr: 'view', finance: 'none', operations: 'full', viewer: 'view' } },
    { key: 'alerts', name: 'التنبيهات', roles: { admin: 'full', hr: 'full', finance: 'view', operations: 'view', viewer: 'view' } },
    { key: 'reports', name: 'التقارير', roles: { admin: 'full', hr: 'view', finance: 'full', operations: 'view', viewer: 'view' } },
    { key: 'settings', name: 'الإعدادات', roles: { admin: 'full', hr: 'none', finance: 'none', operations: 'none', viewer: 'none' } },
  ];

  const permLabel: Record<string, string> = { full: '✅ كامل', view: '👁️ عرض', none: '🚫 منع' };
  const permStyle: Record<string, string> = { full: 'text-success font-semibold', view: 'text-info', none: 'text-muted-foreground' };

  return (
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
            {pages.map((p) => (
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
  );
};

// ─── Main ─────────────────────────────────────────────────────────
const Settings = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <SettingsIcon size={24} /> الإعدادات
      </h1>
      <p className="text-sm text-muted-foreground mt-1">السكيمات والمستخدمين والصلاحيات</p>
    </div>
    <Tabs defaultValue="schemes" dir="rtl">
      <TabsList>
        <TabsTrigger value="schemes">إدارة السكيمات</TabsTrigger>
        <TabsTrigger value="users">المستخدمون</TabsTrigger>
        <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
      </TabsList>
      <TabsContent value="schemes" className="mt-4"><SchemesTab /></TabsContent>
      <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
      <TabsContent value="permissions" className="mt-4"><PermissionsTab /></TabsContent>
    </Tabs>
  </div>
);

export default Settings;
