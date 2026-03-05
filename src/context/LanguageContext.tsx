import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from '@/i18n';

type Lang = 'ar' | 'en';

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'ar');

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    document.documentElement.style.fontFamily =
      lang === 'ar' ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif";
    localStorage.setItem('lang', lang);
    i18n.changeLanguage(lang);
  }, [lang]);

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'ar' ? 'en' : 'ar';
      // Force layout recalculation after direction change
      requestAnimationFrame(() => {
        document.body.style.display = 'none';
        requestAnimationFrame(() => { document.body.style.display = ''; });
      });
      return next;
    });
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, isRTL: lang === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
