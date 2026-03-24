import { ReactNode, useEffect, useState } from 'react';
import AppSidebar from './AppSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useMobileSidebar, MobileSidebarProvider } from '@/context/MobileSidebarContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Menu, ChevronLeft, ChevronRight, LogOut, Settings, User, ChevronDown } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearch from '@/components/GlobalSearch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface AppLayoutProps {
  children: ReactNode;
}

const routeTitles: Record<string, string> = {
  '/': 'dashboard',
  '/settings': 'settings',
  '/employees': 'employees',
  '/departments': 'departments',
  '/positions': 'positions',
  '/attendance': 'attendance',
  '/orders': 'orders',
  '/salaries': 'payroll',
  '/advances': 'advances',
  '/motorcycles': 'vehicles',
  '/vehicle-assignment': 'vehicleAssignment',
  '/fuel': 'fuel',
  '/apps': 'apps',
  '/alerts': 'alerts',
  '/reports': 'reports',
  '/analytics': 'analytics',
  '/violation-resolver': 'violationResolver',
  '/activity-log': 'activityLog',
  '/settings/schemes': 'schemes',
  '/settings/users': 'users',
  '/settings/general': 'generalSettings',
};

const roleLabelsMap: Record<string, string> = {
  admin: 'مدير النظام', hr: 'موارد بشرية', finance: 'مالية',
  operations: 'عمليات', viewer: 'عارض',
};
const roleColors: Record<string, string> = {
  admin: 'text-red-600',
  hr: 'text-blue-600',
  finance: 'text-emerald-600',
  operations: 'text-orange-600',
  viewer: 'text-muted-foreground',
};

const AppLayoutInner = ({ children }: AppLayoutProps) => {
  const { isRTL } = useLanguage();
  const { signOut, role, user } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { projectName } = useSystemSettings();
  const { toggle } = useMobileSidebar();
  const { t } = useTranslation();
  const location = useLocation();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  useEffect(() => {
    const onStorage = () => setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
    globalThis.addEventListener('storage', onStorage);
    const id = setInterval(onStorage, 200);
    return () => { globalThis.removeEventListener('storage', onStorage); clearInterval(id); };
  }, []);

  const pageKey = routeTitles[location.pathname] || 'dashboard';
  const pageTitle = t(pageKey);

  useEffect(() => {
    document.title = `${projectName} | ${pageTitle}`;
  }, [location.pathname, projectName, pageTitle]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.name) setProfileName(data.name); });
  }, [user?.id]);

  const Sep = isRTL ? ChevronLeft : ChevronRight;
  const displayEmail = user?.email || '';
  const displayName = profileName || displayEmail.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();
  const roleLabel = role ? roleLabelsMap[role] || role : '';
  const roleColor = role ? roleColors[role] || 'text-muted-foreground' : '';

  return (
    <div
      className="min-h-screen"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: 'var(--ds-surface)' }}
    >
      <AppSidebar />

      <main className={cn(
        'flex flex-col transition-all duration-300',
        'h-screen overflow-hidden',
        isRTL
          ? (sidebarCollapsed ? 'lg:mr-[64px]' : 'lg:mr-[260px]')
          : (sidebarCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[260px]')
      )}>

        {/* ── Glass Header ─────────────────────────────────── */}
        <header
          className="h-[70px] flex items-center justify-between gap-2 px-4 lg:px-6 sticky top-0 z-40"
          style={{
            background: 'var(--header-glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--ds-outline-variant)',
          }}
        >

          {/* أدوات البحث والإشعارات — في RTL تظهر يمين الشاشة */}
          <div className="flex items-center gap-1 lg:gap-1.5 min-w-0 flex-shrink">
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>

            <NotificationCenter />

            <button
              onClick={toggleTheme}
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--ds-on-surface-variant)' }}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark
                ? <Sun size={15} className="text-warning" />
                : <Moon size={15} />
              }
            </button>
          </div>

          {/* الملف الشخصي + خروج + مسار الصفحة — في RTL تظهر يسار الشاشة (أعلى اليسار) */}
          <div className="flex items-center gap-2 lg:gap-4 min-w-0 justify-end">
            <div className="hidden md:flex items-center gap-1.5 text-xs min-w-0" style={{ color: 'var(--ds-on-surface-variant)' }}>
              <span className="font-medium truncate" style={{ color: 'var(--ds-on-surface-variant)' }}>{projectName}</span>
              <Sep size={12} className="opacity-40 flex-shrink-0" />
              <span className="font-semibold truncate" style={{ color: 'var(--ds-on-surface)' }}>{pageTitle}</span>
            </div>

            <button
              type="button"
              onClick={toggle}
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--ds-on-surface-variant)' }}
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 h-9 ps-2 pe-2.5 rounded-xl transition-colors border border-transparent hover:border-[var(--ds-outline-variant)]"
                  style={{ background: 'var(--ds-surface-container)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2642e6, #465fff)' }}
                  >
                    {initials || 'A'}
                  </div>
                  <div className={`hidden sm:flex flex-col items-${isRTL ? 'end' : 'start'} leading-none text-start`}>
                    <span className="text-xs font-semibold truncate max-w-[100px] lg:max-w-[140px]" style={{ color: 'var(--ds-on-surface)' }}>
                      {displayName || t('systemAdmin')}
                    </span>
                    {roleLabel && (
                      <span className={`text-[10px] font-medium ${roleColor}`}>{roleLabel}</span>
                    )}
                  </div>
                  <ChevronDown size={12} className="hidden sm:block flex-shrink-0" style={{ color: 'var(--ds-on-surface-variant)' }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" sideOffset={6}>
                <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--ds-on-surface)' }}>
                        {displayName}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--ds-on-surface-variant)' }}>
                        {displayEmail}
                      </p>
                      {roleLabel && (
                        <span className={`text-[10px] font-semibold ${roleColor}`}>{roleLabel}</span>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => globalThis.location.assign('/settings?tab=profile')}>
                  <User size={14} />
                  <span>الملف الشخصي</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => globalThis.location.assign('/settings')}>
                  <Settings size={14} />
                  <span>إعدادات النظام</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={signOut}>
                  <LogOut size={14} />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────── */}
        <div
          className="flex-1 overflow-auto p-4 sm:p-5 lg:p-6 xl:p-8 min-h-0 flex flex-col"
          style={{ background: 'var(--ds-surface)' }}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

const AppLayout = ({ children }: AppLayoutProps) => (
  <MobileSidebarProvider>
    <AppLayoutInner>{children}</AppLayoutInner>
  </MobileSidebarProvider>
);

export default AppLayout;
