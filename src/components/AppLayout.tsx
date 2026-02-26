import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { lang, toggleLang } = useLanguage();
  const { signOut } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="mr-64 min-h-screen flex flex-col" style={{ marginRight: lang === 'ar' ? '16rem' : undefined, marginLeft: lang === 'en' ? '16rem' : undefined }}>
        {/* Header */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
          <div />
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="text-xs font-medium h-8 px-3"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </Button>
            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 px-3 text-muted-foreground hover:text-destructive"
            >
              <LogOut size={15} />
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
