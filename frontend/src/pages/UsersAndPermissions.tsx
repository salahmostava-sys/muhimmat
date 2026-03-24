import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { userPermissionService } from '@/services/userPermissionService';
import { useAuth } from '@/context/AuthContext';
import { usePermissions, DEFAULT_PERMISSIONS, type AppRole, type PagePermission } from '@/hooks/usePermissions';
import { PERMISSION_PAGE_ENTRIES } from '@/constants/permissionPages';

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
  const { permissions: settingsPerm } = usePermissions('settings');

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Record<string, PagePermission>>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);

  const isAdmin = authRole === 'admin';
  const canEdit = settingsPerm.can_edit && isAdmin;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
        userPermissionService.getProfiles(),
        userPermissionService.getUserRoles(),
      ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const roleMap: Record<string, AppRole> = {};
      (roles || []).forEach((r) => {
        roleMap[r.user_id] = (r.role as AppRole) || 'viewer';
      });

      const built: UserRow[] = ((profiles || []) as ProfileRow[]).map((p) => ({
        id: p.id,
        name: p.name || 'بدون اسم',
        isActive: p.is_active ?? true,
        role: roleMap[p.id] || 'viewer',
      }));

      setRows(built);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل بيانات المستخدمين والصلاحيات';
      toast({
        title: 'خطأ في تحميل المستخدمين',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const selectedUser = useMemo(() => rows.find((r) => r.id === permUserId) ?? null, [rows, permUserId]);

  const loadMatrix = useCallback(async (userId: string, role: AppRole) => {
    if (!isAdmin) return;
    setMatrixLoading(true);
    try {
      const { data, error } = await userPermissionService.getUserPermissions(userId);
      if (error) throw error;
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

  const updateRole = async (userId: string, role: AppRole) => {
    if (!canEdit) return;
    setSavingId(userId);
    try {
      const { error } = await userPermissionService.upsertRole(userId, role);
      if (error) throw error;

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
          const { error } = await userPermissionService.deletePermission(selectedUser.id, key);
          if (error) throw error;
        } else {
          const { error } = await userPermissionService.upsertPermission(selectedUser.id, key, cur);
          if (error) throw error;
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg' : 'text-xl'} font-bold flex items-center gap-2`}>
            <Shield size={18} />
            المستخدمون والصلاحيات
          </h2>
          <p className="text-sm text-muted-foreground">
            تعيين أدوار المستخدمين، ثم صلاحيات كل صفحة (عرض / تعديل / حذف) عند الحاجة لتجاوز افتراضات الدور.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void fetchData()}>
          <RefreshCw size={14} />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3 text-sm">
          إجمالي المستخدمين: <span className="font-bold">{totals.total}</span>
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm">
          النشطين: <span className="font-bold">{totals.active}</span>
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
            {rows.map((row) => (
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  لا يوجد مستخدمون لعرضهم.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && rows.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">صلاحيات الصفحات (مخصصة للمستخدم)</h3>
              <p className="text-xs text-muted-foreground">
                الأسماء أدناه هي صفحات النظام الفعلية. عند المطابقة مع افتراضات الدور لا تُخزّن صفوف إضافية في قاعدة البيانات.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                    <th className="px-3 py-2 text-right w-[40%]">الصفحة</th>
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
      )}
    </div>
  );
};

export default UsersAndPermissions;
