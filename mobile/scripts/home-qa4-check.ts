/**
 * Home QA round 4 (R4-1–R4-5): slot filter, breakfast, dinner blocking, lookup scheduler, dan dan.
 * Run from mobile/: npm run test:home-qa4
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Recipe } from '../types/mealprep';
import { PEANUT_DISH_NAME_STRONG } from '../config/dietRules';
import { recipeSuitsMealPickerSlot } from '../lib/mealCalendar/mealPickerSlotFilter';
import { mealDbCategoryFromRecipeTag } from '../lib/recipesTab/categoryDiet';
import { mealDbMealToAppRecipe } from '../lib/mealdb/normalize';
import type { MealDbMealDetail } from '../lib/mealdb/types';
import {
  fetchMealDbLookupWithRetries,
  resetMealDbLookupSchedulerForTests,
  runMealDbLookupTask,
} from '../lib/mealdb/lookupScheduler';
import { resetMealDbClientCacheForTests } from '../lib/mealdb/client';

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

  const lunchDinnerExcluded = [
    'Baklava',
    'Apple & Blackberry Crumble',
    'Chelsea Buns',
    'Affogato (Italian Coffee Dessert)',
    'Æbleskiver',
    'Boterkoek',
    'Bajan Sweet Bread',
    'Blini Pancakes',
    'Challah',
    'Ají de Aguacate',
    'Chilean-Style Sopaipillas',
    'Colombian Buñuelos',
  ];
  const dinnerAllowed = [
    'Fish pie',
    'Cumberland Pie',
    'Creamy Mustard Chicken',
    'Pork Chops in Creole Sauce',
    'Egg Foo Young',
    'Pollo en Salsa',
    'Tahini Lentils',
    'Falafel Pita Sandwich with Tahini Sauce',
    'Beef Banh Mi Bowls with Sriracha Mayo',
    'Clam chowder',
    'Pierogi (cooked)',
  ];
  const breakfastIncluded = ['Blini Pancakes', 'Boxty Breakfast'];

  for (const row of fixtureRows) {
    const recipe = mealFromFixture(row);
    const suitsDinner = recipeSuitsMealPickerSlot(recipe, 'dinner');
    const suitsLunch = recipeSuitsMealPickerSlot(recipe, 'lunch');
    const suitsBreakfast = recipeSuitsMealPickerSlot(recipe, 'breakfast');
    if (lunchDinnerExcluded.includes(row.strMeal)) {
      assert.ok(!suitsDinner, `${row.strMeal} must not suit dinner`);
      assert.ok(!suitsLunch, `${row.strMeal} must not suit lunch`);
    }
    if (dinnerAllowed.includes(row.strMeal)) {
      assert.ok(suitsDinner, `${row.strMeal} must suit dinner`);
      assert.ok(suitsLunch, `${row.strMeal} must suit lunch`);
    }
    if (breakfastIncluded.includes(row.strMeal)) {
      assert.ok(suitsBreakfast, `${row.strMeal} must suit breakfast`);
    }
  }

  const affogatoImport = kitchenRecipe({
    id: 'kitchen-affogato',
    name: 'Affogato (Italian Coffee Dessert)',
    tag: 'italian · dessert · easy',
    sourceType: 'import',
  });
  assert.equal(
    mealDbCategoryFromRecipeTag(affogatoImport.tag, {
      recipeId: affogatoImport.id,
      sourceType: affogatoImport.sourceType,
    }),
    'Dessert',
  );
  assert.ok(!recipeSuitsMealPickerSlot(affogatoImport, 'dinner'), 'import dessert tag must block dinner');
  assert.ok(!recipeSuitsMealPickerSlot(affogatoImport, 'lunch'), 'import dessert tag must block lunch');

  const beetrootPancakes = kitchenRecipe({
    id: 'mealdb-beet',
    name: 'Beetroot pancakes',
    tag: 'Vegetarian',
    sourceType: 'themealdb',
  });
  assert.ok(recipeSuitsMealPickerSlot(beetrootPancakes, 'breakfast'), 'title fallback breakfast');

  const aebleskiverLigature = kitchenRecipe({
    id: 'import-aebleskiver',
    name: 'Æbleskiver',
    tag: 'Imported · YouTube',
    sourceType: 'import',
  });
  assert.ok(!recipeSuitsMealPickerSlot(aebleskiverLigature, 'dinner'), 'Æ ligature dessert block');

  assert.ok(PEANUT_DISH_NAME_STRONG.includes('dan dan'));
  assert.ok(PEANUT_DISH_NAME_STRONG.includes('dandan'));

  resetMealDbLookupSchedulerForTests();
  resetMealDbClientCacheForTests();

  let inFlight = 0;
  let maxInFlight = 0;
  let attempts = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 30));
    inFlight -= 1;
    attempts += 1;
    return { ok: false, json: async () => null } as Response;
  }) as typeof fetch;

  const result = await fetchMealDbLookupWithRetries('background', async () => {
    const response = await fetch('https://example.com/lookup.php?i=1');
    if (!response.ok) return null;
    return null;
  });
  assert.equal(result, null);
  assert.equal(attempts, 5, 'lookup should attempt five times (four retry delays)');

  inFlight = 0;
  maxInFlight = 0;
  const jobs = Array.from({ length: 8 }, (_, index) =>
    runMealDbLookupTask('background', async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 40));
      inFlight -= 1;
      return index;
    }),
  );
  await Promise.all(jobs);
  assert.ok(maxInFlight <= 4, `scheduler max in flight should be 4, saw ${maxInFlight}`);

  globalThis.fetch = originalFetch;
  resetMealDbLookupSchedulerForTests();

  const categoriesSource = fs.readFileSync(path.join(mobileRoot, 'lib/mealdb/categories.ts'), 'utf8');
  assert.match(categoriesSource, /onFailed:/);
  assert.match(categoriesSource, /userVisibleLookups/);

  const prefetchSource = fs.readFileSync(path.join(mobileRoot, 'lib/mealdb/homePrefetch.ts'), 'utf8');
  assert.match(prefetchSource, /userVisibleLookups:\s*false/);

  const hubSheet = fs.readFileSync(path.join(mobileRoot, 'components/home/HomeHubSheet.tsx'), 'utf8');
  assert.match(hubSheet, /if \(!visible\) return null/);
  assert.match(hubSheet, /onToggleSave/);

  const undoToast = fs.readFileSync(path.join(mobileRoot, 'components/UndoToast.tsx'), 'utf8');
  assert.match(undoToast, /accessibilityRole="button"/);
  assert.match(undoToast, /<Modal visible transparent/);

  const scheduleCtx = fs.readFileSync(
    path.join(mobileRoot, 'context/ScheduleRecipeSheetContext.tsx'),
    'utf8',
  );
  assert.match(scheduleCtx, /useHydrated/);

  console.log('home-qa4-check: ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
