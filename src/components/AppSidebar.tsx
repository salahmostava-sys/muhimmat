import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Settings, ChevronDown, Fuel, Settings2, X, FileWarning, Activity,
  Layers, ChevronsLeft, ChevronsRight, ShieldCheck,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { cn } from '@/lib/utils';

const AppSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isRTL } = useLanguage();
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

  const isActive = (path: string) => {
    const [pathPart, queryPart] = path.split('?');
    if (pathPart !== location.pathname) return false;
    if (!queryPart) return true;
    const params = new URLSearchParams(queryPart);
    const locationParams = new URLSearchParams(location.search);
    for (const [key, value] of params.entries()) {
      if (locationParams.get(key) !== value) return false;
    }
    return true;
  };

  const navGroups = [
    {
      key: 'hr',
      sectionLabel: t('hr'),
      items: [
        { label: t('employees'), icon: Users, path: '/employees' },
        { label: t('attendance'), icon: Clock, path: '/attendance' },
        { label: t('alerts'), icon: Bell, path: '/alerts' },
        { label: t('apps'), icon: Smartphone, path: '/apps' },
        { label: 'حسابات المنصات', icon: ShieldCheck, path: '/platform-accounts' },
      ],
    },
    {
      key: 'finance',
      sectionLabel: t('finance'),
      items: [
        { label: t('payroll'), icon: Wallet, path: '/salaries' },
        { label: t('advances'), icon: CreditCard, path: '/advances' },
      ],
    },
    {
      key: 'operations',
      sectionLabel: t('operations'),
      items: [
        { label: t('orders'), icon: Package, path: '/orders' },
        { label: t('vehicles'), icon: Bike, path: '/motorcycles' },
        { label: t('vehicleAssignment'), icon: FileDown, path: '/vehicle-assignment' },
        { label: t('fuel'), icon: Fuel, path: '/fuel' },
        { label: t('violationResolver'), icon: FileWarning, path: '/violation-resolver' },
        { label: 'شرائح الشركة', icon: Layers, path: '/employee-tiers' },
      ],
    },
    {
      key: 'settings',
      sectionLabel: t('settings'),
      items: [
        { label: t('settings'), icon: Settings2, path: '/settings' },
      ],
    },
  ];

  useEffect(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => isActive(i.path)));
    if (activeGroup && !openGroups[activeGroup.key]) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.key]: true }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
          isRTL
            ? (isOpen ? 'translate-x-0' : 'translate-x-full')
            : (isOpen ? 'translate-x-0' : '-translate-x-full'),
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
            title={collapsed ? t('dashboard') : undefined}
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
              if (!isActive('/')) {
                e.currentTarget.style.background = 'var(--ds-surface-container)';
                e.currentTarget.style.color = 'var(--ds-on-surface)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive('/')) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--ds-on-surface-variant)';
              }
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
            {!collapsed && <span>{t('dashboard')}</span>}
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
                            if (!active) {
                              e.currentTarget.style.background = 'var(--ds-surface-container)';
                              e.currentTarget.style.color = 'var(--ds-on-surface)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--ds-on-surface-variant)';
                            }
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
            {collapsed
              ? (isRTL ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />)
              : (isRTL ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />)
            }
          </button>
        </div>

      </aside>
    </>
  );
};

export default AppSidebar;
