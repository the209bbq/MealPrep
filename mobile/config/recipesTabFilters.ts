import type { PantryItem, Recipe } from '../types/mealprep';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';
import type { RecipePantryMatch } from '../lib/recipeMatch';

/** User-facing meal buckets for the Recipes tab (kitchen + discovery). */
export type RecipesTabMealCategory =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'soup'
  | 'dessert'
  | 'side';

export type RecipesTabQuickFilterId = 'can_make_now' | 'missing_1_2' | 'under_30';

export type RecipesTabSheetFilterId =
  | `meal:${RecipesTabMealCategory}`
  | `time:max_${number}`
  | `protein:${string}`;

export type RecipesTabFilterId = RecipesTabQuickFilterId | RecipesTabSheetFilterId;

export const RECIPES_TAB_FILTERS_STORAGE_KEY = 'mealprep.recipesTab.activeFilters';

export const RECIPES_TAB_FILTER_COPY = {
  filtersButton: 'Filters',
  clearAll: 'Clear filters',
  emptyTitle: 'No recipes match these filters',
  emptyBody: 'Try removing a filter or tap below to start over.',
  quick: {
    can_make_now: 'Can make now',
    missing_1_2: 'Missing 1–2',
    under_30: 'Under 30 min',
  } satisfies Record<RecipesTabQuickFilterId, string>,
  sheet: {
    mealTypes: 'Meal type',
    time: 'Total time',
    pantryProtein: 'Uses from pantry',
    underMinutes: (minutes: number) => `≤ ${minutes} min`,
  },
  mealLabels: {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    soup: 'Soup',
    dessert: 'Dessert',
    side: 'Side',
  } satisfies Record<RecipesTabMealCategory, string>,
} as const;

export const RECIPES_TAB_QUICK_FILTER_IDS: RecipesTabQuickFilterId[] = [
  'can_make_now',
  'missing_1_2',
  'under_30',
];

export const RECIPES_TAB_TIME_FILTER_MINUTES = [45, 60] as const;

export interface RecipesTabKitchenRow {
  kind: 'kitchen';
  recipe: Recipe;
  match: RecipePantryMatch;
}

export interface RecipesTabDiscoveryRow {
  kind: 'discovery';
  recipe: RecipeDiscoveryListItem;
  match: RecipePantryMatch;
}

export type RecipesTabRow = RecipesTabKitchenRow | RecipesTabDiscoveryRow;

export function recipesTabRowMinutes(row: RecipesTabRow): number {
  if (row.kind === 'kitchen') return row.recipe.minutes;
  return Math.max(1, (row.recipe.prep_time ?? 0) + (row.recipe.cook_time ?? 0));
}

const MEAL_KEYWORDS: { category: RecipesTabMealCategory; pattern: RegExp }[] = [
  { category: 'breakfast', pattern: /\b(breakfast|brunch|oatmeal|pancakes?|waffles?|omelettes?|omelets?|french toast)\b/i },
  { category: 'lunch', pattern: /\b(lunch|sandwich|wrap|salad bowl)\b/i },
  { category: 'dinner', pattern: /\b(dinner|supper|roast|casserole|stir[- ]?fry)\b/i },
  { category: 'snack', pattern: /\b(snack|bite|appetizer|appetiser)\b/i },
  { category: 'soup', pattern: /\b(soup|stew|chili|chowder|broth)\b/i },
  { category: 'dessert', pattern: /\b(dessert|cookie|brownie|cake|pie|pudding)\b/i },
  { category: 'side', pattern: /\b(side dish|side|slaw|coleslaw)\b/i },
];

function apiMealTypeToCategory(mealType: string | undefined | null): RecipesTabMealCategory | null {
  if (!mealType) return null;
  const normalized = mealType.toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'breakfast':
    case 'brunch':
      return 'breakfast';
    case 'snack':
      return 'snack';
    case 'soup':
      return 'soup';
    case 'dessert':
      return 'dessert';
    case 'side_dish':
    case 'starter':
    case 'appetizer':
      return 'side';
    case 'main':
      return 'dinner';
    default:
      return null;
  }
}

