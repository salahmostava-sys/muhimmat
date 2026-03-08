import { useState, useEffect } from 'react';
import { Users as UsersIcon, Shield, Plus, Loader2, RefreshCw, User, ChevronRight, Check, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_PERMISSIONS, AppRole, PagePermission } from '@/hooks/usePermissions';

type AppRoleType = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';
type Profile = { id: string; name?: string | null; email?: string | null; is_active: boolean };

const roleLabels: Record<AppRoleType, string> = {
  admin: 'مدير', hr: 'موارد بشرية', finance: 'مالية', operations: 'عمليات', viewer: 'عارض',
};
const roleColors: Record<AppRoleType, string> = {
  admin: 'badge-urgent',
  hr: 'badge-info',
  finance: 'badge-success',
  operations: 'badge-warning',
  viewer: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full',
};
const roleTagColors: Record<AppRoleType, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  hr: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  finance: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  operations: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const PAGE_KEYS = [
  { key: 'employees', label: 'الموظفون' },
  { key: 'attendance', label: 'الحضور والانصراف' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'salaries', label: 'الرواتب' },
  { key: 'advances', label: 'السلف' },
  { key: 'deductions', label: 'الخصومات' },
  { key: 'vehicles', label: 'المركبات' },
  { key: 'alerts', label: 'التنبيهات' },
  { key: 'apps', label: 'التطبيقات' },
  { key: 'settings', label: 'الإعدادات' },
];

interface UserWithRole {
  id: string;
  email: string | null;
  name: string | null;
  is_active: boolean;
  role: AppRoleType | null;
}
interface UserPermissions { [key: string]: PagePermission; }

