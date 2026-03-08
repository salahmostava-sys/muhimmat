import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut, Languages, Sun, Moon } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearch from '@/components/GlobalSearch';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { lang, toggleLang } = useLanguage();
  const { signOut, role } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { t } = useTranslation();

  const roleLabels: Record<string, string> = {
    admin: 'مدير النظام', hr: 'موارد بشرية', finance: 'مالية',
    operations: 'عمليات', viewer: 'عارض',
  };

  const isRtl = lang === 'ar';

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <AppSidebar />
      <main
        className="min-h-screen flex flex-col"
        style={{
          marginRight: isRtl ? '16rem' : undefined,
          marginLeft: isRtl ? undefined : '16rem',
        }}
      >
        {/* Header */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {role && (
              <span className="badge-info text-xs">{roleLabels[role] || role}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Global search */}
            <GlobalSearch />

            {/* Notifications */}
            <NotificationCenter />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={isDark ? (isRtl ? 'الوضع الفاتح' : 'Light mode') : (isRtl ? 'الوضع الداكن' : 'Dark mode')}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="text-xs font-medium h-8 px-3 gap-1.5"
            >
              <Languages size={13} />
              {lang === 'ar' ? 'English' : 'عربي'}
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 px-3 text-muted-foreground hover:text-destructive gap-1.5 text-xs"
            >
              <LogOut size={14} />
              {t('logout')}
            </Button>
          </div>
        </header>
        {/* Content */}
        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
