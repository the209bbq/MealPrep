import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ScheduleRecipeSheet } from '../components/mealCalendar/ScheduleRecipeSheet';
import type { ScheduleRecipeTarget } from '../lib/mealCalendar/scheduleTarget';

interface ScheduleRecipeSheetContextValue {
  openScheduleRecipe: (target: ScheduleRecipeTarget) => void;
}

const ScheduleRecipeSheetContext = createContext<ScheduleRecipeSheetContextValue | null>(null);

export function ScheduleRecipeSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ScheduleRecipeTarget | null>(null);

  const openScheduleRecipe = useCallback((next: ScheduleRecipeTarget) => {
    setTarget(next);
  }, []);

  const close = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ openScheduleRecipe }), [openScheduleRecipe]);

  return (
    <ScheduleRecipeSheetContext.Provider value={value}>
      {children}
      <ScheduleRecipeSheet visible={target != null} target={target} onClose={close} />
    </ScheduleRecipeSheetContext.Provider>
  );
}

export function useScheduleRecipeSheet(): ScheduleRecipeSheetContextValue {
  const ctx = useContext(ScheduleRecipeSheetContext);
  if (!ctx) {
    throw new Error('useScheduleRecipeSheet must be used within ScheduleRecipeSheetProvider');
  }
  return ctx;
}
