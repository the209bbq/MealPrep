/**
 * Home QA round 1 — data/UX (items 5, 6, 7, 9, 12).
 * Run from mobile/: npm run test:home-qa1-data
 */
import assert from 'node:assert/strict';
import { MEALDB, MEALDB_COPY } from '../config/mealdb';
import { CREATOR_RECIPES_COPY } from '../config/creatorRecipes';
import { RECIPES_COPY } from '../config/recipesCopy';
import {
  invalidateHomeRecipesCachesLight,
  invalidateHomeRecipesCaches,
} from '../lib/home/homeRecipesRefresh';
import { resetMealDbClientCacheForTests } from '../lib/mealdb/client';
import {
  readMealDbCategoryListSnapshot,
  writeMealDbCategoryListSnapshot,
} from '../lib/mealdb/categoryListCache';
import { writeJson, readJson } from '../lib/storage';
import { fetchMealDbCategoryFeedRows } from '../lib/mealdb/categories';

assert.equal(MEALDB_COPY.categoryLoadFailed, "Couldn't load recipes");
assert.equal(MEALDB_COPY.categoryRetry, 'Retry');
assert.equal(CREATOR_RECIPES_COPY.searchTypingHint, 'Type one more letter to search.');
assert.equal(MEALDB.homeCategoryFeedLookupBatch, MEALDB.homeCategoryFeedMealCount);

writeMealDbCategoryListSnapshot('Chicken', [
  { idMeal: '1', strMeal: 'Alpha', strMealThumb: 'https://example.com/a.jpg' },
  { idMeal: '2', strMeal: 'Zulu', strMealThumb: 'https://example.com/z.jpg' },
]);

const originalFetch = globalThis.fetch;
let lookupCount = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('lookup.php')) {
    lookupCount += 1;
    const id = new URL(url).searchParams.get('i') ?? '0';
    return {
      ok: true,
      json: async () => ({
        meals: [
          {
            idMeal: id,
            strMeal: id === '1' ? 'Alpha' : 'Zulu',
            strCategory: 'Chicken',
            strArea: 'Test',
            strInstructions: 'Cook',
            strMealThumb: 'https://example.com/t.jpg',
            strTags: null,
            strYoutube: null,
            strSource: null,
            strIngredient1: 'salt',
            strMeasure1: '1 tsp',
          },
        ],
      }),
    } as Response;
  }
  throw new Error(`unexpected ${url}`);
}) as typeof fetch;

void (async () => {
  const feed = await fetchMealDbCategoryFeedRows('Chicken', [], { detailLimit: 1 });
  assert.equal(feed.rows.length, 2, 'full category stub list');
  assert.ok(lookupCount >= 1, 'lazy lookups started');

  lookupCount = 0;
  writeJson(`${MEALDB.cacheKeyPrefix}:lookup.php?i=1`, {
    payload: { meals: [{ idMeal: '1' }] },
    expiresAt: Date.now() + 60_000,
    cachedAtMs: Date.now(),
  });
  writeMealDbCategoryListSnapshot('Pork', [
    { idMeal: '3', strMeal: 'Cached', strMealThumb: 'https://example.com/c.jpg' },
  ]);
  assert.ok(readMealDbCategoryListSnapshot('Pork').length > 0);
  invalidateHomeRecipesCachesLight();
  assert.equal(readMealDbCategoryListSnapshot('Pork').length, 0);
  assert.ok(readJson(`${MEALDB.cacheKeyPrefix}:lookup.php?i=1`, null), 'lookup kept on light refresh');

  invalidateHomeRecipesCaches();
  assert.equal(readJson(`${MEALDB.cacheKeyPrefix}:lookup.php?i=1`, null), null, 'full invalidate clears lookups');

  assert.equal(RECIPES_COPY.homeToolbarCard.refreshUpdated, 'Updated');

  globalThis.fetch = originalFetch;
  resetMealDbClientCacheForTests();
  console.log('home-qa1-data-check: ok');
})().catch((error) => {
  globalThis.fetch = originalFetch;
  console.error(error);
  process.exit(1);
});
