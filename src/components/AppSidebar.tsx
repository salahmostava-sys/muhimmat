import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Settings, ChevronDown, Fuel, Settings2, X, FileWarning, Activity,
  Briefcase, Layers, ChevronsLeft, ChevronsRight,
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

  const isActive = (path: string) => location.pathname === path;

  const navGroups = [
    {
      key: 'hr',
      sectionLabel: t('hr'),
      items: [
        { label: t('employees'), icon: Users, path: '/employees' },
        { label: t('attendance'), icon: Clock, path: '/attendance' },
        { label: t('alerts'), icon: Bell, path: '/alerts' },
        { label: t('apps'), icon: Smartphone, path: '/apps' },
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
        { label: t('schemes'), icon: Settings, path: '/settings/schemes' },
        { label: t('users'), icon: Users, path: '/settings/users' },
        { label: t('generalSettings'), icon: Settings2, path: '/settings/general' },
        { label: isRTL ? 'السجلات التجارية' : 'Trade Registers', icon: Briefcase, path: '/settings/trade-registers' },
        { label: t('activityLog'), icon: Activity, path: '/activity-log' },
      ],
    },
  ];

  // auto-open group containing active route
  useEffect(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => isActive(i.path)));
    if (activeGroup && !openGroups[activeGroup.key]) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.key]: true }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const ChevronIcon = ChevronDown;

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        'fixed top-0 h-screen flex flex-col z-50',
        'bg-[hsl(var(--sidebar-background))] border-[hsl(var(--sidebar-border))]',
        'transition-all duration-300 ease-in-out',
        'shadow-sidebar',
        collapsed ? 'w-[64px]' : 'w-[260px]',
        isRTL
          ? 'right-0 border-l'
          : 'left-0 border-r',
        isRTL
          ? (isOpen ? 'translate-x-0' : 'translate-x-full')
          : (isOpen ? 'translate-x-0' : '-translate-x-full'),
        'lg:translate-x-0',
      )}>

        {/* ── Logo / Brand ─────────────────────────────────────── */}
        <div className={cn(
          'h-[70px] flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] flex-shrink-0',
          collapsed ? 'px-3 justify-center' : 'px-6'
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
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #465FFF, #3347D9)' }}
              >
                🚀
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-sm font-bold text-[hsl(var(--sidebar-accent-foreground))] leading-tight block truncate">
                  {projectName}
                </span>
                {projectSubtitle && (
                  <span className="text-[11px] text-[hsl(var(--sidebar-muted))] block truncate leading-tight mt-0.5">
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
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors flex-shrink-0"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav className={cn('flex-1 overflow-y-auto py-4 space-y-1', collapsed ? 'px-2' : 'px-4')}>

          {/* Dashboard — always visible standalone item */}
          <Link
            to="/"
            title={collapsed ? t('dashboard') : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-150',
              collapsed && 'justify-center px-0',
              isActive('/')
                ? 'bg-primary text-primary-foreground shadow-brand-sm'
                : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
            )}
          >
            <LayoutDashboard size={17} className={isActive('/') ? 'text-white' : 'text-[hsl(var(--sidebar-muted))]'} />
            {!collapsed && <span>{t('dashboard')}</span>}
          </Link>

          {/* Grouped nav items */}
          {navGroups.map(group => {
            const isGroupOpen = openGroups[group.key];
            return (
              <div key={group.key}>
                {/* Section label / collapsible trigger — hidden when collapsed */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 mt-2 rounded-lg transition-colors hover:bg-[hsl(var(--sidebar-accent))] group"
                  >
                    <span className="text-sm font-medium text-[hsl(var(--sidebar-muted))] group-hover:text-[hsl(var(--sidebar-accent-foreground))] transition-colors">
                      {group.sectionLabel}
                    </span>
                    <ChevronIcon
                      size={14}
                      className={cn(
                        'text-[hsl(var(--sidebar-muted))] transition-transform duration-200',
                        isGroupOpen ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                  </button>
                )}

                {/* Items — always show when collapsed (icons only), else respect group open */}
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
                            'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                            collapsed && 'justify-center px-0',
                            active
                              ? 'sidebar-item-active bg-[hsl(var(--sidebar-accent))] text-primary font-semibold'
                              : 'font-normal text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
                          )}
                          onClick={close}
                        >
                          <item.icon
                            size={16}
                            className={cn(
                              'flex-shrink-0 transition-colors',
                              active ? 'text-primary' : 'text-[hsl(var(--sidebar-muted))]'
                            )}
                          />
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

        {/* ── Collapse toggle — desktop only ───────────────────── */}
        <div className="hidden lg:flex px-3 py-2 border-t border-[hsl(var(--sidebar-border))] flex-shrink-0 justify-end">
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] transition-colors"
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
