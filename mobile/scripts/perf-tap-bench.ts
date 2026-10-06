/**
 * Home tap CPU micro-benchmark (Node): ranking, diet filter, pantry catalog incremental path.
 * Run from mobile/: npm run perf:tap
 */
import { performance } from 'node:perf_hooks';
import { DEFAULT_RECIPES_TAB_FILTER_STATE } from '../config/recipesTabFilters';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import type { UserDietPrefs } from '../lib/diet/types';
import { filterRecipesTabRowsForDietPrefs } from '../lib/diet/filterRows';
import { countPassingRecipesForCategoryFromRows } from '../lib/mealdb/categories';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../lib/recipeMatch';
import { getPantryMatchContext } from '../lib/recipeMatch/pantryMatchContext';
import { mealDbMealToAppRecipe } from '../lib/mealdb/normalize';
import type { MealDbMealDetail } from '../lib/mealdb/types';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import {
  emptyEngagementIndexForGhost,
  rankRecipesTabRows,
  wontCookRefKeys,
  type RecipeRankingContext,
} from '../lib/recipeRanking';
import type { PantryItem, RecipeIngredient } from '../types/mealprep';

const require = createRequire(fileURLToPath(import.meta.url));

type CatalogRowBuilderCtor = new (pantry: PantryItem[]) => {
  appendMeal: (meal: MealDbMealDetail) => RecipesTabRow[];
  getRows: () => RecipesTabRow[];
};

const MealDbCatalogRowBuilder = (() => {
  try {
    return require('../lib/mealdb/incrementalCatalogRows')
      .MealDbCatalogRowBuilder as CatalogRowBuilderCtor;
  } catch {
    return null;
  }
})();

function clearOptionalPerfCaches(): void {
  try {
    require('../lib/recipeRanking/scoreCache').clearRecipeRankingScoreCacheForTests();
  } catch {
    // score cache added in perf fix branch
  }
  try {
    require('../lib/diet/conflicts').clearRecipeDietTagCacheForTests();
  } catch {
    // diet tag cache added in perf fix branch
  }
  try {
    require('../lib/diet/allergenMatch').clearPhraseRegexCacheForTests();
  } catch {
    // phrase regex cache added in perf fix branch
  }
}

const INGREDIENT_POOL = [
  'beef chuck',
  'chicken breast',
  'onion',
  'garlic',
  'tomato',
  'rice',
  'cheddar cheese',
  'mushrooms',
  'peanut butter',
  'soy sauce',
  'bell pepper',
  'olive oil',
  'salt',
  'black pepper',
  'butter',
  'flour',
  'milk',
  'egg',
  'carrot',
  'celery',
  'potato',
  'broccoli',
  'spinach',
  'lemon juice',
  'honey',
  'ginger',
  'cilantro',
  'lime',
  'coconut milk',
  'curry powder',
];

const CATEGORIES = ['Beef', 'Chicken', 'Pork', 'Vegetarian', 'Seafood', 'Pasta'];

function pantryFixture(): PantryItem[] {
  const names = [
    'beef chuck',
    'chicken breast',
    'onion',
    'garlic',
    'tomato',
    'rice',
    'cheddar',
    'bell pepper',
    'olive oil',
    'butter',
    'flour',
    'milk',
    'egg',
    'carrot',
    'potato',
    'broccoli',
    'spinach',
    'lemon',
    'honey',
    'ginger',
    'cilantro',
    'lime',
    'coconut milk',
    'curry powder',
    'soy sauce',
    'black pepper',
    'salt',
    'celery',
    'broccoli crown',
    'jasmine rice',
  ];
  return names.map((name, index) => ({
    id: `pantry-${index}`,
    ingredientId: name.replace(/\s+/g, '-'),
    name,
    category: 'produce' as const,
    quantity: 2,
    unit: 'each',
    storageLocation: 'pantry' as const,
    updatedAt: new Date(0).toISOString(),
  }));
}

function syntheticMeal(index: number): MealDbMealDetail {
  const category = CATEGORIES[index % CATEGORIES.length]!;
  const ingredients: RecipeIngredient[] = [];
  for (let slot = 0; slot < 8; slot += 1) {
    const name = INGREDIENT_POOL[(index * 3 + slot) % INGREDIENT_POOL.length]!;
    ingredients.push({
      ingredientId: `ing-${index}-${slot}`,
      name,
      quantity: 1 + (slot % 3),
      unit: 'cup',
    });
  }
  const id = String(52000 + index);
  const detail: MealDbMealDetail = {
    idMeal: id,
    strMeal: `Synthetic meal ${index} ${category}`,
    strCategory: category,
    strArea: 'American',
    strInstructions: 'Cook and serve.',
    strMealThumb: 'https://example.com/thumb.jpg',
    strTags: null,
    strYoutube: null,
    strSource: null,
  };
  for (let slot = 0; slot < ingredients.length; slot += 1) {
    const key = slot + 1;
    (detail as Record<string, string | null>)[`strIngredient${key}`] = ingredients[slot]!.name;
    (detail as Record<string, string | null>)[`strMeasure${key}`] = `${ingredients[slot]!.quantity} cup`;
  }
  return detail;
}

