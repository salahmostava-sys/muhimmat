import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';

type AppRole = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

interface PagePermission {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// Default permissions per role per page
const DEFAULT_PERMISSIONS: Record<AppRole, Record<string, PagePermission>> = {
  admin: {
    employees:          { can_view: true,  can_edit: true,  can_delete: true  },
    attendance:         { can_view: true,  can_edit: true,  can_delete: true  },
    orders:             { can_view: true,  can_edit: true,  can_delete: true  },
    salaries:           { can_view: true,  can_edit: true,  can_delete: true  },
    advances:           { can_view: true,  can_edit: true,  can_delete: true  },
    deductions:         { can_view: true,  can_edit: true,  can_delete: true  },
    vehicles:           { can_view: true,  can_edit: true,  can_delete: true  },
    alerts:             { can_view: true,  can_edit: true,  can_delete: true  },
    settings:           { can_view: true,  can_edit: true,  can_delete: true  },
    apps:               { can_view: true,  can_edit: true,  can_delete: true  },
    platform_accounts:  { can_view: true,  can_edit: true,  can_delete: true  },
    violation_resolver: { can_view: true,  can_edit: true,  can_delete: true  },
    vehicle_assignment: { can_view: true,  can_edit: true,  can_delete: true  },
    fuel:               { can_view: true,  can_edit: true,  can_delete: true  },
    employee_tiers:     { can_view: true,  can_edit: true,  can_delete: true  },
  },
  hr: {
    employees:          { can_view: true,  can_edit: true,  can_delete: false },
    attendance:         { can_view: true,  can_edit: true,  can_delete: false },
    orders:             { can_view: true,  can_edit: false, can_delete: false },
    salaries:           { can_view: true,  can_edit: false, can_delete: false },
    advances:           { can_view: true,  can_edit: false, can_delete: false },
    deductions:         { can_view: false, can_edit: false, can_delete: false },
    vehicles:           { can_view: true,  can_edit: false, can_delete: false },
    alerts:             { can_view: true,  can_edit: true,  can_delete: false },
    settings:           { can_view: false, can_edit: false, can_delete: false },
    apps:               { can_view: true,  can_edit: false, can_delete: false },
    platform_accounts:  { can_view: true,  can_edit: true,  can_delete: false },
    violation_resolver: { can_view: false, can_edit: false, can_delete: false },
    vehicle_assignment: { can_view: true,  can_edit: false, can_delete: false },
    fuel:               { can_view: true,  can_edit: false, can_delete: false },
    employee_tiers:     { can_view: true,  can_edit: true,  can_delete: true  },
  },
  finance: {
    employees:          { can_view: true,  can_edit: false, can_delete: false },
    attendance:         { can_view: true,  can_edit: false, can_delete: false },
    orders:             { can_view: true,  can_edit: false, can_delete: false },
    salaries:           { can_view: true,  can_edit: true,  can_delete: false },
    advances:           { can_view: true,  can_edit: true,  can_delete: false },
    deductions:         { can_view: true,  can_edit: true,  can_delete: false },
    vehicles:           { can_view: false, can_edit: false, can_delete: false },
    alerts:             { can_view: true,  can_edit: false, can_delete: false },
    settings:           { can_view: false, can_edit: false, can_delete: false },
    apps:               { can_view: true,  can_edit: false, can_delete: false },
    platform_accounts:  { can_view: true,  can_edit: false, can_delete: false },
    violation_resolver: { can_view: true,  can_edit: true,  can_delete: true  },
    vehicle_assignment: { can_view: true,  can_edit: false, can_delete: false },
    fuel:               { can_view: true,  can_edit: true,  can_delete: true  },
    employee_tiers:     { can_view: true,  can_edit: false, can_delete: false },
  },
  operations: {
    employees:          { can_view: true,  can_edit: false, can_delete: false },
    attendance:         { can_view: false, can_edit: false, can_delete: false },
    orders:             { can_view: true,  can_edit: true,  can_delete: false },
    salaries:           { can_view: false, can_edit: false, can_delete: false },
    advances:           { can_view: false, can_edit: false, can_delete: false },
    deductions:         { can_view: false, can_edit: false, can_delete: false },
    vehicles:           { can_view: true,  can_edit: true,  can_delete: false },
    alerts:             { can_view: true,  can_edit: false, can_delete: false },
    settings:           { can_view: false, can_edit: false, can_delete: false },
    apps:               { can_view: true,  can_edit: false, can_delete: false },
    platform_accounts:  { can_view: true,  can_edit: false, can_delete: false },
    violation_resolver: { can_view: false, can_edit: false, can_delete: false },
    vehicle_assignment: { can_view: true,  can_edit: false, can_delete: false },
    fuel:               { can_view: true,  can_edit: false, can_delete: false },
    employee_tiers:     { can_view: true,  can_edit: false, can_delete: false },
  },
  viewer: {
    employees:          { can_view: false, can_edit: false, can_delete: false },
    attendance:         { can_view: false, can_edit: false, can_delete: false },
    orders:             { can_view: false, can_edit: false, can_delete: false },
    salaries:           { can_view: false, can_edit: false, can_delete: false },
    advances:           { can_view: false, can_edit: false, can_delete: false },
    deductions:         { can_view: false, can_edit: false, can_delete: false },
    vehicles:           { can_view: false, can_edit: false, can_delete: false },
    alerts:             { can_view: true,  can_edit: false, can_delete: false },
    settings:           { can_view: false, can_edit: false, can_delete: false },
    apps:               { can_view: false, can_edit: false, can_delete: false },
    platform_accounts:  { can_view: false, can_edit: false, can_delete: false },
    violation_resolver: { can_view: false, can_edit: false, can_delete: false },
    vehicle_assignment: { can_view: false, can_edit: false, can_delete: false },
    fuel:               { can_view: false, can_edit: false, can_delete: false },
    employee_tiers:     { can_view: false, can_edit: false, can_delete: false },
  },
};

export const usePermissions = (pageKey: string) => {
  const { user, role, session, loading: authLoading } = useAuth();

  const fallbackPermissions = useMemo<PagePermission>(() => {
    if (!role) return { can_view: false, can_edit: false, can_delete: false };
    const defaults = DEFAULT_PERMISSIONS[role as AppRole] || DEFAULT_PERMISSIONS.viewer;
    return defaults[pageKey] || { can_view: false, can_edit: false, can_delete: false };
  }, [role, pageKey]);

  const query = useQuery({
    queryKey: ['permissions', user?.id ?? null, role ?? null, pageKey] as const,
    enabled: !!session && !!user && !authLoading && !!role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('can_view, can_edit, can_delete')
        .eq('user_id', user!.id)
        .eq('permission_key', pageKey)
        .maybeSingle();

      if (error) throw new Error(error.message || 'تعذر تحميل الصلاحيات');

      if (data) {
        return { can_view: data.can_view, can_edit: data.can_edit, can_delete: data.can_delete } satisfies PagePermission;
      }

      return fallbackPermissions;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const permissions = user && role ? (query.data ?? fallbackPermissions) : { can_view: false, can_edit: false, can_delete: false };
  const loading = user && role ? query.isLoading : false;

  return { permissions, loading, isAdmin: role === 'admin' };
};

export { DEFAULT_PERMISSIONS };
export type { PagePermission, AppRole };
