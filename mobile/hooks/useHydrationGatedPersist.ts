import { useEffect } from 'react';

/**
 * Runs a persist side effect only after the hydration gate is open.
 * Prevents first-render default state from overwriting localStorage / guest kitchen storage.
 */
export function useHydrationGatedPersist(
  gate: boolean,
  persist: () => void,
  deps: readonly unknown[],
): void {
  useEffect(() => {
    if (!gate) return;
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies full dependency list
  }, [gate, persist, ...deps]);
}
