import { useEffect, useState } from 'react';

/** True after mount — safe to apply localStorage-backed UI without SSR hydration mismatch. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
