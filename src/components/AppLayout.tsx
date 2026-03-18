import { ReactNode, useEffect, useState } from 'react';
import AppSidebar from './AppSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useMobileSidebar, MobileSidebarProvider } from '@/context/MobileSidebarContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Sun, Moon, Menu, ChevronLeft, ChevronRight, LogOut, Settings, User, ChevronDown } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearch from '@/components/GlobalSearch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface AppLayoutProps {
  children: ReactNode;
}

const routeTitles: Record<string, string> = {
  '/': 'dashboard',
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
  admin: 'text-red-600 dark:text-red-400',
  hr: 'text-blue-600 dark:text-blue-400',
  finance: 'text-green-600 dark:text-green-400',
  operations: 'text-orange-600 dark:text-orange-400',
  viewer: 'text-muted-foreground',
};

const AppLayoutInner = ({ children }: AppLayoutProps) => {
  const { lang, toggleLang, isRTL } = useLanguage();
  const { signOut, role, user } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { projectName } = useSystemSettings();
  const { toggle } = useMobileSidebar();
  const { t } = useTranslation();
  const location = useLocation();
  const [profileName, setProfileName] = useState<string | null>(null);

  const pageKey = routeTitles[location.pathname] || 'dashboard';
  const pageTitle = t(pageKey);

  useEffect(() => {
    document.title = `${projectName} | ${pageTitle}`;
  }, [location.pathname, projectName, pageTitle]);

  // Fetch profile name
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
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <AppSidebar />

      <main className={cn(
        'min-h-screen flex flex-col transition-all duration-300 h-screen',
        isRTL ? 'lg:mr-[260px]' : 'lg:ml-[260px]'
      )}>
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="h-[70px] bg-[hsl(var(--card))] border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">

          {/* Start: hamburger + breadcrumb */}
          <div className="flex items-center gap-2 lg:gap-4">
            <button
              onClick={toggle}
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>

            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-foreground/70 font-medium">{projectName}</span>
              <Sep size={12} className="opacity-40" />
              <span className="font-semibold text-foreground">{pageTitle}</span>
            </div>
          </div>

          {/* End: tools + user profile */}
          <div className="flex items-center gap-1 lg:gap-1.5">
            {/* Global search */}
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>

            {/* Notifications */}
            <NotificationCenter />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark
                ? <Sun size={15} className="text-warning" />
                : <Moon size={15} />
              }
            </button>

            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="text-xs font-medium h-8 px-2 lg:px-3 gap-1 border-border"
            >
              <Languages size={13} />
              <span className="hidden sm:inline">{lang === 'ar' ? 'English' : 'عربي'}</span>
              <span className="sm:hidden">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </Button>

            {/* ── User profile chip ─────────────────────────── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 h-9 px-2 rounded-xl hover:bg-muted transition-colors border border-border/60 hover:border-border ml-1">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  {/* Name + role — hidden on small screens */}
                  <div className={`hidden md:flex flex-col items-${isRTL ? 'end' : 'start'} leading-none`}>
                    <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{displayName}</span>
                    {roleLabel && (
                      <span className={`text-[10px] font-medium ${roleColor}`}>{roleLabel}</span>
                    )}
                  </div>
                  <ChevronDown size={12} className="text-muted-foreground hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
                {/* Profile header */}
                <div className="px-3 py-2.5 border-b border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{displayEmail}</p>
                      {roleLabel && (
                        <span className={`text-[10px] font-semibold ${roleColor}`}>{roleLabel}</span>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.location.href = '/settings/users'}>
                  <User size={14} />
                  <span>{isRTL ? 'إعدادات الحساب' : 'Account Settings'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.location.href = '/settings/general'}>
                  <Settings size={14} />
                  <span>{isRTL ? 'إعدادات النظام' : 'System Settings'}</span>
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

        {/* ── Page content ───────────────────────────────────── */}
        <div className="flex-1 p-4 sm:p-5 lg:p-6 xl:p-8 min-h-0 flex flex-col">
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
