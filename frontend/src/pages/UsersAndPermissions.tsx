import { useEffect, useMemo, useState } from 'react';
import { Shield, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { userPermissionService } from '@/services/userPermissionService';

type AppRole = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

type ProfileRow = {
  id: string;
  full_name: string | null;
  is_active: boolean | null;
};

type UserRow = {
  id: string;
  name: string;
  isActive: boolean;
  role: AppRole;
};

const ROLES: AppRole[] = ['admin', 'hr', 'finance', 'operations', 'viewer'];

interface UsersAndPermissionsProps {
  embedded?: boolean;
}

const UsersAndPermissions = ({ embedded = false }: UsersAndPermissionsProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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
        name: p.full_name || 'بدون اسم',
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

  const totals = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
    };
  }, [rows]);

  const updateRole = async (userId: string, role: AppRole) => {
    setSavingId(userId);
    try {
      const { error } = await userPermissionService.upsertRole(userId, role);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
      toast({ title: 'تم تحديث الصلاحية' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ';
      toast({
        title: 'فشل تحديث الصلاحية',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        جاري تحميل المستخدمين والصلاحيات...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg' : 'text-xl'} font-bold flex items-center gap-2`}>
            <Shield size={18} />
            المستخدمون والصلاحيات
          </h2>
          <p className="text-sm text-muted-foreground">
            إدارة أدوار المستخدمين داخل النظام.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData}>
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
              <th className="px-3 py-2 text-right">الاسم</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              <th className="px-3 py-2 text-right">الصلاحية</th>
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
                      disabled={savingId === row.id}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="اختر الصلاحية" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
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
    </div>
  );
};

export default UsersAndPermissions;