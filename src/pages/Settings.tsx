import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Plus, Users, Shield, Pencil, Trash2, ChevronRight, ChevronLeft, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { SalaryScheme } from '@/data/mock';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// ─── Schemes Tab ──────────────────────────────────────────────────
const SchemesTab = () => {
  const { toast } = useToast();
  const [schemes, setSchemes] = useState<SalaryScheme[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SalaryScheme | null>(null);

  const [name, setName] = useState('');
  const [app, setApp] = useState('');
  const [tiers, setTiers] = useState([{ from: 1, to: 500, pricePerOrder: 5 }]);
  const [hasTarget, setHasTarget] = useState(false);
  const [targetOrders, setTargetOrders] = useState(700);
  const [targetBonus, setTargetBonusVal] = useState(400);

  const openAdd = () => {
    setEditing(null);
    setName(''); setApp(''); setTiers([{ from: 1, to: 500, pricePerOrder: 5 }]);
    setHasTarget(false); setTargetOrders(700); setTargetBonusVal(400);
    setShowModal(true);
  };

  const openEdit = (s: SalaryScheme) => {
    setEditing(s);
    setName(s.name); setApp(s.app); setTiers(s.tiers.map(t => ({ from: t.from, to: t.to, pricePerOrder: t.pricePerOrder })));
    setHasTarget(!!s.targetBonus);
    setTargetOrders(s.targetBonus?.target || 700);
    setTargetBonusVal(s.targetBonus?.bonus || 400);
    setShowModal(true);
  };

  const addTier = () => setTiers(prev => [...prev, { from: (prev[prev.length - 1]?.to || 0) + 1, to: (prev[prev.length - 1]?.to || 0) + 500, pricePerOrder: 6 }]);
  const removeTier = (i: number) => setTiers(prev => prev.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: string, val: number) => setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const handleSave = () => {
    if (!name || !app) { toast({ title: 'خطأ', description: 'الاسم والتطبيق مطلوبان', variant: 'destructive' }); return; }
    const scheme: SalaryScheme = {
      id: editing?.id || String(Date.now()),
      name, app, tiers,
      targetBonus: hasTarget ? { target: targetOrders, bonus: targetBonus } : undefined,
      status: editing?.status || 'active',
      assignedCount: editing?.assignedCount || 0,
    };
    if (editing) {
      setSchemes(prev => prev.map(s => s.id === editing.id ? scheme : s));
      toast({ title: 'تم التعديل', description: 'تم تعديل السكيمة بنجاح' });
    } else {
      setSchemes(prev => [...prev, scheme]);
      toast({ title: 'تمت الإضافة', description: 'تمت إضافة السكيمة بنجاح' });
    }
    setShowModal(false);
  };

  const handleArchive = (id: string) => {
    setSchemes(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'archived' : 'active' } : s));
    toast({ title: 'تم التحديث' });
  };

  const appsList = ['هنقرستيشن', 'جاهز', 'كيتا', 'توبو', 'نينجا'];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={openAdd}><Plus size={16} /> إضافة سكيمة</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {schemes.map(s => (
          <div key={s.id} className={`bg-card rounded-xl border shadow-sm p-5 ${s.status === 'active' ? 'border-border/50' : 'border-border/30 opacity-70'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{s.name}</h3>
                <p className="text-xs text-muted-foreground">{s.app} — {s.assignedCount} مناديب</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={s.status === 'active' ? 'badge-success' : 'badge-warning'}>{s.status === 'active' ? 'نشطة' : 'مؤرشفة'}</span>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Pencil size={14} /></button>
                <button onClick={() => handleArchive(s.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={s.status === 'active' ? 'أرشفة' : 'تفعيل'}>
                  {s.status === 'active' ? <Trash2 size={14} /> : <Check size={14} />}
                </button>
              </div>
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
                <span className="text-success font-medium">🎯 Target Bonus:</span> عند {s.targetBonus.target} طلب → +{s.targetBonus.bonus} ر.س
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل السكيمة' : 'إضافة سكيمة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>اسم السكيمة *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="سكيمة هنقر Q2 2025" />
              </div>
              <div className="space-y-2">
                <Label>التطبيق *</Label>
                <Select value={app} onValueChange={setApp}>
                  <SelectTrigger><SelectValue placeholder="اختر التطبيق" /></SelectTrigger>
                  <SelectContent>{appsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>شرائح الأسعار</Label>
                <Button size="sm" variant="outline" onClick={addTier} className="gap-1 h-7 text-xs"><Plus size={12} /> إضافة شريحة</Button>
              </div>
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">من</p>
                      <Input type="number" value={t.from} onChange={e => updateTier(i, 'from', +e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">إلى</p>
                      <Input type="number" value={t.to} onChange={e => updateTier(i, 'to', +e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ر.س/طلب</p>
                      <Input type="number" step="0.5" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  {tiers.length > 1 && (
                    <button onClick={() => removeTier(i)} className="text-destructive hover:text-destructive/80 p-1"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3 border border-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label>مكافأة الهدف (Target Bonus)</Label>
                <Switch checked={hasTarget} onCheckedChange={setHasTarget} />
              </div>
              {hasTarget && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">عدد الطلبات المستهدف</Label>
                    <Input type="number" value={targetOrders} onChange={e => setTargetOrders(+e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">قيمة المكافأة (ر.س)</Label>
                    <Input type="number" value={targetBonus} onChange={e => setTargetBonusVal(+e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? 'حفظ التعديلات' : 'إضافة السكيمة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
