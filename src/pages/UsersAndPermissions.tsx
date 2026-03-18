import { useState, useEffect, useRef } from 'react';
import { Users as UsersIcon, Shield, Plus, Loader2, RefreshCw, User, ChevronRight, Check, Trash2, AlertTriangle, UserCheck, Pencil, KeyRound, UserX, MoreVertical } from 'lucide-react';
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

// ─── Blue Toggle Switch ────────────────────────────────────────────────────────
const BlueSwitch = ({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: () => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onCheckedChange}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40
      ${checked ? 'bg-primary' : 'bg-muted-foreground/25'}`}
  >
    <span
      className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform
        ${checked ? 'translate-x-4' : 'translate-x-0'}`}
    />
  </button>
);

// ─── 3-dot Actions Menu ───────────────────────────────────────────────────────
const DropdownMenuRoot = ({ u, openEdit, setDeleteTarget, handleReactivate, isReactivating }: {
  u: Profile;
  openEdit: (u: Profile) => void;
  setDeleteTarget: (u: Profile) => void;
  handleReactivate: (u: Profile) => void;
  isReactivating: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]" dir="rtl">
          <button
            onClick={() => { openEdit(u); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-foreground"
          >
            <Pencil size={13} className="text-primary" /> تعديل
          </button>
          {u.is_active ? (
            <button
              onClick={() => { setDeleteTarget(u); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-warning"
            >
              <UserX size={13} /> تعطيل
            </button>
          ) : (
            <button
              disabled={isReactivating}
              onClick={() => { handleReactivate(u); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-success disabled:opacity-50"
            >
              <UserCheck size={13} /> تفعيل
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  // Edit user state
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  const openEdit = (u: Profile) => {
    setEditTarget(u);
    setEditName(u.name || '');
    setEditPassword('');
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    try {
      // Update name in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: editName.trim() })
        .eq('id', editTarget.id);
      if (profileError) throw profileError;

      // Update password via edge function if provided
      if (editPassword.trim().length > 0) {
        const { error: pwError } = await supabase.functions.invoke('admin-update-user', {
          body: { user_id: editTarget.id, password: editPassword.trim() },
        });
        if (pwError) throw pwError;
      }

      toast({ title: '✅ تم التحديث', description: `تم تحديث بيانات ${editName}` });
      setEditTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setEditSaving(false);
  };

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
      await Promise.all([
        supabase.from('user_roles').delete().eq('user_id', deleteTarget.id),
        supabase.from('user_permissions').delete().eq('user_id', deleteTarget.id),
      ]);
      await supabase.from('profiles').update({ is_active: false }).eq('id', deleteTarget.id);
      toast({ title: '🗑️ تم تعطيل المستخدم', description: `تم إلغاء صلاحيات ${deleteTarget.name || deleteTarget.email} وتعطيل حسابه` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setDeleting(false);
  };

  const handleReactivate = async (u: Profile) => {
    setReactivating(u.id);
    try {
      await supabase.from('profiles').update({ is_active: true }).eq('id', u.id);
      toast({ title: '✅ تم إعادة تفعيل الحساب', description: `${u.name || u.email} أصبح نشطاً مجدداً` });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setReactivating(null);
  };

  const handleRoleChange = async (userId: string, newRoleVal: AppRoleType) => {
    setSavingRole(userId);
    try {
      const existing = userRoles.find(r => r.user_id === userId);
      if (existing) {
        await supabase.from('user_roles').update({ role: newRoleVal }).eq('user_id', userId);
      } else {
        await supabase.from('user_roles').insert({ user_id: userId, role: newRoleVal });
      }
      setUserRoles(prev => [...prev.filter(r => r.user_id !== userId), { user_id: userId, role: newRoleVal }]);
      toast({ title: '✅ تم تحديث الدور', description: `تم تغيير الدور إلى ${roleLabels[newRoleVal]}` });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setSavingRole(null);
    setEditingRoleFor(null);
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
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(u => {
                const role = getRole(u.id);
                const isEditingRole = editingRoleFor === u.id;
                const isSavingRole = savingRole === u.id;
                const isReactivating = reactivating === u.id;
                return (
                  <tr key={u.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${u.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.name || '—'}</p>
                          {!u.is_active && <p className="text-[10px] text-destructive font-medium">معطّل</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground" dir="ltr">{u.email || '—'}</td>

                    {/* ── Inline role editor ── */}
                    <td className="p-3 text-center">
                      {isEditingRole ? (
                        <div className="flex items-center justify-center gap-1">
                          <Select
                            value={role || 'viewer'}
                            onValueChange={(v: AppRoleType) => handleRoleChange(u.id, v)}
                            disabled={isSavingRole}
                          >
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">🔴 مدير</SelectItem>
                              <SelectItem value="hr">🔵 موارد بشرية</SelectItem>
                              <SelectItem value="finance">🟢 مالية</SelectItem>
                              <SelectItem value="operations">🟠 عمليات</SelectItem>
                              <SelectItem value="viewer">⚪ عارض</SelectItem>
                            </SelectContent>
                          </Select>
                          {isSavingRole
                            ? <Loader2 size={13} className="animate-spin text-muted-foreground" />
                            : <button onClick={() => setEditingRoleFor(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                          }
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1.5 mx-auto group"
                          onClick={() => u.is_active && setEditingRoleFor(u.id)}
                          title={u.is_active ? 'انقر لتعديل الدور' : ''}
                        >
                          {role
                            ? <span className={roleColors[role]}>{roleLabels[role]}</span>
                            : <span className="text-xs text-muted-foreground">بدون دور</span>
                          }
                          {u.is_active && <Pencil size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <span className={u.is_active ? 'badge-success' : 'badge-urgent'}>{u.is_active ? 'نشط' : 'معطّل'}</span>
                    </td>

                    <td className="p-3 text-center">
                      <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                        <DropdownMenuRoot u={u} openEdit={openEdit} setDeleteTarget={setDeleteTarget} handleReactivate={handleReactivate} isReactivating={reactivating === u.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              تعديل بيانات المستخدم
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm text-muted-foreground" dir="ltr">
              {editTarget?.email}
            </div>
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="اسم المستخدم" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><KeyRound size={13} /> كلمة مرور جديدة <span className="text-muted-foreground font-normal text-xs">(اتركها فارغة إن لم ترد التغيير)</span></Label>
              <Input
                type="password"
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {/* Deactivate option in edit dialog */}
            {editTarget?.is_active && (
              <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
                <p className="text-xs text-destructive font-medium mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> منطقة الخطر
                </p>
                <button
                  type="button"
                  onClick={() => { setEditTarget(null); setDeleteTarget(editTarget); }}
                  className="flex items-center gap-2 text-xs text-destructive hover:underline font-medium"
                >
                  <UserX size={13} /> تعطيل هذا الحساب
                </button>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={editSaving} className="gap-2">
              {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> تأكيد تعطيل المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تعطيل حساب <strong>{deleteTarget?.name || deleteTarget?.email}</strong>؟
              <br />
              سيتم إلغاء جميع الصلاحيات وتعطيل الحساب. يمكنك إعادة تفعيله لاحقاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
              تأكيد التعطيل
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

            {/* Permissions table with blue switches */}
            <div className="ta-table-wrap overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">صلاحيات الصفحات</p>
                <button onClick={resetToDefaults} className="text-xs text-primary hover:underline">إعادة للافتراضي</button>
              </div>
              {loadingPerms ? (
                <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border/40">
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">الصفحة</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-primary">عرض</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-primary">تعديل</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-primary">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAGE_KEYS.map(({ key, label }, idx) => {
                      const perm = userPermissions[key] || { can_view: false, can_edit: false, can_delete: false };
                      return (
                        <tr key={key} className={`border-b border-border/20 hover:bg-primary/3 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-4 py-2.5 text-sm font-medium text-foreground">{label}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <BlueSwitch
                                checked={perm.can_view}
                                onCheckedChange={() => togglePermission(key, 'can_view')}
                                disabled={pendingRole === 'admin'}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <BlueSwitch
                                checked={perm.can_edit && perm.can_view}
                                onCheckedChange={() => togglePermission(key, 'can_edit')}
                                disabled={!perm.can_view || pendingRole === 'admin'}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <BlueSwitch
                                checked={perm.can_delete && perm.can_view}
                                onCheckedChange={() => togglePermission(key, 'can_delete')}
                                disabled={!perm.can_view || pendingRole === 'admin'}
                              />
                            </div>
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