export function inferKitchenMealCategory(recipe: Recipe): RecipesTabMealCategory | null {
  const haystack = `${recipe.name} ${recipe.description} ${recipe.tag}`;
  for (const { category, pattern } of MEAL_KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return null;
}

export function recipesTabRowMealCategory(row: RecipesTabRow): RecipesTabMealCategory | null {
  if (row.kind === 'discovery') {
    const fromApi = apiMealTypeToCategory(row.recipe.meal_type);
    if (fromApi) return fromApi;
    return inferKitchenMealCategory({
      id: row.recipe.id.toString(),
      name: row.recipe.name,
      tag: row.recipe.cuisine,
      description: row.recipe.description,
      servings: row.recipe.servings,
      minutes: recipesTabRowMinutes(row),
      calories: row.recipe.calories_per_serving,
      protein: row.recipe.protein,
      carbs: row.recipe.carbs ?? 0,
      fat: row.recipe.fat ?? 0,
      ingredients: [],
      steps: [],
      isMaster: false,
      createdAt: '',
    });
  }
  return inferKitchenMealCategory(row.recipe);
}

function rowUsesPantryProtein(row: RecipesTabRow, pantryItemId: string): boolean {
  return row.match.matched.some((m) => m.matchedPantryItem?.id === pantryItemId);
}

function testFilterId(row: RecipesTabRow, filterId: RecipesTabFilterId): boolean {
  if (filterId === 'can_make_now') return row.match.missingCount === 0;
  if (filterId === 'missing_1_2') return row.match.missingCount >= 1 && row.match.missingCount <= 2;
  if (filterId === 'under_30') return recipesTabRowMinutes(row) <= 30;

  if (filterId.startsWith('meal:')) {
    const category = filterId.slice('meal:'.length) as RecipesTabMealCategory;
    return recipesTabRowMealCategory(row) === category;
  }

  if (filterId.startsWith('time:max_')) {
    const max = Number.parseInt(filterId.slice('time:max_'.length), 10);
    if (Number.isNaN(max)) return true;
    return recipesTabRowMinutes(row) <= max;
  }

  if (filterId.startsWith('protein:')) {
    const pantryItemId = filterId.slice('protein:'.length);
    return rowUsesPantryProtein(row, pantryItemId);
  }

  return true;
}

export function recipesTabFiltersActive(activeIds: readonly RecipesTabFilterId[]): boolean {
  return activeIds.length > 0;
}

export function applyRecipesTabFilters<T extends RecipesTabRow>(
  rows: T[],
  activeIds: readonly RecipesTabFilterId[],
): T[] {
  if (activeIds.length === 0) return rows;
  return rows.filter((row) => activeIds.every((id) => testFilterId(row, id)));
}

export function countRecipesTabFilterMatches(
  rows: readonly RecipesTabRow[],
  filterId: RecipesTabFilterId,
  activeIds: readonly RecipesTabFilterId[],
): number {
  const other = activeIds.filter((id) => id !== filterId);
  const pool = applyRecipesTabFilters([...rows], other);
  return pool.filter((row) => testFilterId(row, filterId)).length;
}

export function pantryProteinFilterCandidates(
  pantry: PantryItem[],
  rows: readonly RecipesTabRow[],
): PantryItem[] {
  const proteinCategories = new Set<PantryItem['category']>(['meats']);
  const candidates = pantry.filter((item) => proteinCategories.has(item.category));
  return candidates.filter((item) =>
    rows.some((row) => rowUsesPantryProtein(row, item.id)),
  );
}

export function mealCategoryFilterCandidates(
  rows: readonly RecipesTabRow[],
): RecipesTabMealCategory[] {
  const seen = new Set<RecipesTabMealCategory>();
  for (const row of rows) {
    const category = recipesTabRowMealCategory(row);
    if (category) seen.add(category);
  }
  const order: RecipesTabMealCategory[] = [
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'soup',
    'side',
    'dessert',
  ];
  return order.filter((c) => seen.has(c));
}

export function toggleRecipesTabFilter(
  activeIds: readonly RecipesTabFilterId[],
  filterId: RecipesTabFilterId,
): RecipesTabFilterId[] {
  if (activeIds.includes(filterId)) {
    return activeIds.filter((id) => id !== filterId);
  }
  return [...activeIds, filterId];
}

export function clearRecipesTabFilters(): RecipesTabFilterId[] {
  return [];
}

export function parseStoredRecipesTabFilters(raw: unknown): RecipesTabFilterId[] {
  if (!Array.isArray(raw)) return [];
  const allowedQuick = new Set<string>(RECIPES_TAB_QUICK_FILTER_IDS);
  const out: RecipesTabFilterId[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    if (allowedQuick.has(entry)) {
      out.push(entry as RecipesTabQuickFilterId);
      continue;
    }
    if (entry.startsWith('meal:')) {
      const cat = entry.slice(5) as RecipesTabMealCategory;
      if (cat in RECIPES_TAB_FILTER_COPY.mealLabels) out.push(entry as RecipesTabSheetFilterId);
      continue;
    }
    if (entry.startsWith('time:max_')) {
      const n = Number.parseInt(entry.slice('time:max_'.length), 10);
      if (!Number.isNaN(n) && n > 0) out.push(entry as RecipesTabSheetFilterId);
      continue;
    }
    if (entry.startsWith('protein:') && entry.length > 'protein:'.length) {
      out.push(entry as RecipesTabSheetFilterId);
    }
  }
  return out;
}
