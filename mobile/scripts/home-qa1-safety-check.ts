/**
 * Home QA round 1 — safety (items 1 & 2).
 * Run from mobile/: npm run test:home-qa1-safety
 */
import assert from 'node:assert/strict';
import { MEALDB } from '../config/mealdb';
import { phraseMatchesHaystack, haystackForLine } from '../lib/diet/allergenMatch';
import { filterRecipesTabRowsForDietPrefs } from '../lib/diet/filterRows';
import { userNeedsResolvedMealDbRowsBeforeDisplay } from '../lib/diet/stubSafety';
import type { UserDietPrefs } from '../lib/diet/types';
import { RECIPES_COPY } from '../config/recipesCopy';
import { recipeListShopLine } from '../lib/recipes/recipeListShopLine';
import { resetMealDbClientCacheForTests } from '../lib/mealdb/client';
import {
  clearMealDbCategoryListSnapshot,
  readMealDbCategoryListSnapshot,
  writeMealDbCategoryListSnapshot,
} from '../lib/mealdb/categoryListCache';
import { recipesTabRowsFromFilterSummaries } from '../lib/mealdb/categoryStubRows';
import { fetchMealDbCategoryFeedRows } from '../lib/mealdb/categories';

const peanutPrefs: UserDietPrefs = {
  diets: [],
  allergens: ['peanuts'],
  dislikes: [],
  hideConflicts: true,
};

assert.ok(userNeedsResolvedMealDbRowsBeforeDisplay(peanutPrefs));
assert.ok(!userNeedsResolvedMealDbRowsBeforeDisplay({ ...peanutPrefs, hideConflicts: false }));

for (const title of ['Kung Po Prawns', 'Meang Nem', 'Mee goreng mamak', 'Bang bang prawn salad']) {
  const haystack = haystackForLine(title);
  assert.ok(phraseMatchesHaystack(haystack, 'kung po') || phraseMatchesHaystack(haystack, 'nem') || phraseMatchesHaystack(haystack, 'mee goreng') || phraseMatchesHaystack(haystack, 'bang bang'), title);
}

const stubRows = recipesTabRowsFromFilterSummaries(
  [{ idMeal: '1', strMeal: 'Kung Po Prawns', strMealThumb: 'https://example.com/a.jpg' }],
  'Seafood',
);
assert.equal(filterRecipesTabRowsForDietPrefs(stubRows, peanutPrefs).length, 1, 'pending stub kept for masked display');

assert.equal(
  recipeListShopLine({
    recipeId: 'x',
    recipeName: 'Stub',
    totalIngredients: 0,
    matchedCount: 0,
    missingCount: 0,
    percentMatch: 0,
    matched: [],
    missing: [],
  }),
  RECIPES_COPY.recipeCard.previewNoIngredients,
  'pending rows use pantryMatchPending on the card; shop line is neutral when ingredients are unknown',
);

resetMealDbClientCacheForTests();
const originalFetch = globalThis.fetch;
let filterAttempts = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('filter.php?c=Seafood')) {
    filterAttempts += 1;
    if (filterAttempts === 1) {
      return { ok: false, json: async () => ({}) } as Response;
    }
    return {
      ok: true,
      json: async () => ({
        meals: [{ idMeal: '9', strMeal: 'Fish A', strMealThumb: 'https://example.com/f.jpg' }],
      }),
    } as Response;
  }
  throw new Error(`unexpected ${url}`);
}) as typeof fetch;

void (async () => {
  const first = await fetchMealDbCategoryFeedRows('Seafood', []);
  assert.equal(first.listFetchFailed, true);
  assert.equal(first.rows.length, 0);
  assert.equal(readMealDbCategoryListSnapshot('Seafood').length, 0, 'failed list not cached');

  const second = await fetchMealDbCategoryFeedRows('Seafood', [], { bypassListCache: true });
  assert.equal(second.listFetchFailed, false);
  assert.equal(second.rows.length, 1);
  assert.equal(filterAttempts, 2);

  globalThis.fetch = originalFetch;
  resetMealDbClientCacheForTests();
  writeMealDbCategoryListSnapshot('Pork', [
    { idMeal: '1', strMeal: 'A', strMealThumb: 'https://example.com/a.jpg' },
  ]);
  clearMealDbCategoryListSnapshot('Pork');
  assert.equal(readMealDbCategoryListSnapshot('Pork').length, 0);

  console.log('home-qa1-safety-check: ok');
})().catch((error) => {
  globalThis.fetch = originalFetch;
  console.error(error);
  process.exit(1);
});
