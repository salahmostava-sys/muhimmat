import { useState, useEffect } from 'react';
import { Shield, User, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_PERMISSIONS, AppRole, PagePermission } from '@/hooks/usePermissions';

type AppRoleType = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

const roleLabels: Record<AppRoleType, { label: string; color: string }> = {
  admin:      { label: 'مدير',          color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  hr:         { label: 'موارد بشرية',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  finance:    { label: 'مالية',          color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  operations: { label: 'عمليات',        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  viewer:     { label: 'عارض',           color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
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

interface UserPermissions {
  [key: string]: PagePermission;
}

const Permissions = () => {
  const { role: currentRole } = useAuth();
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
      id: p.id,
      email: p.email,
      name: p.name,
      is_active: p.is_active,
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

    const { data } = await supabase
      .from('user_permissions')
      .select('permission_key, can_view, can_edit, can_delete')
      .eq('user_id', user.id);

    const perms: UserPermissions = {};

    // Load defaults first
    const role = user.role as AppRole;
    PAGE_KEYS.forEach(({ key }) => {
      const defaults = role ? DEFAULT_PERMISSIONS[role]?.[key] : undefined;
      perms[key] = defaults || { can_view: false, can_edit: false, can_delete: false };
    });

    // Override with custom permissions
    data?.forEach(p => {
      perms[p.permission_key] = { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete };
    });

    setUserPermissions(perms);
    setLoadingPerms(false);
  };

  const togglePermission = (pageKey: string, field: keyof PagePermission) => {
    setUserPermissions(prev => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [field]: !prev[pageKey]?.[field] },
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);

    // Update role
    if (pendingRole !== selectedUser.role) {
      if (selectedUser.role) {
        await supabase.from('user_roles').update({ role: pendingRole! }).eq('user_id', selectedUser.id);
      } else {
        await supabase.from('user_roles').insert({ user_id: selectedUser.id, role: pendingRole! });
      }
    }

    // Upsert permissions
    const rows = PAGE_KEYS.map(({ key }) => ({
      user_id: selectedUser.id,
      permission_key: key,
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
      {/* Page header */}
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>الإعدادات</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>الصلاحيات</span>
        </nav>
        <div>
          <h1 className="page-title flex items-center gap-2"><Shield size={20} /> إدارة الصلاحيات</h1>
          <p className="page-subtitle">تحكم في صلاحيات كل مستخدم على كل صفحة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users list */}
        <div className="ta-table-wrap lg:col-span-1 h-fit">
          <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
            <p className="text-sm font-semibold text-foreground">المستخدمون</p>
            <p className="text-xs text-muted-foreground mt-0.5">{users.length} مستخدم</p>
          </div>
          {loadingUsers ? (
            <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : (
            <div className="divide-y divide-border/40">
              {users.map(user => {
                const isSelected = selectedUser?.id === user.id;
                const roleInfo = user.role ? roleLabels[user.role] : null;
                return (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
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

        {/* Permission editor */}
        <div className="lg:col-span-2">
          {!selectedUser ? (
            <div className="ta-table-wrap p-16 text-center">
              <Shield size={40} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">اختر مستخدماً لتعديل صلاحياته</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* User info header */}
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
                      // Update permissions preview when role changes
                      const perms: UserPermissions = {};
                      PAGE_KEYS.forEach(({ key }) => {
                        perms[key] = DEFAULT_PERMISSIONS[v as AppRole]?.[key] || { can_view: false, can_edit: false, can_delete: false };
                      });
                      setUserPermissions(perms);
                    }}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="اختر الدور" />
                      </SelectTrigger>
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

              {/* Permissions table */}
              <div className="ta-table-wrap">
                <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">صلاحيات الصفحات</p>
                  <button onClick={resetToDefaults} className="text-xs text-primary hover:underline">
                    إعادة للافتراضي
                  </button>
                </div>
                {loadingPerms ? (
                  <div className="p-8 text-center">
                    <Loader2 size={24} className="animate-spin mx-auto text-muted-foreground" />
                  </div>
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
                              <Switch
                                checked={perm.can_view}
                                onCheckedChange={() => togglePermission(key, 'can_view')}
                                disabled={pendingRole === 'admin'}
                              />
                            </td>
                            <td className="ta-td text-center">
                              <Switch
                                checked={perm.can_edit && perm.can_view}
                                onCheckedChange={() => togglePermission(key, 'can_edit')}
                                disabled={!perm.can_view || pendingRole === 'admin'}
                              />
                            </td>
                            <td className="ta-td text-center">
                              <Switch
                                checked={perm.can_delete && perm.can_view}
                                onCheckedChange={() => togglePermission(key, 'can_delete')}
                                disabled={!perm.can_view || pendingRole === 'admin'}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Save button */}
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

      {/* Legend */}
      <div className="bg-muted/30 rounded-xl border border-border/30 p-4">
        <p className="text-sm font-medium text-foreground mb-3">🎭 الأدوار الافتراضية</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(roleLabels).map(([role, info]) => (
            <div key={role} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded font-semibold ${info.color}`}>{info.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          الصلاحيات المخصصة تتجاوز الافتراضية. المدير يملك صلاحيات كاملة دائماً ولا يمكن تقييدها.
        </p>
      </div>
    </div>
  );
};

export default Permissions;
