export type StoresTabListPhase = {
  loadingStores: boolean;
  storeSearchFailed: boolean;
  filteredCount: number;
  hasSearchQuery: boolean;
};

export function storesTabShowsLoading(phase: StoresTabListPhase): boolean {
  return phase.loadingStores && phase.filteredCount === 0;
}

export function storesTabShowsLoadError(phase: StoresTabListPhase): boolean {
  return (
    !phase.loadingStores &&
    phase.storeSearchFailed &&
    phase.filteredCount === 0 &&
    !phase.hasSearchQuery
  );
}

export function storesTabShowsNoSearchResults(phase: StoresTabListPhase): boolean {
  return (
    !phase.loadingStores &&
    phase.hasSearchQuery &&
    phase.filteredCount === 0 &&
    !phase.storeSearchFailed
  );
}

export function storesTabShowsNoStoresNearby(phase: StoresTabListPhase): boolean {
  return (
    !phase.loadingStores &&
    !phase.hasSearchQuery &&
    phase.filteredCount === 0 &&
    !phase.storeSearchFailed
  );
}
