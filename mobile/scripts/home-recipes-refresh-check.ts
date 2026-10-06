/**
 * Home manual refresh: cache bypass, debounce, offline messaging.
 * Run from mobile/: npm run test:home-recipes-refresh
 */
import assert from 'node:assert/strict';
import { MEALDB } from '../config/mealdb';
import { RECIPES_COPY } from '../config/recipesCopy';
import { CREATOR_RECIPES } from '../config/creatorRecipes';
import {
  HOME_RECIPES_REFRESH_DEBOUNCE_MS,
  invalidateHomeRecipesCaches,
  shouldDebounceHomeRecipesRefresh,
} from '../lib/home/homeRecipesRefresh';
import {
  readMealDbCategoryListSnapshot,
  writeMealDbCategoryListSnapshot,
} from '../lib/mealdb/categoryListCache';
import { writeJson, readJson } from '../lib/storage';
import { isOffline } from '../lib/network/isOffline';

const TEST_TIMEOUT_MS = 10_000;
const hardTimeout = setTimeout(() => {
  console.error('home-recipes-refresh-check: hard timeout');
  process.exit(1);
}, TEST_TIMEOUT_MS);

assert.equal(RECIPES_COPY.homeToolbarCard.refreshRecipes, 'Refresh recipes');
assert.equal(RECIPES_COPY.homeToolbarCard.refreshUpdated, 'Updated');
assert.equal(
  RECIPES_COPY.homeToolbarCard.refreshOffline,
  "You're offline, showing saved recipes",
);

assert.equal(
  shouldDebounceHomeRecipesRefresh({ lastAttemptAtMs: 1000 }, 1000 + HOME_RECIPES_REFRESH_DEBOUNCE_MS - 1),
  true,
);
assert.equal(
  shouldDebounceHomeRecipesRefresh({ lastAttemptAtMs: 1000 }, 1000 + HOME_RECIPES_REFRESH_DEBOUNCE_MS),
  false,
);

writeMealDbCategoryListSnapshot('Pork', [
  { idMeal: '1', strMeal: 'A', strMealThumb: 'https://example.com/a.jpg' },
]);
writeJson(`${MEALDB.cacheKeyPrefix}:filter.php?c=Pork`, {
  payload: { meals: [] },
  expiresAt: Date.now() + 60_000,
  cachedAtMs: Date.now(),
});
writeJson('mealprep.creatorVideos:creators', {
  payload: [],
  expiresAt: Date.now() + 60_000,
  cachedAtMs: Date.now(),
});

assert.ok(readMealDbCategoryListSnapshot('Pork').length > 0);

invalidateHomeRecipesCaches();

assert.equal(readMealDbCategoryListSnapshot('Pork').length, 0);
assert.equal(readJson('mealprep.creatorVideos:creators', null), null);

const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: false },
});
assert.equal(isOffline(), true);
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: originalNavigator ?? { onLine: true },
});

assert.equal(MEALDB.staleRevalidateAfterMs, 24 * 60 * 60 * 1000);
assert.equal(CREATOR_RECIPES.staleRevalidateAfterMs, 24 * 60 * 60 * 1000);

clearTimeout(hardTimeout);
console.log('home-recipes-refresh-check: ok');
