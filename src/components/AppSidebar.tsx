import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Settings, Map, ChevronDown, ChevronUp, Fuel, Settings2, X,
} from 'lucide-react';
import { useState } from 'react';
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

  // Group accent colors
  const groupColors: Record<string, { bg: string; text: string; dot: string }> = {
    hr:         { bg: 'bg-brand-500/15', text: 'text-brand-400', dot: 'bg-brand-400' },
    finance:    { bg: 'bg-success/15',   text: 'text-success',   dot: 'bg-success' },
    operations: { bg: 'bg-warning/15',   text: 'text-warning',   dot: 'bg-warning' },
    settings:   { bg: 'bg-muted/40',     text: 'text-sidebar-muted', dot: 'bg-sidebar-muted' },
  };

  const navGroups = [
    {
      key: 'hr',
      label: t('hr'),
      icon: '👥',
      items: [
        { label: t('employees'), icon: Users, path: '/employees' },
        { label: t('attendance'), icon: Clock, path: '/attendance' },
        { label: t('apps'), icon: Smartphone, path: '/apps' },
        { label: t('alerts'), icon: Bell, path: '/alerts' },
      ],
    },
    {
      key: 'finance',
      label: t('finance'),
      icon: '💰',
      items: [
        { label: t('payroll'), icon: Wallet, path: '/salaries' },
        { label: t('advances'), icon: CreditCard, path: '/advances' },
        { label: t('deductions'), icon: FileDown, path: '/deductions' },
      ],
    },
    {
      key: 'operations',
      label: t('operations'),
      icon: '⚙️',
      items: [
        { label: t('orders'), icon: Package, path: '/orders' },
        { label: t('vehicles'), icon: Bike, path: '/vehicles' },
        { label: t('vehicleTracking'), icon: Map, path: '/vehicle-tracking' },
        { label: t('fuel'), icon: Fuel, path: '/fuel' },
      ],
    },
    {
      key: 'settings',
      label: t('settings'),
      icon: '🔧',
      items: [
        { label: t('schemes'), icon: Settings, path: '/settings/schemes' },
        { label: t('users'), icon: Users, path: '/settings/users' },
        { label: t('permissions'), icon: Settings, path: '/settings/permissions' },
        { label: t('generalSettings'), icon: Settings2, path: '/settings/general' },
      ],
    },
  ];

  // auto-open group containing active route
  const activeGroup = navGroups.find(g => g.items.some(i => isActive(i.path)));
  if (activeGroup && !openGroups[activeGroup.key]) {
    setOpenGroups(prev => ({ ...prev, [activeGroup.key]: true }));
  }

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        'fixed top-0 h-screen w-64 flex flex-col z-50 overflow-hidden',
        'bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]',
        'transition-transform duration-300 ease-in-out',
        isRTL
          ? 'right-0 border-l border-[hsl(var(--sidebar-border))]'
          : 'left-0 border-r border-[hsl(var(--sidebar-border))]',
        isRTL
          ? (isOpen ? 'translate-x-0' : 'translate-x-full')
          : (isOpen ? 'translate-x-0' : '-translate-x-full'),
        'lg:translate-x-0',
      )}>
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-[hsl(var(--sidebar-border))] flex-shrink-0">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 min-w-0">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="logo"
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-brand-sm"
                  style={{ background: 'linear-gradient(135deg, #6172F3, #444CE7)' }}
                >
                  🚀
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-[hsl(var(--sidebar-accent-foreground))] leading-tight truncate">
                  {projectName}
                </h1>
                <p className="text-xs text-[hsl(var(--sidebar-muted))] truncate leading-tight mt-0.5">
                  {projectSubtitle}
                </p>
              </div>
            </Link>
            {/* Mobile close */}
            <button
              onClick={close}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--sidebar-accent))/50] text-[hsl(var(--sidebar-muted))] flex-shrink-0 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Dashboard link ───────────────────────────────────── */}
        <div className="px-3 pt-3">
          <Link
            to="/"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold w-full transition-all duration-200',
              isActive('/')
                ? 'text-white shadow-brand-sm'
                : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))/60] hover:text-[hsl(var(--sidebar-accent-foreground))]'
            )}
            style={isActive('/') ? { background: 'linear-gradient(135deg, #6172F3, #444CE7)' } : undefined}
          >
            <LayoutDashboard size={16} />
            <span>{t('dashboard')}</span>
          </Link>
        </div>

        {/* ── Nav Groups ──────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          {navGroups.map(group => {
            const gc = groupColors[group.key];
            const isGroupActive = group.items.some(i => isActive(i.path));
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors hover:bg-[hsl(var(--sidebar-accent))/40] group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0', gc.bg)}>
                      {group.icon}
                    </span>
                    <span className={cn(
                      'text-xs font-semibold uppercase tracking-wider transition-colors',
                      isGroupActive
                        ? 'text-[hsl(var(--sidebar-accent-foreground))]'
                        : 'text-[hsl(var(--sidebar-muted))] group-hover:text-[hsl(var(--sidebar-accent-foreground))]'
                    )}>
                      {group.label}
                    </span>
                  </div>
                  <span className="text-[hsl(var(--sidebar-muted))]">
                    {openGroups[group.key]
                      ? <ChevronUp size={12} />
                      : <ChevronDown size={12} />
                    }
                  </span>
                </button>

                {/* Group items */}
                {openGroups[group.key] && (
                  <div className="mt-0.5 mb-1 space-y-0.5 ps-2">
                    {group.items.map(item => {
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'relative flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-xl text-sm transition-all duration-150',
                            active
                              ? 'sidebar-item-active bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-medium'
                              : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))/60] hover:text-[hsl(var(--sidebar-accent-foreground))]'
                          )}
                        >
                          <span className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                            active ? `${gc.bg} ${gc.text}` : 'bg-[hsl(var(--sidebar-accent))/50] text-[hsl(var(--sidebar-muted))]'
                          )}>
                            <item.icon size={14} />
                          </span>
                          <span>{item.label}</span>
                          {active && (
                            <span className={cn('w-1.5 h-1.5 rounded-full ms-auto flex-shrink-0', gc.dot)} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer / User ───────────────────────────────────── */}
        <div className="p-3 border-t border-[hsl(var(--sidebar-border))] flex-shrink-0">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-3 rounded-xl p-2.5 hover:bg-[hsl(var(--sidebar-accent))/50] transition-colors text-start group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 transition-all group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #6172F3, #444CE7)' }}
            >
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[hsl(var(--sidebar-accent-foreground))] truncate">
                {user?.email}
              </p>
              <p className="text-[10px] text-[hsl(var(--sidebar-muted))]">{t('systemAdmin')}</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" title="Online" />
          </button>
        </div>

        {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
      </aside>
    </>
  );
};

export default AppSidebar;
