import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type UndoToastHostContextValue = {
  modalHostCount: number;
  registerModalHost: () => () => void;
};

const UndoToastHostContext = createContext<UndoToastHostContextValue | null>(null);

export function UndoToastHostProvider({ children }: { children: ReactNode }) {
  const [modalHostCount, setModalHostCount] = useState(0);

  const registerModalHost = useCallback(() => {
    setModalHostCount((count) => count + 1);
    return () => {
      setModalHostCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const value = useMemo(
    () => ({ modalHostCount, registerModalHost }),
    [modalHostCount, registerModalHost],
  );

  return <UndoToastHostContext.Provider value={value}>{children}</UndoToastHostContext.Provider>;
}

export function useUndoToastHost(): UndoToastHostContextValue {
  const ctx = useContext(UndoToastHostContext);
  if (!ctx) {
    throw new Error('useUndoToastHost must be used within UndoToastHostProvider');
  }
  return ctx;
}
