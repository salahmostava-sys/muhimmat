import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Clock, Package, Wallet, CreditCard,
  Bike, FileDown, Bell, Smartphone,
  Settings, Map, ChevronDown, ChevronUp, Fuel,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import UserProfileModal from '@/components/UserProfileModal';

const AppSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
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
      ],
    },
  ];

  // auto-open group containing active route
  const activeGroup = navGroups.find(g => g.items.some(i => isActive(i.path)));
  if (activeGroup && !openGroups[activeGroup.key]) {
    setOpenGroups(prev => ({ ...prev, [activeGroup.key]: true }));
  }

  return (
    <aside className={cn(
      'fixed top-0 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col z-50',
      isRTL ? 'right-0 border-l border-sidebar-border' : 'left-0 border-r border-sidebar-border'
    )}>
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border flex-shrink-0">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-lg">
            🚀
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-accent-foreground leading-tight">{t('appName')}</h1>
            <p className="text-xs text-sidebar-muted">{t('appSubtitle')}</p>
          </div>
        </Link>
      </div>

      {/* Dashboard link */}
      <div className="px-3 pt-3">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive('/')
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <LayoutDashboard size={16} />
          <span>{t('dashboard')}</span>
        </Link>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {navGroups.map(group => (
          <div key={group.key}>
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wide hover:text-sidebar-accent-foreground transition-colors rounded-lg hover:bg-sidebar-accent/50"
            >
              <span className="flex items-center gap-2">
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </span>
              {openGroups[group.key] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {openGroups[group.key] && (
              <div className="mt-0.5 space-y-0.5 mb-1">
                {group.items.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive(item.path)
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon size={15} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={() => setShowProfile(true)}
          className="w-full flex items-center gap-3 rounded-lg p-1.5 hover:bg-sidebar-accent/50 transition-colors text-start group"
          title="Profile Settings"
        >
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-bold flex-shrink-0 group-hover:ring-2 group-hover:ring-sidebar-primary/50 transition-all">
            {user?.email?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
            <p className="text-xs text-sidebar-muted">{t('systemAdmin')}</p>
          </div>
        </button>
      </div>

      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
    </aside>
  );
};

export default AppSidebar;
