import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

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
  },
};

export const usePermissions = (pageKey: string) => {
  const { user, role } = useAuth();
  const [permissions, setPermissions] = useState<PagePermission>({ can_view: false, can_edit: false, can_delete: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !role) {
      // No authenticated user — grant full admin access (bypass / dev mode)
      const defaults = DEFAULT_PERMISSIONS['admin'];
      setPermissions(defaults[pageKey] || { can_view: true, can_edit: true, can_delete: true });
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Try to get custom permissions from DB
      const { data } = await supabase
        .from('user_permissions')
        .select('can_view, can_edit, can_delete')
        .eq('user_id', user.id)
        .eq('permission_key', pageKey)
        .maybeSingle();

      if (data) {
        setPermissions({ can_view: data.can_view, can_edit: data.can_edit, can_delete: data.can_delete });
      } else {
        // Fall back to role defaults
        const defaults = DEFAULT_PERMISSIONS[role as AppRole] || DEFAULT_PERMISSIONS.viewer;
        setPermissions(defaults[pageKey] || { can_view: false, can_edit: false, can_delete: false });
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [user, role, pageKey]);

  return { permissions, loading, isAdmin: role === 'admin' || !user };
};

export { DEFAULT_PERMISSIONS };
export type { PagePermission, AppRole };
