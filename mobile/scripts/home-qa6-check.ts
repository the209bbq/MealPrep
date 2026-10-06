/**
 * Home QA round 6 (R6-1–R6-5): picker diet filter, auth chrome, dislike stems, pantry perf, slot filter.
 * Run from mobile/: npm run test:home-qa6
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Recipe } from '../types/mealprep';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import {
  shouldHideCreatorDescriptionForDietPrefs,
  shouldHideCreatorModelForDietPrefs,
} from '../lib/diet/creatorAllergenCheck';
import { dislikeMatchesHaystack } from '../lib/diet/dislikeMatch';
import { haystackForLine } from '../lib/diet/allergenMatch';
import type { CreatorFeedCardModel } from '../lib/recipes/creatorFeedRows';
import { recipeSuitsMealPickerSlot } from '../lib/mealCalendar/mealPickerSlotFilter';
import {
  buildMealPickerRecipeOptions,
} from '../lib/mealCalendar/recipePickerOptions';
import { kitchenRecipesWithMealPlanContext } from '../lib/recipeMatch/kitchenCatalogMerge';
import { buildPantryMatchIndex, updatePantryMatchIndex } from '../lib/recipeMatch';
import { writeMealDbCategorySnapshot } from '../lib/mealdb/categoryFeedCache';
import { mealDbMealToAppRecipe } from '../lib/mealdb/normalize';
import type { MealDbMealDetail } from '../lib/mealdb/types';
import {
  notifyMealDbKitchenCacheChanged,
  resetMealDbKitchenCacheNotifyForTests,
} from '../lib/mealdb/kitchenCacheNotify';
import { ACCOUNT_HEADER_COPY } from '../config/appRoutes';

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
    ingredients:
      partial.ingredients ??
      [{ ingredientId: 'salt', name: 'salt', quantity: 1, unit: 'tsp' }],
    steps: [],
    isMaster: true,
    createdAt: '',
    ...partial,
  };
}

function mealDetail(
  id: string,
  name: string,
  category: string,
  ingredients: { name: string; measure?: string }[],
): MealDbMealDetail {
  const detail: MealDbMealDetail = {
    idMeal: id,
    strMeal: name,
    strCategory: category,
    strMealThumb: 'https://example.com/thumb.jpg',
    strInstructions: 'Cook.',
  };
  ingredients.forEach((row, index) => {
    const n = index + 1;
    (detail as Record<string, string>)[`strIngredient${n}`] = row.name;
    (detail as Record<string, string>)[`strMeasure${n}`] = row.measure ?? '1';
  });
  return detail;
}

function dietPrefsPeanutMushroom(): typeof DEFAULT_USER_DIET_PREFS {
  return {
    ...DEFAULT_USER_DIET_PREFS,
    hideConflicts: true,
    allergens: ['peanuts'],
    dislikes: ['mushrooms'],
  };
}

function assertPickerHidesBrowsedBreakfastConflicts(): void {
  resetMealDbKitchenCacheNotifyForTests();
  const prefs = dietPrefsPeanutMushroom();
  const pantry = [
    {
      id: 'p1',
      ingredientId: 'eggs',
      name: 'eggs',
      quantity: 6,
      unit: 'each',
      category: 'dairy',
      location: 'pantry',
      photoUri: null,
      expiresOn: null,
      updatedAt: new Date().toISOString(),
    },
  ];

  const bread = mealDbMealToAppRecipe(mealDetail('52800', 'Bread omelette', 'Breakfast', [{ name: 'eggs' }]));
  const english = mealDbMealToAppRecipe(
    mealDetail('52896', 'English Breakfast', 'Breakfast', [
      { name: 'Mushrooms' },
      { name: 'Bacon' },
    ]),
  );
  const fullEnglish = mealDbMealToAppRecipe(
    mealDetail('52897', 'Full English Breakfast', 'Breakfast', [
      { name: 'Mushrooms' },
      { name: 'Sausages' },
    ]),
  );
  const peanutDish = mealDbMealToAppRecipe(
    mealDetail('52951', 'Kung Po Prawns', 'Seafood', [{ name: 'peanuts' }, { name: 'prawns' }]),
  );

  const rows: RecipesTabRow[] = [bread, english, fullEnglish, peanutDish].map((recipe) => ({
    kind: 'kitchen' as const,
    recipe,
    match: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalIngredients: recipe.ingredients.length,
      matchedCount: 1,
      missingCount: 0,
      percentMatch: 50,
      matched: [],
      missing: [],
    },
    pantryMatchPending: false,
  }));

  writeMealDbCategorySnapshot('Breakfast', pantry, rows);
  notifyMealDbKitchenCacheChanged();

  const feed = kitchenRecipesWithMealPlanContext([], [], pantry, []);
  const options = buildMealPickerRecipeOptions(feed, [], 80, new Set(), [], {
    mealSlot: 'breakfast',
    dietPrefs: prefs,
  });
  const titles = new Set(options.map((row) => row.title));
  assert.ok(titles.has('Bread omelette'), 'ready breakfast should remain');
  assert.ok(!titles.has('English Breakfast'), 'mushroom breakfast must be hidden in picker');
  assert.ok(!titles.has('Full English Breakfast'), 'mushroom breakfast must be hidden in picker');
  assert.ok(!titles.has('Kung Po Prawns'), 'peanut dish must stay out of picker');
}

function assertCreatorSingularMushroom(): void {
  const prefs = {
    ...DEFAULT_USER_DIET_PREFS,
    hideConflicts: true,
    allergens: [],
    dislikes: ['mushrooms'],
  };
  const haystack = haystackForLine('Serve with mushroom butter on the side.');
  assert.ok(dislikeMatchesHaystack(haystack, 'mushrooms'), 'singular mushroom stem must match');

  const model = {
    videoId: 'roast',
    item: { videoId: 'roast', title: 'Roast Dinner Ideas', channelTitle: 'Jamie' },
    video: {
      videoId: 'roast',
      title: 'Roast Dinner Ideas',
      descriptionSnippet: 'Rub the bird with mushroom butter before roasting.',
      channelId: 'ch',
      channelTitle: 'Jamie',
      publishedAt: '',
      thumbnailUrl: '',
    },
    importedRecipe: null,
  } as CreatorFeedCardModel;
  assert.ok(
    shouldHideCreatorDescriptionForDietPrefs(prefs, model.video.descriptionSnippet!),
    'singular mushroom in description must hide',
  );
  assert.ok(shouldHideCreatorModelForDietPrefs(prefs, model), 'creator card must hide');

  const selfish = haystackForLine('He was selfish about sharing.');
  assert.ok(!dislikeMatchesHaystack(selfish, 'fish'), 'fish dislike must not match selfish');
}

function assertJamaicanFestivalSlotFilter(): void {
  const fixturePath = path.join(mobileRoot, 'test-fixtures/meal-picker-mealdb-slot-filter.json');
  const fixtureRows = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    idMeal: string;
    strMeal: string;
    strCategory: string;
  }[];

  for (const row of fixtureRows) {
    const recipe = mealDbMealToAppRecipe({
      idMeal: row.idMeal,
      strMeal: row.strMeal,
      strCategory: row.strCategory,
      strMealThumb: 'https://example.com/thumb.jpg',
      strInstructions: 'Cook.',
      strIngredient1: 'salt',
      strMeasure1: '1 tsp',
    });
    if (row.strMeal.includes('Jamaican Festival')) {
      assert.ok(!recipeSuitsMealPickerSlot(recipe, 'lunch'), 'festival blocked from lunch');
      assert.ok(!recipeSuitsMealPickerSlot(recipe, 'dinner'), 'festival blocked from dinner');
    }
    if (row.strMeal === 'Pierogi (cooked)') {
      assert.ok(recipeSuitsMealPickerSlot(recipe, 'dinner'), 'savory dumplings still allowed at dinner');
    }
  }
}

function assertIncrementalPantryMatchPerf(): void {
  const pantry = [
    {
      id: 'p1',
      ingredientId: 'salt',
      name: 'salt',
      quantity: 1,
      unit: 'tsp',
      category: 'spices',
      location: 'pantry',
      photoUri: null,
      expiresOn: null,
      updatedAt: new Date().toISOString(),
    },
  ];
  const stubs: Recipe[] = [];
  for (let i = 0; i < 320; i += 1) {
    stubs.push(
      kitchenRecipe({
        id: `mealdb-stub-${i}`,
        name: `Stub recipe ${i}`,
        tag: 'Chicken',
        ingredients: [
          { ingredientId: `ing-${i}`, name: `ingredient-${i}`, quantity: 1, unit: 'cup' },
        ],
      }),
    );
  }

  const initial = buildPantryMatchIndex(stubs, pantry);
  const cached = updatePantryMatchIndex(initial, null, stubs, pantry);
  const withOneMore = [
    ...stubs,
    kitchenRecipe({
      id: 'mealdb-stub-new',
      name: 'Stub recipe new',
      tag: 'Chicken',
      ingredients: [
        { ingredientId: 'ing-new', name: 'ingredient-new', quantity: 1, unit: 'cup' },
      ],
    }),
  ];

  const t0 = performance.now();
  const merged = updatePantryMatchIndex(cached.index, cached.fingerprints, withOneMore, pantry);
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 400, `incremental pantry merge should stay fast (${elapsed.toFixed(1)}ms)`);
  assert.equal(merged.index.ranked.length, withOneMore.length);
  assert.ok(merged.index.byRecipeId.has('mealdb-stub-new'));
}

function assertAuthChromeSourceGuards(): void {
  const headerSource = fs.readFileSync(path.join(mobileRoot, 'components/AppHeader.tsx'), 'utf8');
  assert.match(headerSource, /accountChromeReady/);
  assert.match(headerSource, /hasLikelyStoredAuthSession/);
  assert.match(headerSource, /resolveAccountHeaderAccessibilityLabel/);
  const indexSource = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/index.tsx'), 'utf8');
  assert.match(indexSource, /profileReady && pantry\.length === 0/);
  const pickerSource = fs.readFileSync(
    path.join(mobileRoot, 'lib/mealCalendar/recipePickerOptions.ts'),
    'utf8',
  );
  assert.match(pickerSource, /shouldHideRecipeForDietPrefs/);
}

async function runReturningUserAuthChromePlaywright(): Promise<void> {
  const distIndex = path.join(mobileRoot, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.log('home-qa6-check: skip Playwright auth chrome (no dist export; run export:web first)');
    return;
  }

  const userId = 'home-qa6-returning-user';
  const profile = {
    id: userId,
    email: 'returning@example.com',
    name: 'Returning User',
    role: 'member' as const,
    plan: 'plus' as const,
    photoUrl: null,
    householdSize: 2,
    dietaryNotes: '',
    createdAt: new Date().toISOString(),
    preferences: {
      autoAddMissingToGrocery: true,
      addCheckedItemsToPantry: true,
      shareScanPhotoForTraining: false,
    },
  };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript(
    ({ uid, prof }) => {
      const authKey = 'sb-localhost-auth-token';
      localStorage.setItem(
        authKey,
        JSON.stringify({
          currentSession: { user: { id: uid, email: prof.email } },
          user: { id: uid, email: prof.email },
        }),
      );
      localStorage.setItem('mealprep.lastAccountUserId', uid);
      localStorage.setItem(
        `mealprep.accountKitchenCache.${uid}`,
        JSON.stringify({
          userId: uid,
          savedAt: new Date().toISOString(),
          profile: prof,
          pantry: [
            {
              id: 'p1',
              ingredientId: 'rice',
              name: 'Rice',
              category: 'dry_goods',
              quantity: 2,
              unit: 'lb',
              location: 'pantry',
              photoUri: null,
              expiresOn: null,
              updatedAt: new Date().toISOString(),
            },
          ],
          grocery: [],
          mealPlan: [],
          recipes: [],
        }),
      );
    },
    { uid: userId, prof: profile },
  );

  const page = await context.newPage();
  await page.route('**/pwa-register.js', (route) => route.abort());
  const fileUrl = `file://${distIndex}`;
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  const signInLabel = ACCOUNT_HEADER_COPY.avatarAccessibilityLabelGuest;
  for (let i = 0; i < 8; i += 1) {
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    if (!text.includes(signInLabel)) break;
    await page.waitForTimeout(250);
  }
  const finalText = await page.evaluate(() => document.body?.innerText ?? '');
  assert.ok(
    !finalText.includes(signInLabel),
    'returning user with stored session must not keep guest Sign-in chrome',
  );

  await browser.close();
}

async function main(): Promise<void> {
  assertPickerHidesBrowsedBreakfastConflicts();
  assertCreatorSingularMushroom();
  assertJamaicanFestivalSlotFilter();
  assertIncrementalPantryMatchPerf();
  assertAuthChromeSourceGuards();
  await runReturningUserAuthChromePlaywright();
  console.log('home-qa6-check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
