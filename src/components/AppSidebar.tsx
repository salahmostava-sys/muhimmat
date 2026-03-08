import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Settings, ChevronDown, Fuel, Settings2, X, TrendingUp, FileWarning,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { cn } from '@/lib/utils';
import UserProfileModal from '@/components/UserProfileModal';

const AppSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { projectName, projectSubtitle, settings } = useSystemSettings();
  const { isOpen, close } = useMobileSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    hr: true, finance: false, operations: false, settings: false,
  });
  const [showProfile, setShowProfile] = useState(false);

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
        { label: t('apps'), icon: Smartphone, path: '/apps' },
        { label: t('alerts'), icon: Bell, path: '/alerts' },
        { label: 'التحليلات', icon: TrendingUp, path: '/analytics' },
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
        { label: 'بيانات المركبات', icon: Bike, path: '/motorcycles' },
        { label: 'تسليم العهد', icon: FileDown, path: '/vehicle-assignment' },
        { label: 'بيانات الاستهلاك', icon: Fuel, path: '/fuel' },
        { label: 'مُحقق المخالفات', icon: FileWarning, path: '/violation-resolver' },
      ],
    },
    {
      key: 'settings',
      sectionLabel: t('settings'),
      items: [
        { label: t('schemes'), icon: Settings, path: '/settings/schemes' },
        { label: 'المستخدمون والصلاحيات', icon: Users, path: '/settings/users' },
        { label: t('generalSettings'), icon: Settings2, path: '/settings/general' },
      ],
    },
  ];

  // auto-open group containing active route — use effect to avoid setState during render
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
        'fixed top-0 h-screen w-[260px] flex flex-col z-50',
        'bg-[hsl(var(--sidebar-background))] border-[hsl(var(--sidebar-border))]',
        'transition-transform duration-300 ease-in-out',
        'shadow-sidebar',
        isRTL
          ? 'right-0 border-l'
          : 'left-0 border-r',
        isRTL
          ? (isOpen ? 'translate-x-0' : 'translate-x-full')
          : (isOpen ? 'translate-x-0' : '-translate-x-full'),
        'lg:translate-x-0',
      )}>

        {/* ── Logo / Brand ─────────────────────────────────────── */}
        <div className="h-[70px] px-6 flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] flex-shrink-0">
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
          </Link>

          {/* Mobile close */}
          <button
            onClick={close}
            className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-accent))] transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">

          {/* Dashboard — always visible standalone item */}
          <Link
            to="/"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-150',
              isActive('/')
                ? 'bg-primary text-primary-foreground shadow-brand-sm'
                : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'
            )}
          >
            <LayoutDashboard size={17} className={isActive('/') ? 'text-white' : 'text-[hsl(var(--sidebar-muted))]'} />
            <span>{t('dashboard')}</span>
          </Link>

          {/* Grouped nav items */}
          {navGroups.map(group => {
            const isGroupOpen = openGroups[group.key];
            return (
              <div key={group.key}>
                {/* Section label / collapsible trigger */}
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

                {/* Items */}
                {isGroupOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map(item => {
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
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
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer / User ────────────────────────────────────── */}
        <div className="p-4 border-t border-[hsl(var(--sidebar-border))] flex-shrink-0">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-3 rounded-xl p-2.5 hover:bg-[hsl(var(--sidebar-accent))] transition-colors text-start group"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #465FFF, #3347D9)' }}
            >
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[hsl(var(--sidebar-accent-foreground))] truncate">
                {user?.email}
              </p>
              <p className="text-[10px] text-[hsl(var(--sidebar-muted))] mt-0.5">{t('systemAdmin')}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" title="Online" />
          </button>
        </div>

        {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
      </aside>
    </>
  );
};

export default AppSidebar;
