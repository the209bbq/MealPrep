import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { HomeHubSection } from '../config/homeHub';

type HomeHubSheetContextValue = {
  visible: boolean;
  section: HomeHubSection;
  openHub: (section?: HomeHubSection) => void;
  closeHub: () => void;
  setSection: (section: HomeHubSection) => void;
};

const HomeHubSheetContext = createContext<HomeHubSheetContextValue | null>(null);

export function HomeHubSheetProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [section, setSection] = useState<HomeHubSection>('weekPlan');

  const openHub = useCallback((nextSection: HomeHubSection = 'weekPlan') => {
    setSection(nextSection);
    setVisible(true);
  }, []);

  const closeHub = useCallback(() => {
    setVisible(false);
  }, []);

  const value = useMemo(
    () => ({ visible, section, openHub, closeHub, setSection }),
    [closeHub, openHub, section, visible],
  );

  return <HomeHubSheetContext.Provider value={value}>{children}</HomeHubSheetContext.Provider>;
}

export function useHomeHubSheet(): HomeHubSheetContextValue {
  const ctx = useContext(HomeHubSheetContext);
  if (!ctx) {
    throw new Error('useHomeHubSheet must be used within HomeHubSheetProvider');
  }
  return ctx;
}
