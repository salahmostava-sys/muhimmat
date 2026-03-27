export type RouteGroup = 'dashboard' | 'hr' | 'finance' | 'operations' | 'system';

export type AppRouteManifestItem = {
  id: string;
  titleAr: string;
  group: RouteGroup;
  path: string;
  permission?: string;
  public?: boolean;
  sidebar?: boolean;
};

export const routesManifest: AppRouteManifestItem[] = [
  { id: 'dashboard', titleAr: 'لوحة التحكم', group: 'dashboard', path: '/', sidebar: true },

  { id: 'employees', titleAr: 'الموظفون', group: 'hr', path: '/employees', permission: 'employees', sidebar: true },
  { id: 'attendance', titleAr: 'الحضور والانصراف', group: 'hr', path: '/attendance', permission: 'attendance', sidebar: true },
  { id: 'alerts', titleAr: 'التنبيهات', group: 'hr', path: '/alerts', permission: 'alerts', sidebar: true },
  { id: 'apps', titleAr: 'التطبيقات', group: 'hr', path: '/apps', permission: 'apps', sidebar: true },

  { id: 'salaries', titleAr: 'الرواتب', group: 'finance', path: '/salaries', permission: 'salaries', sidebar: true },
  { id: 'advances', titleAr: 'السلف', group: 'finance', path: '/advances', permission: 'advances', sidebar: true },

  { id: 'orders', titleAr: 'الطلبات', group: 'operations', path: '/orders', permission: 'orders', sidebar: true },
  { id: 'motorcycles', titleAr: 'المركبات', group: 'operations', path: '/motorcycles', permission: 'vehicles', sidebar: true },
  { id: 'vehicle_assignment', titleAr: 'توزيع المركبات', group: 'operations', path: '/vehicle-assignment', permission: 'vehicle_assignment', sidebar: true },
  { id: 'fuel', titleAr: 'البنزين', group: 'operations', path: '/fuel', permission: 'fuel', sidebar: true },
  { id: 'violation_resolver', titleAr: 'تسوية المخالفات', group: 'operations', path: '/violation-resolver', permission: 'violation_resolver', sidebar: true },
  { id: 'employee_tiers', titleAr: 'شرائح الشركة', group: 'operations', path: '/employee-tiers', permission: 'employee_tiers', sidebar: true },
  { id: 'platform_accounts', titleAr: 'حسابات المنصات', group: 'operations', path: '/platform-accounts', permission: 'platform_accounts', sidebar: true },

  { id: 'settings', titleAr: 'إعدادات النظام', group: 'system', path: '/settings', permission: 'settings', sidebar: true },
  { id: 'profile', titleAr: 'الملف الشخصي', group: 'system', path: '/profile', sidebar: false },
];

export const routeGroupTitleAr: Record<RouteGroup, string> = {
  dashboard: 'لوحة التحكم',
  hr: 'الموارد البشرية',
  finance: 'المالية',
  operations: 'العمليات',
  system: 'النظام',
};

export const getRouteByPathname = (pathname: string) => {
  const exact = routesManifest.find((route) => route.path === pathname);
  if (exact) return exact;

  const byPrefix = routesManifest
    .filter((route) => route.path !== '/' && pathname.startsWith(route.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return byPrefix ?? null;
};

