import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert';
import { useToast } from '@shared/hooks/use-toast';
import { userPermissionService } from '@services/userPermissionService';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions, DEFAULT_PERMISSIONS, type AppRole, type PagePermission } from '@shared/hooks/usePermissions';
import { PERMISSION_PAGE_ENTRIES } from '@shared/constants/permissionPages';
import { defaultQueryRetry } from '@shared/lib/query';

type ProfileRow = {
  id: string;
  name: string | null;
  is_active: boolean | null;
};

type UserRow = {
  id: string;
  name: string;
  isActive: boolean;
  role: AppRole;
};

const ROLES: AppRole[] = ['admin', 'hr', 'finance', 'operations', 'viewer'];

const ROLE_LABELS_AR: Record<AppRole, string> = {
  admin: 'مدير النظام',
  hr: 'موارد بشرية',
  finance: 'مالية',
  operations: 'عمليات',
  viewer: 'عرض فقط',
};

function mergeMatrix(
  role: AppRole,
  dbRows: { permission_key: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]
): Record<string, PagePermission> {
  const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.viewer;
  const dbMap = Object.fromEntries(dbRows.map((r) => [r.permission_key, r]));
  const out: Record<string, PagePermission> = {};
  for (const { key } of PERMISSION_PAGE_ENTRIES) {
    const row = dbMap[key];
    const def = defaults[key] ?? { can_view: false, can_edit: false, can_delete: false };
    out[key] = row
      ? { can_view: row.can_view, can_edit: row.can_edit, can_delete: row.can_delete }
      : { ...def };
  }
  return out;
}

interface UsersAndPermissionsProps {
  embedded?: boolean;
}

