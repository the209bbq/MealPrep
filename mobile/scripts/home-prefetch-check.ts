/**
 * Home MealDB/creator prefetch scheduling, cache hydration, and progressive rows.
 * Run from mobile/: npm run test:home-prefetch
 */
import assert from 'node:assert/strict';
import { MEALDB } from '../config/mealdb';
import { HOME_CLASSIC_CATEGORY_CHIPS } from '../config/recipesTabSurface';
import { resetMealDbClientCacheForTests } from '../lib/mealdb/client';
import {
  readMealDbCategorySnapshot,
  writeMealDbCategorySnapshot,
} from '../lib/mealdb/categoryFeedCache';
import {
  readMealDbCategoryListSnapshot,
  writeMealDbCategoryListSnapshot,
} from '../lib/mealdb/categoryListCache';
import {
  recipesTabRowsFromFilterSummaries,
  mergeMealDetailIntoCategoryRows,
} from '../lib/mealdb/categoryStubRows';
import { fetchMealDbCategoryFeedRows } from '../lib/mealdb/categories';
import { filterRecipesTabRowsForDietPrefs } from '../lib/diet/filterRows';
import type { UserDietPrefs } from '../lib/diet/types';
import {
  kitchenRowFailsDietPrefs,
  resolveKitchenRecipesTabRowDetails,
} from '../lib/mealdb/resolveKitchenRowDetails';
import {
  prefetchMealDbCategoryOnIntent,
  resetHomeRecipePrefetchForTests,
  runHomeRecipePrefetch,
  scheduleHomeRecipePrefetch,
} from '../lib/mealdb/homePrefetch';
import type { MealDbMealDetail } from '../lib/mealdb/types';

const TEST_TIMEOUT_MS = 15_000;
const started = Date.now();
function assertNotHung(): void {
  assert.ok(Date.now() - started < TEST_TIMEOUT_MS, 'home-prefetch-check timed out');
}

function clearMealDbStorage(): void {
  const prefix = `${MEALDB.cacheKeyPrefix}:`;
  if (typeof globalThis.localStorage !== 'undefined') {
    const keys: string[] = [];
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) {
      globalThis.localStorage.removeItem(key);
    }
  }
  resetMealDbClientCacheForTests();
  resetHomeRecipePrefetchForTests();
}

clearMealDbStorage();

const filterCalls: string[] = [];
const lookupCalls: string[] = [];
let lookupInFlight = 0;
let lookupMaxInFlight = 0;

const originalFetch = globalThis.fetch;

function minimalMeal(id: string, name: string): MealDbMealDetail {
  return {
    idMeal: id,
    strMeal: name,
    strCategory: 'Pork',
    strArea: 'American',
    strInstructions: 'Cook.',
    strMealThumb: 'https://example.com/thumb.jpg',
    strTags: null,
    strYoutube: null,
    strSource: null,
    strIngredient1: 'salt',
    strMeasure1: '1 tsp',
  };
}

globalThis.fetch = (async (input: RequestInfo | URL) => {
  assertNotHung();
  const url = String(input);
  if (url.includes('filter.php')) {
    filterCalls.push(url);
    const category = decodeURIComponent(url.split('c=')[1] ?? 'Pork');
    return {
      ok: true,
      json: async () => ({
        meals: [
          { idMeal: '1', strMeal: `${category} A`, strMealThumb: 'https://example.com/a.jpg' },
          { idMeal: '2', strMeal: `${category} B`, strMealThumb: 'https://example.com/b.jpg' },
        ],
      }),
    } as Response;
  }
  if (url.includes('lookup.php')) {
    lookupCalls.push(url);
    lookupInFlight += 1;
    lookupMaxInFlight = Math.max(lookupMaxInFlight, lookupInFlight);
    await new Promise((resolve) => setTimeout(resolve, 30));
    lookupInFlight -= 1;
    const id = new URL(url).searchParams.get('i') ?? '0';
    return {
      ok: true,
      json: async () => ({ meals: [minimalMeal(id, `Meal ${id}`)] }),
    } as Response;
  }
  throw new Error(`unexpected fetch ${url}`);
}) as typeof fetch;

const hardTimeout = setTimeout(() => {
  console.error('home-prefetch-check: hard timeout');
  process.exit(1);
}, TEST_TIMEOUT_MS);