// ─── Users Tab ────────────────────────────────────────────────────────────────
const UsersTab = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRoleType>('viewer');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: pData }, { data: rData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    if (pData) setProfiles(pData as Profile[]);
    if (rData) setUserRoles(rData);
    setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  const getRole = (userId: string) => userRoles.find(r => r.user_id === userId)?.role as AppRoleType | undefined;

  const handleAdd = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newEmail, password: newPassword, options: { data: { name: newName } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: newRole });
        await supabase.from('profiles').upsert({ id: data.user.id, email: newEmail, name: newName, is_active: true });
        toast({ title: 'تم الإنشاء', description: `تم إنشاء حساب ${newName} بدور ${roleLabels[newRole]}` });
        setShowAdd(false);
        setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('viewer');
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete role and permissions first, then mark profile inactive
      await Promise.all([
        supabase.from('user_roles').delete().eq('user_id', deleteTarget.id),
        supabase.from('user_permissions').delete().eq('user_id', deleteTarget.id),
      ]);
      // Mark profile as inactive (soft delete — we can't call auth admin from client)
      await supabase.from('profiles').update({ is_active: false }).eq('id', deleteTarget.id);
      toast({ title: '🗑️ تم حذف المستخدم', description: `تم إلغاء صلاحيات ${deleteTarget.name || deleteTarget.email} وتعطيل حسابه` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{profiles.length} مستخدم مسجل</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchUsers}><RefreshCw size={14} /> تحديث</Button>
          <Button className="gap-2" onClick={() => setShowAdd(true)}><Plus size={16} /> إضافة مستخدم</Button>
        </div>
      </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : profiles.length === 0 ? (
          <div className="p-16 text-center">
            <UsersIcon size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد حسابات مسجلة بعد</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">الاسم</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">البريد</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">الدور</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">الحالة</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(u => {
                const role = getRole(u.id);
                return (
                  <tr key={u.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                          {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.name || '—'}</p>
                          {!u.is_active && <p className="text-[10px] text-destructive">محذوف</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground" dir="ltr">{u.email || '—'}</td>
                    <td className="p-3 text-center">
                      {role ? <span className={roleColors[role]}>{roleLabels[role]}</span> : <span className="text-xs text-muted-foreground">بدون دور</span>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={u.is_active ? 'badge-success' : 'badge-urgent'}>{u.is_active ? 'نشط' : 'معطّل'}</span>
                    </td>
                    <td className="p-3 text-center">
                      {u.is_active && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="حذف المستخدم"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> تأكيد حذف المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حساب <strong>{deleteTarget?.name || deleteTarget?.email}</strong>؟
              <br />
              سيتم تعطيل الحساب وإلغاء جميع الصلاحيات. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield size={18} /> إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>الاسم الكامل *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="أحمد محمد" /></div>
            <div className="space-y-2"><Label>البريد الإلكتروني *</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@delivery.sa" dir="ltr" /></div>
            <div className="space-y-2"><Label>كلمة المرور *</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
            <div className="space-y-2">
              <Label>الدور والصلاحيات *</Label>
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                {newRole === 'finance' && '✅ الرواتب، السلف، الخصومات'}
                {newRole === 'operations' && '✅ الطلبات اليومية، المركبات، التتبع'}
                {newRole === 'viewer' && '✅ عرض التقارير فقط — لا يمكن التعديل'}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin ml-1" /> : <Plus size={14} className="ml-1" />}
              إنشاء الحساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Permissions Tab ──────────────────────────────────────────────────────────
const PermissionsTab = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRole, setPendingRole] = useState<AppRoleType | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id, email, name, is_active').order('created_at'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const rolesMap = new Map<string, AppRoleType>();
    rolesRes.data?.forEach(r => rolesMap.set(r.user_id, r.role as AppRoleType));
    const list: UserWithRole[] = (profilesRes.data || []).map(p => ({
      id: p.id, email: p.email, name: p.name, is_active: p.is_active,
      role: rolesMap.get(p.id) || null,
    }));
    setUsers(list);
    setLoadingUsers(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  const selectUser = async (user: UserWithRole) => {
    setSelectedUser(user);
    setPendingRole(user.role);
    setLoadingPerms(true);
    const { data } = await supabase.from('user_permissions')
      .select('permission_key, can_view, can_edit, can_delete').eq('user_id', user.id);
    const perms: UserPermissions = {};
    const role = user.role as AppRole;
    PAGE_KEYS.forEach(({ key }) => {
      const defaults = role ? DEFAULT_PERMISSIONS[role]?.[key] : undefined;
      perms[key] = defaults || { can_view: false, can_edit: false, can_delete: false };
    });
    data?.forEach(p => { perms[p.permission_key] = { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete }; });
    setUserPermissions(perms);
    setLoadingPerms(false);
  };

  const togglePermission = (pageKey: string, field: keyof PagePermission) => {
    setUserPermissions(prev => ({ ...prev, [pageKey]: { ...prev[pageKey], [field]: !prev[pageKey]?.[field] } }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    if (pendingRole !== selectedUser.role) {
      if (selectedUser.role) {
        await supabase.from('user_roles').update({ role: pendingRole! }).eq('user_id', selectedUser.id);
      } else {
        await supabase.from('user_roles').insert({ user_id: selectedUser.id, role: pendingRole! });
      }
    }
    const rows = PAGE_KEYS.map(({ key }) => ({
      user_id: selectedUser.id, permission_key: key,
      can_view: userPermissions[key]?.can_view || false,
      can_edit: userPermissions[key]?.can_edit || false,
      can_delete: userPermissions[key]?.can_delete || false,
    }));
    await supabase.from('user_permissions').delete().eq('user_id', selectedUser.id);
    await supabase.from('user_permissions').insert(rows);
    setSaving(false);
    toast({ title: 'تم حفظ الصلاحيات ✅', description: `تم تحديث صلاحيات ${selectedUser.name || selectedUser.email}` });
    setSelectedUser(prev => prev ? { ...prev, role: pendingRole } : null);
    fetchUsers();
  };

  const resetToDefaults = () => {
    if (!pendingRole) return;
    const perms: UserPermissions = {};
    PAGE_KEYS.forEach(({ key }) => {
      perms[key] = DEFAULT_PERMISSIONS[pendingRole as AppRole]?.[key] || { can_view: false, can_edit: false, can_delete: false };
    });
    setUserPermissions(perms);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Users list */}
      <div className="ta-table-wrap lg:col-span-1 h-fit">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <p className="text-sm font-semibold text-foreground">اختر مستخدماً</p>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} مستخدم</p>
        </div>
        {loadingUsers ? (
          <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
        ) : (
          <div className="divide-y divide-border/40">
            {users.map(user => {
              const isSelected = selectedUser?.id === user.id;
              const roleInfo = user.role ? { label: roleLabels[user.role], color: roleTagColors[user.role] } : null;
              return (
                <button key={user.id} onClick={() => selectUser(user)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-right ${isSelected ? 'bg-primary/5 border-r-2 border-primary' : 'hover:bg-muted/30'}`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{user.name || user.email}</p>
                    {roleInfo && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold mt-0.5 inline-block ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 ${isSelected ? 'text-primary' : ''}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Permissions panel */}
      <div className="lg:col-span-2">
        {!selectedUser ? (
          <div className="ta-table-wrap p-16 text-center">
            <Shield size={40} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">اختر مستخدماً لتعديل صلاحياته</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="ta-table-wrap p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{selectedUser.name || selectedUser.email}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground">الدور:</label>
                  <Select value={pendingRole || ''} onValueChange={v => {
                    setPendingRole(v as AppRoleType);
                    const perms: UserPermissions = {};
                    PAGE_KEYS.forEach(({ key }) => {
                      perms[key] = DEFAULT_PERMISSIONS[v as AppRole]?.[key] || { can_view: false, can_edit: false, can_delete: false };
                    });
                    setUserPermissions(perms);
                  }}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مدير</SelectItem>
                      <SelectItem value="hr">موارد بشرية</SelectItem>
                      <SelectItem value="finance">مالية</SelectItem>
                      <SelectItem value="operations">عمليات</SelectItem>
                      <SelectItem value="viewer">عارض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="ta-table-wrap">
              <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">صلاحيات الصفحات</p>
                <button onClick={resetToDefaults} className="text-xs text-primary hover:underline">إعادة للافتراضي</button>
              </div>
              {loadingPerms ? (
                <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <table className="w-full">
                  <thead className="ta-thead">
                    <tr>
                      <th className="ta-th text-right">الصفحة</th>
                      <th className="ta-th text-center">عرض</th>
                      <th className="ta-th text-center">تعديل</th>
                      <th className="ta-th text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAGE_KEYS.map(({ key, label }) => {
                      const perm = userPermissions[key] || { can_view: false, can_edit: false, can_delete: false };
                      return (
                        <tr key={key} className="ta-tr">
                          <td className="ta-td font-medium text-foreground">{label}</td>
                          <td className="ta-td text-center">
                            <Switch checked={perm.can_view} onCheckedChange={() => togglePermission(key, 'can_view')} disabled={pendingRole === 'admin'} />
                          </td>
                          <td className="ta-td text-center">
                            <Switch checked={perm.can_edit && perm.can_view} onCheckedChange={() => togglePermission(key, 'can_edit')} disabled={!perm.can_view || pendingRole === 'admin'} />
                          </td>
                          <td className="ta-td text-center">
                            <Switch checked={perm.can_delete && perm.can_view} onCheckedChange={() => togglePermission(key, 'can_delete')} disabled={!perm.can_view || pendingRole === 'admin'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>إلغاء</Button>
              <Button onClick={savePermissions} disabled={saving} className="gap-2 min-w-32">
                {saving ? <><Loader2 size={14} className="animate-spin" /> جاري الحفظ...</> : <><Check size={14} /> حفظ الصلاحيات</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const UsersAndPermissions = () => {
  const { role: currentRole } = useAuth();

  if (currentRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">غير مصرح</p>
        <p className="text-sm text-muted-foreground">هذه الصفحة متاحة للمدير فقط</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <UsersIcon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">المستخدمون والصلاحيات</h1>
          <p className="text-sm text-muted-foreground">إدارة حسابات الوصول وضبط الصلاحيات</p>
        </div>
      </div>

      <Tabs defaultValue="users" dir="rtl">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><UsersIcon size={14} /> المستخدمون</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><Shield size={14} /> الصلاحيات</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="permissions" className="mt-4"><PermissionsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default UsersAndPermissions;
