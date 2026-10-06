/**
 * Home QA round 5 (R5-1–R5-4, R5-6–R5-8): lookup scheduler, masking, picker cache, slot filter, #419.
 * Run from mobile/: npm run test:home-qa5
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { Recipe } from '../types/mealprep';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import { RECIPES_COPY } from '../config/recipesCopy';
import { userNeedsResolvedMealDbRowsBeforeDisplay } from '../lib/diet/stubSafety';
import { shouldHideCreatorModelForDietPrefs } from '../lib/diet/creatorAllergenCheck';
import type { CreatorFeedCardModel } from '../lib/recipes/creatorFeedRows';
import { recipeSuitsMealPickerSlot } from '../lib/mealCalendar/mealPickerSlotFilter';
import { kitchenRecipesWithMealPlanContext } from '../lib/recipeMatch/kitchenCatalogMerge';
import {
  beginMealDbUserVisibleLookups,
  fetchMealDbLookupWithRetries,
  mealDbLookupSchedulerStatsForTests,
  resetMealDbLookupSchedulerForTests,
} from '../lib/mealdb/lookupScheduler';
import {
  mealDbLookupMeals,
  resetMealDbClientCacheForTests,
} from '../lib/mealdb/client';
import { fetchMealDbCategoryFeedRows } from '../lib/mealdb/categories';
import { writeMealDbCategorySnapshot } from '../lib/mealdb/categoryFeedCache';
import { mealDbMealToAppRecipe } from '../lib/mealdb/normalize';
import type { MealDbMealDetail } from '../lib/mealdb/types';
import {
  notifyMealDbKitchenCacheChanged,
  resetMealDbKitchenCacheNotifyForTests,
} from '../lib/mealdb/kitchenCacheNotify';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

function kitchenRecipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return {
    tag: partial.tag ?? 'Chicken',
    description: '',
    servings: 4,
    minutes: 30,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: partial.ingredients ?? [{ name: 'salt', quantity: 1, unit: 'tsp' }],
    steps: [],
    isMaster: true,
    createdAt: '',
    ...partial,
  };
}

function mealDetail(id: string, name: string): MealDbMealDetail {
  return {
    idMeal: id,
    strMeal: name,
    strCategory: 'Pork',
    strMealThumb: 'https://example.com/thumb.jpg',
    strInstructions: 'Cook.',
    strIngredient1: 'salt',
    strMeasure1: '1 tsp',
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateCategoryLookups(
  ids: readonly string[],
  options?: { abortAfterMs?: number },
): Promise<{ resolved: number; failed: number }> {
  const controller = new AbortController();
  const release = beginMealDbUserVisibleLookups();
  let resolved = 0;
  let failed = 0;
  const abortTimer =
    options?.abortAfterMs != null
      ? setTimeout(() => controller.abort(), options.abortAfterMs)
      : null;
  try {
    await mealDbLookupMeals(ids, {
      priority: 'user-visible',
      signal: controller.signal,
      concurrency: 4,
      onMeal: () => {
        resolved += 1;
      },
      onFailed: () => {
        failed += 1;
      },
    });
  } finally {
    release();
    if (abortTimer) clearTimeout(abortTimer);
  }
  return { resolved, failed };
}

async function runLookupSchedulerRegression(): Promise<void> {
  resetMealDbLookupSchedulerForTests();
  resetMealDbClientCacheForTests();

  let inFlightFetches = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes('lookup.php')) {
      return { ok: false, json: async () => null } as Response;
    }
    inFlightFetches += 1;
    await sleep(120);
    inFlightFetches -= 1;
    const id = url.match(/i=(\d+)/)?.[1] ?? '0';
    return {
      ok: true,
      json: async () => ({
        meals: [mealDetail(id, `Meal ${id}`)],
      }),
    } as Response;
  }) as typeof fetch;

  const ids = ['1', '2', '3', '4', '5', '6', '7', '8'];
  await simulateCategoryLookups(ids, { abortAfterMs: 50 });
  await sleep(80);
  const statsAfterAbort = mealDbLookupSchedulerStatsForTests();
  assert.equal(statsAfterAbort.userVisibleDepth, 0, 'user-visible depth must not leak after abort');
  assert.equal(statsAfterAbort.inFlight, 0, 'in-flight must drain after abort');

  const secondOpen = await simulateCategoryLookups(ids);
  assert.equal(secondOpen.resolved + secondOpen.failed, ids.length, 'reopen must settle every row');
  const statsAfterReopen = mealDbLookupSchedulerStatsForTests();
  assert.equal(statsAfterReopen.inFlight, 0);
  assert.equal(statsAfterReopen.queued, 0);

  resetMealDbLookupSchedulerForTests();
  resetMealDbClientCacheForTests();
  for (const category of ['Chicken', 'Vegetarian'] as const) {
    const controller = new AbortController();
    const release = beginMealDbUserVisibleLookups();
    void mealDbLookupMeals(['10', '11', '12'], {
      priority: 'user-visible',
      signal: controller.signal,
      concurrency: 4,
      onMeal: () => undefined,
      onFailed: () => undefined,
    });
    await sleep(30);
    controller.abort();
    release();
    await sleep(50);
    assert.equal(mealDbLookupSchedulerStatsForTests().userVisibleDepth, 0, `${category} switch depth`);
  }
  await simulateCategoryLookups(['10', '11', '12']);
  assert.equal(mealDbLookupSchedulerStatsForTests().queued, 0);

  globalThis.fetch = originalFetch;
}

function assertFailedRowMasking(): void {
  const prefs = {
    ...DEFAULT_USER_DIET_PREFS,
    hideConflicts: true,
    allergens: ['peanuts'],
    dislikes: [],
  };
  assert.ok(userNeedsResolvedMealDbRowsBeforeDisplay(prefs));
  const failedRow: RecipesTabRow = {
    kind: 'kitchen',
    recipe: kitchenRecipe({
      id: 'mealdb-99',
      name: 'Spicy Thai prawn noodles',
      ingredients: [],
    }),
    match: {
      recipeId: 'mealdb-99',
      recipeName: 'Spicy Thai prawn noodles',
      totalIngredients: 0,
      matchedCount: 0,
      missingCount: 0,
      percentMatch: 0,
      matched: [],
      missing: [],
    },
    pantryMatchPending: false,
    pantryMatchFailed: true,
  };
  const shouldMask =
    userNeedsResolvedMealDbRowsBeforeDisplay(prefs) &&
    (Boolean(failedRow.pantryMatchPending) || Boolean(failedRow.pantryMatchFailed));
  assert.ok(shouldMask, 'failed lookup rows must stay masked for allergen users');
}

function assertCreatorDislikeDescription(): void {
  const prefs = {
    ...DEFAULT_USER_DIET_PREFS,
    hideConflicts: true,
    allergens: [],
    dislikes: ['mushrooms'],
  };
  const model = {
    videoId: 'burger',
    item: { videoId: 'burger', title: 'Ultimate Dream Burger', channelTitle: 'SAM' },
    video: {
      videoId: 'burger',
      title: 'Ultimate Dream Burger',
      descriptionSnippet: 'Top with boozy marsala mushrooms and serve.',
      channelId: 'ch',
      channelTitle: 'SAM',
      publishedAt: '',
      thumbnailUrl: '',
    },
    importedRecipe: null,
  } as CreatorFeedCardModel;
  assert.ok(
    shouldHideCreatorModelForDietPrefs(prefs, model),
    'mushroom dislike in description must hide creator video',
  );
}

function assertPickerLiveCache(): void {
  resetMealDbKitchenCacheNotifyForTests();
  const pantry = [{ id: 'p1', name: 'eggs', quantity: 6, unit: 'each', category: 'dairy', storageLocation: 'pantry' }];
  const before = kitchenRecipesWithMealPlanContext([], [], pantry, []);
  const bread = mealDbMealToAppRecipe(mealDetail('52800', 'Bread omelette'));
  const row: RecipesTabRow = {
    kind: 'kitchen',
    recipe: bread,
    match: {
      recipeId: bread.id,
      recipeName: bread.name,
      totalIngredients: bread.ingredients.length,
      matchedCount: 1,
      missingCount: 0,
      percentMatch: 100,
      matched: [],
      missing: [],
    },
    pantryMatchPending: false,
  };
  writeMealDbCategorySnapshot('Breakfast', pantry, [row]);
  notifyMealDbKitchenCacheChanged();
  const after = kitchenRecipesWithMealPlanContext([], [], pantry, []);
  assert.ok(
    after.some((recipe) => recipe.name === 'Bread omelette'),
    'picker kitchen list must include browsed category recipes after cache notify',
  );
  assert.ok(
    !before.some((recipe) => recipe.name === 'Bread omelette'),
    'browsed recipe should not appear before category snapshot write',
  );
}

function assertStaticCopyAndSupabaseGuard(): void {
  assert.equal(
    RECIPES_COPY.recipeCard.lookupBookmarkNotReady,
    'Still loading — try again in a moment',
  );
  const supabaseSource = fs.readFileSync(path.join(mobileRoot, 'lib/supabase.ts'), 'utf8');
  assert.match(supabaseSource, /typeof window === 'undefined'/);
  const appSource = fs.readFileSync(path.join(mobileRoot, 'context/AppContext.tsx'), 'utf8');
  assert.match(appSource, /subscribeMealDbKitchenCacheChanged/);
}

async function runExpoExport(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('npx', ['expo', 'export', '--platform', 'web'], {
      cwd: mobileRoot,
      stdio: 'inherit',
      env: { ...process.env },
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`expo export failed with code ${code}`));
    });
  });
}

function htmlPathForRoute(route: string): string {
  if (route === '/' || route === '') {
    return path.join(mobileRoot, 'dist', 'index.html');
  }
  const flat = path.join(mobileRoot, 'dist', `${route.replace(/^\//, '')}.html`);
  if (fs.existsSync(flat)) return flat;
  return path.join(mobileRoot, 'dist', route.replace(/^\//, ''), 'index.html');
}

function htmlSizeForRoute(route: string): number {
  const htmlPath = htmlPathForRoute(route);
  assert.ok(fs.existsSync(htmlPath), `missing export html for ${route}`);
  return fs.statSync(htmlPath).size;
}

function rootHasPrerenderedContent(html: string): boolean {
  if (/<!--\$!-->/.test(html) && /<template><\/template>/.test(html)) {
    return false;
  }
  return html.includes('id="root"') && html.length > 2_500;
}

function runHydrationPlaywright(): { htmlSizes: Record<string, number> } {
  const basePath = '/MealPrep/app';
  const routes = ['/', '/pantry', '/grocery'];
  const htmlSizes: Record<string, number> = {};
  for (const route of routes) {
    htmlSizes[route] = htmlSizeForRoute(route);
    const html = fs.readFileSync(htmlPathForRoute(route), 'utf8');
    assert.ok(rootHasPrerenderedContent(html), `pre-render must include real HTML for ${route}`);
    assert.ok(!/<!--\$!-->/.test(html), `pre-render must not use Suspense fallback for ${route}`);
  }

  const hydration = spawnSync(
    'npx',
    ['tsx', 'scripts/web-hydration-check.ts'],
    {
      cwd: mobileRoot,
      env: {
        ...process.env,
        APP_BASE: basePath,
        HYDRATION_ROUTES: '/,/pantry,/grocery',
      },
      encoding: 'utf8',
    },
  );
  if (hydration.status !== 0) {
    console.error(hydration.stdout);
    console.error(hydration.stderr);
    throw new Error('web-hydration-check failed');
  }

  return { htmlSizes };
}

async function main(): Promise<void> {
  await runLookupSchedulerRegression();
  assertFailedRowMasking();
  assertCreatorDislikeDescription();
  assertPickerLiveCache();
  assertStaticCopyAndSupabaseGuard();

  const aji = kitchenRecipe({
    id: 'mealdb-aji',
    name: 'Ají de Aguacate',
    tag: 'Miscellaneous',
    sourceType: 'themealdb',
  });
  assert.ok(!recipeSuitsMealPickerSlot(aji, 'dinner'), 'sauce must not suit dinner');

  let attempts = 0;
  resetMealDbLookupSchedulerForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    attempts += 1;
    return { ok: false, json: async () => null } as Response;
  }) as typeof fetch;
  await fetchMealDbLookupWithRetries('background', async () => {
    attempts += 1;
    return null;
  });
  assert.equal(attempts, 5, 'all retry delays must be used (five attempts)');
  globalThis.fetch = originalFetch;

  const skipExport = process.env.HOME_QA5_SKIP_EXPORT === '1' && fs.existsSync(path.join(mobileRoot, 'dist', 'index.html'));
  if (!skipExport) {
    await runExpoExport();
  }
  const { htmlSizes } = runHydrationPlaywright();
  console.log(
    `home-qa5-check: hydration passed (web-hydration-check); html bytes home=${htmlSizes['/']} pantry=${htmlSizes['/pantry']} grocery=${htmlSizes['/grocery']}`,
  );
  console.log('home-qa5-check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