const UsersAndPermissions = ({ embedded = false }: UsersAndPermissionsProps) => {
  const { toast } = useToast();
  const { role: authRole, loading: authLoading } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: settingsPerm } = usePermissions('settings');

  const [rows, setRows] = useState<UserRow[]>([]);
  const {
    data: usersRows = [],
    isLoading: loading,
    error: usersError,
    refetch: refetchUsersData,
  } = useQuery({
    queryKey: ['users-and-permissions', uid, 'rows'],
    enabled,
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        userPermissionService.getProfiles(),
        userPermissionService.getUserRoles(),
      ]);

      const roleMap: Record<string, AppRole> = {};
      (roles || []).forEach((r) => {
        roleMap[r.user_id] = (r.role as AppRole) || 'viewer';
      });

      return ((profiles || []) as ProfileRow[]).map((p) => ({
        id: p.id,
        name: p.name || 'بدون اسم',
        isActive: p.is_active ?? true,
        role: roleMap[p.id] || 'viewer',
      })) as UserRow[];
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Record<string, PagePermission>>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const isAdmin = authRole === 'admin';
  const canEdit = settingsPerm.can_edit && isAdmin;

  useEffect(() => {
    setRows(usersRows);
  }, [usersRows]);

  useEffect(() => {
    if (!usersError) return;
    const message = usersError instanceof Error ? usersError.message : 'تعذر تحميل بيانات المستخدمين والصلاحيات';
    toast({
      title: 'خطأ في تحميل المستخدمين',
      description: message,
      variant: 'destructive',
    });
  }, [usersError, toast]);

  const selectedUser = useMemo(() => rows.find((r) => r.id === permUserId) ?? null, [rows, permUserId]);

  const loadMatrix = useCallback(async (userId: string, role: AppRole) => {
    if (!isAdmin) return;
    setMatrixLoading(true);
    try {
      const data = await userPermissionService.getUserPermissions(userId);
      setMatrix(mergeMatrix(role, (data || []) as { permission_key: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل الصلاحيات';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    } finally {
      setMatrixLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    if (rows.length && !permUserId) {
      setPermUserId(rows[0].id);
    }
  }, [rows, permUserId]);

  useEffect(() => {
    if (!permUserId || !isAdmin) return;
    const u = rows.find((r) => r.id === permUserId);
    if (!u) return;
    void loadMatrix(u.id, u.role);
  }, [permUserId, rows, isAdmin, loadMatrix]);

  const totals = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
    };
  }, [rows]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      if (activeFilter === 'active' && !row.isActive) return false;
      if (activeFilter === 'inactive' && row.isActive) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q);
    });
  }, [activeFilter, roleFilter, rows, userSearch]);

  const updateRole = async (userId: string, role: AppRole) => {
    if (!canEdit) return;
    setSavingId(userId);
    try {
      await userPermissionService.upsertRole(userId, role);

      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
      toast({ title: 'تم تحديث الدور' });
      if (userId === permUserId) {
        await loadMatrix(userId, role);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ';
      toast({
        title: 'فشل تحديث الدور',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const setCell = (pageKey: string, field: keyof PagePermission, value: boolean) => {
    setMatrix((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [field]: value },
    }));
  };

  const saveMatrix = async () => {
    if (!canEdit || !selectedUser || !isAdmin) return;
    setSavingMatrix(true);
    try {
      const roleDefaults = DEFAULT_PERMISSIONS[selectedUser.role] || DEFAULT_PERMISSIONS.viewer;
      for (const { key } of PERMISSION_PAGE_ENTRIES) {
        const cur = matrix[key];
        if (!cur) continue;
        const def = roleDefaults[key] ?? { can_view: false, can_edit: false, can_delete: false };
        const same =
          cur.can_view === def.can_view && cur.can_edit === def.can_edit && cur.can_delete === def.can_delete;
        if (same) {
          await userPermissionService.deletePermission(selectedUser.id, key);
        } else {
          await userPermissionService.upsertPermission(selectedUser.id, key, cur);
        }
      }
      toast({ title: 'تم حفظ الصلاحيات' });
      await loadMatrix(selectedUser.id, selectedUser.role);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل الحفظ';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    } finally {
      setSavingMatrix(false);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        جاري التحقق من الجلسة...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>غير متاح</AlertTitle>
        <AlertDescription>
          إدارة المستخدمين والأدوار والصلاحيات المخصصة متاحة لـ <strong>مدير النظام</strong> فقط (مطابقة لسياسات قاعدة البيانات).
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        جاري تحميل المستخدمين والصلاحيات...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg' : 'text-xl'} font-bold flex items-center gap-2`}>
            <Shield size={18} className="me-1" />
            المستخدمون والصلاحيات
          </h2>
          <p className="text-sm text-muted-foreground">
            تعيين أدوار المستخدمين، ثم صلاحيات كل صفحة (عرض / تعديل / حذف) عند الحاجة لتجاوز افتراضات الدور.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void refetchUsersData()}>
          <RefreshCw size={14} className="me-1" />
          تحديث
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users">المستخدمين</TabsTrigger>
          <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3 text-sm">
              إجمالي المستخدمين: <span className="font-bold">{totals.total}</span>
            </div>
            <div className="rounded-lg border bg-card p-3 text-sm">
              النشطين: <span className="font-bold">{totals.active}</span>
            </div>
            <div className="rounded-lg border bg-card p-3 text-sm">
              نتيجة الفلاتر: <span className="font-bold">{filteredUsers.length}</span>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="بحث باسم المستخدم..."
                className="h-9"
              />
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | AppRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="كل الأدوار" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأدوار</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS_AR[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as 'all' | 'active' | 'inactive')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">موقوف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-center">الاسم</th>
                  <th className="px-3 py-2 text-center">الحالة</th>
                  <th className="px-3 py-2 text-center">الدور</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.isActive ? 'نشط' : 'موقوف'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.role}
                          onValueChange={(value) => updateRole(row.id, value as AppRole)}
                          disabled={!canEdit || savingId === row.id}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="اختر الدور" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS_AR[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {savingId === row.id && <Save size={14} className="animate-pulse text-muted-foreground" />}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      لا توجد نتائج مطابقة للفلاتر.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          {canEdit && rows.length > 0 ? (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">صلاحيات الصفحات (مخصصة للمستخدم)</h3>
                  <p className="text-xs text-muted-foreground">
                    الأسماء أدناه هي صفحات النظام الفعلية. عند المطابقة مع افتراضات الدور لا تُخزّن صفوف إضافية في قاعدة البيانات.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2" dir="rtl">
                  <Select value={permUserId ?? ''} onValueChange={(v) => setPermUserId(v)}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="اختر مستخدماً" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} — {ROLE_LABELS_AR[r.role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void saveMatrix()}
                    disabled={savingMatrix || matrixLoading || !selectedUser}
                  >
                    {savingMatrix ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                  </Button>
                </div>
              </div>

              {matrixLoading ? (
                <p className="text-sm text-muted-foreground py-4">جاري تحميل الصلاحيات...</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-start w-[40%]">الصفحة</th>
                        <th className="px-3 py-2 text-center">عرض</th>
                        <th className="px-3 py-2 text-center">تعديل</th>
                        <th className="px-3 py-2 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_PAGE_ENTRIES.map(({ key, labelAr }) => {
                        const m = matrix[key];
                        if (!m) return null;
                        return (
                          <tr key={key} className="border-t">
                            <td className="px-3 py-2 font-medium">{labelAr}</td>
                            <td className="px-3 py-2 text-center">
                              <Checkbox
                                checked={m.can_view}
                                onCheckedChange={(v) => setCell(key, 'can_view', v === true)}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Checkbox
                                checked={m.can_edit}
                                onCheckedChange={(v) => setCell(key, 'can_edit', v === true)}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Checkbox
                                checked={m.can_delete}
                                onCheckedChange={(v) => setCell(key, 'can_delete', v === true)}
                                disabled={!canEdit}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              لا توجد صلاحيات مخصصة متاحة للعرض حالياً.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsersAndPermissions;