/** Pre-fix catalogFeed path: re-score and sort the full accumulator on every meal. */
function rowsFromMealsLegacy(meals: MealDbMealDetail[], pantry: PantryItem[]): RecipesTabRow[] {
  const context = getPantryMatchContext(pantry);
  const rows: RecipesTabRow[] = meals.map((meal) => {
    const recipe = mealDbMealToAppRecipe(meal);
    return {
      kind: 'kitchen' as const,
      recipe,
      match: scoreRecipeAgainstPantry(recipe, pantry, context),
    };
  });
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}

function buildCategoryRows(mealCount: number, pantry: PantryItem[]) {
  const meals: MealDbMealDetail[] = [];
  for (let index = 0; index < mealCount; index += 1) {
    meals.push(syntheticMeal(index));
  }
  if (MealDbCatalogRowBuilder) {
    const builder = new MealDbCatalogRowBuilder(pantry);
    for (const meal of meals) {
      builder.appendMeal(meal);
    }
    return { rows: builder.getRows(), meals };
  }
  return { rows: rowsFromMealsLegacy(meals, pantry), meals };
}

function dietPrefsFixture(): UserDietPrefs {
  return {
    ...DEFAULT_USER_DIET_PREFS,
    hideConflicts: true,
    allergens: ['peanuts'],
    dislikes: ['mushroom'],
  };
}

function rankingContext(ownerId: string, dietPrefs: UserDietPrefs): RecipeRankingContext {
  return {
    dietPrefs,
    householdSize: 4,
    tabFilters: DEFAULT_RECIPES_TAB_FILTER_STATE,
    events: [],
    pricing: { ownerId: ownerId, communityDeals: [] },
    engagementIndex: emptyEngagementIndexForGhost(),
    personalSignalsReady: false,
  };
}

function runHomePipeline(
  rows: ReturnType<typeof buildCategoryRows>['rows'],
  dietPrefs: UserDietPrefs,
  ctx: RecipeRankingContext,
) {
  const diet = filterRecipesTabRowsForDietPrefs(rows, dietPrefs);
  const ranked = rankRecipesTabRows(diet, ctx);
  const wont = wontCookRefKeys(ctx.events);
  const beefCount = countPassingRecipesForCategoryFromRows('Beef', rows, dietPrefs, wont);
  const chickenCount = countPassingRecipesForCategoryFromRows('Chicken', rows, dietPrefs, wont);
  return { ranked, beefCount, chickenCount };
}

function benchMs(label: string, iterations: number, fn: () => void): number {
  for (let warmup = 0; warmup < 2; warmup += 1) fn();
  clearOptionalPerfCaches();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) fn();
  const elapsed = performance.now() - start;
  const perRun = elapsed / iterations;
  console.log(`${label}: ${perRun.toFixed(2)} ms (avg of ${iterations} runs, total ${elapsed.toFixed(1)} ms)`);
  return perRun;
}

function simulateCategoryArrivalsLegacy(meals: MealDbMealDetail[], pantry: PantryItem[]): number {
  const acc: MealDbMealDetail[] = [];
  const start = performance.now();
  for (const meal of meals) {
    acc.push(meal);
    rowsFromMealsLegacy(acc, pantry);
  }
  return performance.now() - start;
}

function simulateCategoryArrivalsIncremental(meals: MealDbMealDetail[], pantry: PantryItem[]): number | null {
  if (!MealDbCatalogRowBuilder) return null;
  const builder = new MealDbCatalogRowBuilder(pantry);
  const start = performance.now();
  for (const meal of meals) {
    builder.appendMeal(meal);
    builder.getRows();
  }
  return performance.now() - start;
}

const pantry = pantryFixture();
const dietPrefs = dietPrefsFixture();
const ctx = rankingContext('bench-user', dietPrefs);
const { rows, meals } = buildCategoryRows(300, pantry);

console.log('MealPlanatic Home tap bench (Node 20)');
console.log(`Fixture: ${rows.length} kitchen rows, pantry items ${pantry.length}`);
console.log('');

benchMs('full_home_pipeline', 8, () => {
  runHomePipeline(rows, dietPrefs, ctx);
});

{
  clearOptionalPerfCaches();
  runHomePipeline(rows, dietPrefs, ctx);
  const start = performance.now();
  const iterations = 12;
  for (let index = 0; index < iterations; index += 1) {
    runHomePipeline(rows, dietPrefs, ctx);
  }
  const elapsed = performance.now() - start;
  console.log(
    `rerender_unchanged_inputs: ${(elapsed / iterations).toFixed(2)} ms (avg of ${iterations} runs after warm caches, total ${elapsed.toFixed(1)} ms)`,
  );
}

const arrivalSample = meals.slice(0, 96);
const legacyArrivalMs = simulateCategoryArrivalsLegacy(arrivalSample, pantry);
const incrementalArrivalMs = simulateCategoryArrivalsIncremental(arrivalSample, pantry);
console.log(
  `category_arrival_legacy_96_meals: ${legacyArrivalMs.toFixed(2)} ms (re-score all on each arrival)`,
);
if (incrementalArrivalMs != null) {
  console.log(
    `category_arrival_incremental_96_meals: ${incrementalArrivalMs.toFixed(2)} ms (score once per meal)`,
  );
}
