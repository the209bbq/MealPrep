/**
 * Home QA round 3 (R3-1–R3-6): meal picker, creator allergen, search bubbles, stable rank, offline.
 * Run from mobile/: npm run test:home-qa3
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Recipe } from '../types/mealprep';
import type { UserDietPrefs } from '../lib/diet/types';
import type { CreatorFeedCardModel } from '../lib/recipes/creatorFeedRows';
import { recipeSuitsMealPickerSlot } from '../lib/mealCalendar/mealPickerSlotFilter';
import {
  buildMealPickerRecipeOptions,
  canonicalMealPickerRecipeKey,
} from '../lib/mealCalendar/recipePickerOptions';
import { mealDbMealToAppRecipe } from '../lib/mealdb/normalize';
import type { MealDbMealDetail } from '../lib/mealdb/types';
import {
  shouldHideCreatorDescriptionForDietPrefs,
  shouldHideCreatorModelForDietPrefs,
} from '../lib/diet/creatorAllergenCheck';
import { fetchMealDbCategoryFeedRows } from '../lib/mealdb/categories';
import { kitchenCategoryRowsAvailableOffline } from '../lib/mealdb/offlineCategoryRows';
import { recipesTabRowsFromFilterSummaries } from '../lib/mealdb/categoryStubRows';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

async function withStubNavigatorOffline<T>(fn: () => Promise<T>): Promise<T> {
  const key = 'navigator';
  const hadNavigator = Object.prototype.hasOwnProperty.call(globalThis, key);
  const previous = hadNavigator ? (globalThis as { navigator?: Navigator }).navigator : undefined;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: { onLine: false },
  });
  try {
    return await fn();
  } finally {
    if (hadNavigator) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: previous,
      });
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
}

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

function mealFromFixture(row: { idMeal: string; strMeal: string; strCategory: string }): Recipe {
  const detail: MealDbMealDetail = {
    idMeal: row.idMeal,
    strMeal: row.strMeal,
    strCategory: row.strCategory,
    strMealThumb: 'https://example.com/thumb.jpg',
    strInstructions: 'Cook.',
    strIngredient1: 'salt',
    strMeasure1: '1 tsp',
  };
  return mealDbMealToAppRecipe(detail);
}

async function main(): Promise<void> {
  const fixturePath = path.join(mobileRoot, 'test-fixtures/meal-picker-mealdb-slot-filter.json');
  const fixtureRows = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    idMeal: string;
    strMeal: string;
    strCategory: string;
  }[];

  const dinnerExcluded = [
    'Baklava',
    'Apple & Blackberry Crumble',
    'Chelsea Buns',
    'Affogato (Italian Coffee Dessert)',
    'Æbleskiver',
    'Boterkoek',
    'Bajan Sweet Bread',
  ];
  const dinnerAllowed = [
    'Fish pie',
    'Cumberland Pie',
    'Creamy Mustard Chicken',
    'Pork Chops in Creole Sauce',
    'Egg Foo Young',
  ];

  for (const row of fixtureRows) {
    const recipe = mealFromFixture(row);
    const suitsDinner = recipeSuitsMealPickerSlot(recipe, 'dinner');
    const suitsLunch = recipeSuitsMealPickerSlot(recipe, 'lunch');
    if (dinnerExcluded.includes(row.strMeal)) {
      assert.ok(!suitsDinner, `${row.strMeal} must not suit dinner`);
      assert.ok(!suitsLunch, `${row.strMeal} must not suit lunch`);
    }
    if (dinnerAllowed.includes(row.strMeal)) {
      assert.ok(suitsDinner, `${row.strMeal} must suit dinner`);
      assert.ok(suitsLunch, `${row.strMeal} must suit lunch`);
    }
  }

  const danishDessertTag = kitchenRecipe({
    id: 'mealdb-aebleskiver',
    name: 'Æbleskiver',
    tag: 'Danish · Dessert',
  });
  assert.ok(!recipeSuitsMealPickerSlot(danishDessertTag, 'dinner'), 'Danish · Dessert tag must exclude dinner');

  const duplicateA = kitchenRecipe({ id: 'kitchen-abc', name: 'One-Pan Golden Butter Chicken', tag: 'Chicken' });
  const duplicateB = kitchenRecipe({
    id: 'mealdb-999',
    name: 'One-Pan Golden Butter Chicken',
    tag: 'Chicken',
  });
  assert.equal(
    canonicalMealPickerRecipeKey(duplicateA),
    canonicalMealPickerRecipeKey(duplicateB),
    'dedupe keys should align for same titled mealdb vs kitchen rows',
  );

  const dedupedPicker = buildMealPickerRecipeOptions(
    [duplicateA, duplicateB],
    [],
    20,
    new Set([duplicateA.id]),
    [],
    { mealSlot: 'dinner' },
  );
  assert.equal(
    dedupedPicker.filter((row) => row.title === 'One-Pan Golden Butter Chicken').length,
    1,
    'picker should not list the same recipe twice',
  );

  const peanutPrefs: UserDietPrefs = {
    diets: [],
    allergens: ['peanuts'],
    dislikes: [],
    hideConflicts: true,
  };

  const satayModel = {
    videoId: 'satay',
    item: { videoId: 'satay', title: 'Satay Chicken Legs with Peanut Sauce', channelTitle: 'Chef' },
    video: {
      videoId: 'satay',
      title: 'Satay Chicken Legs with Peanut Sauce',
      descriptionSnippet: 'Grilled chicken with sauce.',
      channelId: 'ch',
      channelTitle: 'Chef',
      publishedAt: '',
      thumbnailUrl: '',
    },
    importedRecipe: null,
  } as CreatorFeedCardModel;
  assert.ok(shouldHideCreatorModelForDietPrefs(peanutPrefs, satayModel), 'satay title hidden');

  assert.ok(
    shouldHideCreatorDescriptionForDietPrefs(peanutPrefs, 'Classic pad thai at home'),
    'pad thai in description hidden',
  );

  const quickDinnersModel = {
    videoId: 'quick',
    item: { videoId: 'quick', title: '1 Hour of Quick Dinners', channelTitle: 'Allrecipes' },
    video: {
      videoId: 'quick',
      title: '1 Hour of Quick Dinners',
      descriptionSnippet: 'Includes Air Fryer Bang Bang Salmon with sweet chili mayo.',
      channelId: 'ch',
      channelTitle: 'Allrecipes',
      publishedAt: '',
      thumbnailUrl: '',
    },
    importedRecipe: null,
  } as CreatorFeedCardModel;
  assert.ok(
    !shouldHideCreatorModelForDietPrefs(peanutPrefs, quickDinnersModel),
    'bang bang in description should not hide video',
  );

  const bangBangShrimp = {
    ...quickDinnersModel,
    videoId: 'bbs',
    item: { videoId: 'bbs', title: 'Bang Bang Shrimp', channelTitle: 'Chef' },
    video: {
      ...quickDinnersModel.video,
      videoId: 'bbs',
      title: 'Bang Bang Shrimp',
      descriptionSnippet: 'Crispy shrimp with chili mayo.',
    },
  } as CreatorFeedCardModel;
  assert.ok(shouldHideCreatorModelForDietPrefs(peanutPrefs, bangBangShrimp), 'bang bang title hidden');

  const rankingInputs = fs.readFileSync(
    path.join(mobileRoot, 'lib/recipeRanking/recipeInputs.ts'),
    'utf8',
  );
  assert.match(
    rankingInputs,
    /importedLines = model\.importedRecipe \? ingredientLinesFromRecipe/,
    'creator ranking must not re-filter title/description in hard exclude',
  );

  const homeIndex = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/index.tsx'), 'utf8');
  assert.match(homeIndex, /creatorsCatalogEnabled[\s\S]*!searching/);
  assert.match(
    homeIndex,
    /hasPendingStubs[\s\S]*return diet/,
    'category feed should skip ranking while stubs are pending',
  );

  const categoriesSource = fs.readFileSync(path.join(mobileRoot, 'lib/mealdb/categories.ts'), 'utf8');
  assert.match(categoriesSource, /if \(isOffline\(\)\)/);

  const feedHook = fs.readFileSync(path.join(mobileRoot, 'hooks/useClassicCategoryFeed.ts'), 'utf8');
  assert.match(feedHook, /addEventListener\('offline'/);

  const tabsLayout = fs.readFileSync(path.join(mobileRoot, 'app/(tabs)/_layout.tsx'), 'utf8');
  assert.ok(
    !/if \(!hydrated\)/.test(tabsLayout),
    'tabs layout should always mount Tabs (avoids React #419 Suspense fallback)',
  );

  await withStubNavigatorOffline(async () => {
    const offlineFetch = await fetchMealDbCategoryFeedRows('Vegan', [], {});
    assert.equal(offlineFetch.listFetchFailed, false);
    assert.equal(offlineFetch.offlineCategoryEmpty, true);
  });

  assert.equal(typeof kitchenCategoryRowsAvailableOffline, 'function');

  console.log('home-qa3-check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
