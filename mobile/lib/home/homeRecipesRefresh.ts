import { invalidateCreatorVideosCaches } from '../creatorVideos/client';
import { invalidateMealDbHomeRecipeCaches } from '../mealdb/homeCacheControl';
import { resetHomeRecipePrefetchForTests } from '../mealdb/homePrefetch';

export const HOME_RECIPES_REFRESH_DEBOUNCE_MS = 2_500;

export type HomeRecipesRefreshResult = 'ok' | 'offline' | 'debounced';

export interface HomeRecipesRefreshState {
  lastAttemptAtMs: number;
}

export function shouldDebounceHomeRecipesRefresh(
  state: HomeRecipesRefreshState,
  nowMs: number,
): boolean {
  return nowMs - state.lastAttemptAtMs < HOME_RECIPES_REFRESH_DEBOUNCE_MS;
}

export function invalidateHomeRecipesCaches(): void {
  invalidateMealDbHomeRecipeCaches();
  invalidateCreatorVideosCaches();
  resetHomeRecipePrefetchForTests();
}
