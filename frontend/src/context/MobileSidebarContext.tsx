import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MobileSidebarContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextType>({} as MobileSidebarContextType);

export const MobileSidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close on route change (mobile nav)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close when resizing to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setIsOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <MobileSidebarContext.Provider value={{
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen(v => !v),
    }}>
      {children}
    </MobileSidebarContext.Provider>
  );
};

export const useMobileSidebar = () => useContext(MobileSidebarContext);
