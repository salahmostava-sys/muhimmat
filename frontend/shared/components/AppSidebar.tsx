import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  ChevronDown, Fuel, Settings2, X, FileWarning,
  Layers, ChevronsLeft, ChevronsRight, ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useLanguage } from '@app/providers/LanguageContext';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { useMobileSidebar } from '@app/providers/MobileSidebarContext';
import { cn } from '@shared/lib/utils';
import { routesManifest, routeGroupTitleAr, toPagePermissionKey, type RouteGroup } from '@app/routesManifest';
import { useAuth } from '@app/providers/AuthContext';
import { DEFAULT_PERMISSIONS, type AppRole } from '@shared/hooks/usePermissions';

const iconByRouteId: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  dashboard: LayoutDashboard,
  employees: Users,
  attendance: Clock,
  alerts: Bell,
  apps: Smartphone,
  salaries: Wallet,
  advances: CreditCard,
  orders: Package,
  motorcycles: Bike,
  vehicle_assignment: FileDown,
  fuel: Fuel,
  violation_resolver: FileWarning,
  employee_tiers: Layers,
  platform_accounts: ShieldCheck,
  settings: Settings2,
};

function setHoverStylesIf(
  el: HTMLElement,
  shouldApply: boolean,
  enter: boolean
) {
  if (!shouldApply) return;
  el.style.background = enter ? 'var(--ds-surface-container)' : 'transparent';
  el.style.color = enter ? 'var(--ds-on-surface)' : 'var(--ds-on-surface-variant)';
}

const AppSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isRTL } = useLanguage();
  const { role } = useAuth();
  const { projectName, projectSubtitle, settings } = useSystemSettings();
  const { isOpen, close } = useMobileSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    hr: true, finance: false, operations: false, settings: false,
  });
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const isActive = useCallback((path: string) => {
    const [pathPart, queryPart] = path.split('?');
    if (pathPart !== location.pathname) return false;
    if (!queryPart) return true;
    const params = new URLSearchParams(queryPart);
    const locationParams = new URLSearchParams(location.search);
    for (const [key, value] of params.entries()) {
      if (locationParams.get(key) !== value) return false;
    }
    return true;
  }, [location.pathname, location.search]);

  const canViewRoute = useCallback((permission?: string) => {
    const pageKey = toPagePermissionKey(permission);
    if (!pageKey) return true;
    if (role === 'admin') return true;
    if (!role) return false;
    const defaults = DEFAULT_PERMISSIONS[role as AppRole] ?? DEFAULT_PERMISSIONS.viewer;
    return defaults[pageKey]?.can_view ?? false;
  }, [role]);

  const navGroups = useMemo(() => {
    const groupsOrder: RouteGroup[] = ['hr', 'finance', 'operations', 'system'];
    return groupsOrder.map((groupKey) => {
      const items = routesManifest
        .filter((route) => route.group === groupKey && route.sidebar && route.id !== 'dashboard')
        .filter((route) => canViewRoute(route.permission))
        .map((route) => ({
          label: route.titleAr,
          icon: iconByRouteId[route.id] ?? LayoutDashboard,
          path: route.path,
        }));
      return {
        key: groupKey,
        sectionLabel: routeGroupTitleAr[groupKey],
        items,
      };
    }).filter((group) => group.items.length > 0);
  }, [canViewRoute]);

  useEffect(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => isActive(i.path)));
    if (activeGroup && !openGroups[activeGroup.key]) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.key]: true }));
    }
  }, [location.pathname, isActive, navGroups, openGroups]);

  const mobileTranslateClass = (
    {
      rtl: {
        true: 'translate-x-0',
        false: 'translate-x-full',
      },
      ltr: {
        true: 'translate-x-0',
        false: '-translate-x-full',
      },
    } as const
  )[isRTL ? 'rtl' : 'ltr'][isOpen ? 'true' : 'false'] as string;

  const CollapseChevronIcon = (
    {
      true: {
        rtl: ChevronsLeft,
        ltr: ChevronsRight,
      },
      false: {
        rtl: ChevronsRight,
        ltr: ChevronsLeft,
      },
    } as const
  )[collapsed ? 'true' : 'false'][isRTL ? 'rtl' : 'ltr'];

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 h-screen flex flex-col z-50',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[64px]' : 'w-[260px]',
          mobileTranslateClass,
          isRTL ? 'right-0' : 'left-0',
          'lg:translate-x-0',
        )}
        style={{
          background: 'var(--ds-surface-low)',
          boxShadow: '4px 0 24px rgba(26,28,29,0.06)',
        }}
      >

        {/* ── Logo / Brand ───────────────────────────────────── */}
        <div className={cn(
          'h-[70px] flex items-center justify-between flex-shrink-0',
          collapsed ? 'px-3 justify-center' : 'px-5',
        )}>
          <Link to="/" className="flex items-center gap-3 min-w-0">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt="logo"
                className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow-brand-sm"
                style={{ background: 'linear-gradient(135deg, #2642e6, #465fff)' }}
              >
                🚀
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <span
                  className="text-sm font-bold leading-tight block truncate"
                  style={{ color: 'var(--ds-on-surface)' }}
                >
                  {projectName}
                </span>
                {projectSubtitle && (
                  <span
                    className="text-[11px] block truncate leading-tight mt-0.5"
                    style={{ color: 'var(--ds-on-surface-variant)' }}
                  >
                    {projectSubtitle}
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* Mobile close */}
          {!collapsed && (
            <button
              onClick={close}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ color: 'var(--ds-on-surface-variant)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-surface-container)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────── */}
        <nav className={cn('flex-1 overflow-y-auto py-3 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>

          {/* Dashboard */}
          <Link
            to="/"
            title={collapsed ? routeGroupTitleAr.dashboard : undefined}
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all duration-150 overflow-hidden',
              collapsed && 'justify-center px-0',
            )}
            style={
              isActive('/')
                ? {
                    background: 'linear-gradient(135deg, #2642e6 0%, #465fff 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(38,66,230,0.25)',
                  }
                : { color: 'var(--ds-on-surface-variant)' }
            }
            onMouseEnter={e => {
              setHoverStylesIf(e.currentTarget, !isActive('/'), true);
            }}
            onMouseLeave={e => {
              setHoverStylesIf(e.currentTarget, !isActive('/'), false);
            }}
          >
            {/* Active bar indicator */}
            {isActive('/') && !collapsed && (
              <span
                className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-white/60"
                style={{ [isRTL ? 'right' : 'left']: '-2px' }}
              />
            )}
            <LayoutDashboard size={17} className="flex-shrink-0" />
            {!collapsed && <span>{routeGroupTitleAr.dashboard}</span>}
          </Link>

          {/* Grouped nav items */}
          {navGroups.map(group => {
            const isGroupOpen = openGroups[group.key];
            return (
              <div key={group.key}>
                {/* Section label */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 mt-3 rounded-lg transition-colors group"
                    style={{ color: 'var(--ds-on-surface-variant)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-surface-container)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="text-[13px] font-semibold uppercase tracking-wider">
                      {group.sectionLabel}
                    </span>
                    <ChevronDown
                      size={13}
                      className={cn(
                        'transition-transform duration-200',
                        isGroupOpen ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>
                )}

                {(collapsed || isGroupOpen) && (
                  <div className={cn('space-y-0.5', !collapsed && 'mt-0.5')}>
                    {group.items.map(item => {
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 overflow-hidden',
                            collapsed && 'justify-center px-0',
                          )}
                          style={
                            active
                              ? {
                                  background: 'linear-gradient(135deg, #2642e6 0%, #465fff 100%)',
                                  color: '#ffffff',
                                  fontWeight: 600,
                                  boxShadow: '0 4px 14px rgba(38,66,230,0.25)',
                                }
                              : { color: 'var(--ds-on-surface-variant)', fontWeight: 400 }
                          }
                          onMouseEnter={e => {
                            setHoverStylesIf(e.currentTarget, !active, true);
                          }}
                          onMouseLeave={e => {
                            setHoverStylesIf(e.currentTarget, !active, false);
                          }}
                          onClick={close}
                        >
                          {/* Active bar indicator */}
                          {active && !collapsed && (
                            <span
                              className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-white/60"
                              style={{ [isRTL ? 'right' : 'left']: '-2px' }}
                            />
                          )}
                          <item.icon size={16} className="flex-shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Collapse toggle — desktop only ────────────────── */}
        <div
          className="hidden lg:flex px-3 py-3 flex-shrink-0 justify-end"
          style={{ borderTop: '1px solid var(--ds-surface-container)' }}
        >
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--ds-on-surface-variant)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-surface-container)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <CollapseChevronIcon size={16} />
          </button>
        </div>

      </aside>
    </>
  );
};

export default AppSidebar;
