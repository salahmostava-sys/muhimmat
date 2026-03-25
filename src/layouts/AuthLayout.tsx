import { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
};

export default AuthLayout;