void (async () => {
  const stubs = recipesTabRowsFromFilterSummaries(
    [{ idMeal: '9', strMeal: 'Stub', strMealThumb: 'https://example.com/s.jpg' }],
    'Pork',
  );
  assert.equal(stubs.length, 1);
  assert.equal(stubs[0].kind, 'kitchen');
  assert.equal(stubs[0].pantryMatchPending, true);

  const merged = mergeMealDetailIntoCategoryRows(stubs, minimalMeal('9', 'Full'), []);
  assert.equal(merged[0].pantryMatchPending, false);
  assert.ok(merged[0].recipe.ingredients.length > 0);

  writeMealDbCategoryListSnapshot('Pork', [
    { idMeal: '1', strMeal: 'Cached A', strMealThumb: 'https://example.com/a.jpg' },
    { idMeal: '2', strMeal: 'Cached B', strMealThumb: 'https://example.com/b.jpg' },
  ]);
  assert.equal(readMealDbCategoryListSnapshot('Pork').length, 2);

  const progressive: number[] = [];
  const feed = await fetchMealDbCategoryFeedRows('Pork', [], {
    detailLimit: 2,
    onRows: (partial) => {
      progressive.push(partial.length);
    },
  });
  assert.equal(feed.rows.length, 2);
  const rows = feed.rows;
  assert.ok(progressive.length >= 2, 'expected stub then enriched callbacks');
  assert.equal(progressive[0], 2, 'first paint should include filter summaries');
  assert.equal(filterCalls.length, 0, 'list snapshot should skip filter.php');

  writeMealDbCategorySnapshot('Pork', [], rows);
  const cached = readMealDbCategorySnapshot('Pork', []);
  assert.equal(cached.length, 2);

  filterCalls.length = 0;
  lookupCalls.length = 0;
  lookupMaxInFlight = 0;

  let prefetchRuns = 0;
  const prefetchPromise = runHomeRecipePrefetch({
    pantry: [],
    accessToken: null,
    categories: ['Chicken', 'Beef'],
  }).then(() => {
    prefetchRuns += 1;
  });
  await runHomeRecipePrefetch({
    pantry: [],
    accessToken: null,
    categories: ['Chicken', 'Beef'],
  });
  await prefetchPromise;
  assert.equal(prefetchRuns, 1, 'concurrent prefetch should dedupe');

  assert.ok(
    lookupMaxInFlight <= MEALDB.homePrefetchLookupConcurrency * MEALDB.homeCategoryPrefetchConcurrency,
    `lookup concurrency spike ${lookupMaxInFlight}`,
  );

  resetHomeRecipePrefetchForTests();
  let idleRuns = 0;
  const originalIdle = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = (cb: IdleRequestCallback) => {
    idleRuns += 1;
    return 1;
  };
  scheduleHomeRecipePrefetch({ pantry: [], accessToken: null, categories: ['Pork'] });
  scheduleHomeRecipePrefetch({ pantry: [], accessToken: null, categories: ['Pork'] });
  assert.equal(idleRuns, 1, 'schedule should only register one idle callback per generation');
  globalThis.requestIdleCallback = originalIdle;

  clearMealDbStorage();
  filterCalls.length = 0;
  lookupCalls.length = 0;
  await prefetchMealDbCategoryOnIntent('Seafood', []);
  assert.ok(
    filterCalls.length > 0 || lookupCalls.length > 0,
    `press-in prefetch should hit network (filter=${filterCalls.length}, lookup=${lookupCalls.length})`,
  );

  const peanutPrefs: UserDietPrefs = {
    diets: [],
    allergens: ['peanuts'],
    dislikes: [],
    hideConflicts: true,
  };
  const dietStubs = recipesTabRowsFromFilterSummaries(
    [
      { idMeal: '10', strMeal: 'Peanut Noodles', strMealThumb: 'https://example.com/p.jpg' },
      { idMeal: '11', strMeal: 'Garden Salad', strMealThumb: 'https://example.com/s.jpg' },
    ],
    'Chicken',
  );
  const titleFiltered = filterRecipesTabRowsForDietPrefs(dietStubs, peanutPrefs);
  assert.equal(titleFiltered.length, 2, 'pending stubs kept until lookup for allergen users');
  const resolvedPeanutRow = { ...dietStubs[0], pantryMatchPending: false };
  assert.equal(
    filterRecipesTabRowsForDietPrefs([resolvedPeanutRow], peanutPrefs).length,
    0,
    'resolved peanut title still filtered',
  );

  const saladStub = dietStubs.find((row) => row.recipe.name.includes('Salad'));
  assert.ok(saladStub);
  const peanutMeal: MealDbMealDetail = {
    ...minimalMeal('11', 'Garden Salad'),
    strIngredient1: 'peanut butter',
    strMeasure1: '2 tbsp',
  };
  const afterDetail = mergeMealDetailIntoCategoryRows([saladStub!], peanutMeal, []);
  assert.equal(
    filterRecipesTabRowsForDietPrefs(afterDetail, peanutPrefs).length,
    0,
    'full ingredient filter removes row after lookup',
  );

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('lookup.php?i=11')) {
      return {
        ok: true,
        json: async () => ({ meals: [peanutMeal] }),
      } as Response;
    }
    return originalFetch(input);
  }) as typeof fetch;
  const resolved = await resolveKitchenRecipesTabRowDetails(saladStub!, []);
  assert.ok(resolved, 'resolve should load details for tap');
  assert.ok(
    kitchenRowFailsDietPrefs(resolved!, peanutPrefs),
    'resolved row should fail diet prefs before open',
  );

  globalThis.fetch = originalFetch;
  clearMealDbStorage();
  clearTimeout(hardTimeout);
  console.log('home-prefetch-check: ok');
})().catch((error) => {
  globalThis.fetch = originalFetch;
  clearMealDbStorage();
  clearTimeout(hardTimeout);
  console.error(error);
  process.exit(1);
});
