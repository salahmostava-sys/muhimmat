import { createContext, useContext, useEffect, ReactNode } from 'react';
import i18n from '@/i18n';

type Lang = 'ar';

interface LanguageContextType {
  lang: Lang;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    document.documentElement.style.fontFamily = "'IBM Plex Sans Arabic', sans-serif";
    i18n.changeLanguage('ar');
  }, []);

  return (
    <LanguageContext.Provider value={{ lang: 'ar', isRTL: true }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
