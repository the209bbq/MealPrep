import type { Recipe } from '../types/mealprep';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import {
  recipesTabDiscoveryDifficulty,
  recipesTabKitchenDifficulty,
  type RecipesTabDifficultyBucket,
} from './recipesTabFilterDifficulty';

export type RecipesTabTimeChoice = 'any' | '15' | '30' | '45' | '60';
export type RecipesTabDifficultyChoice = 'any' | RecipesTabDifficultyBucket;
export type RecipesTabMealChoice = 'any' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'side';
export type RecipesTabShopChoice = 'any' | 'pantry_only' | 'grab_1_2' | 'happy_to_shop';
export type RecipesTabPeopleChoice = 'any' | 'just_me' | 'two' | 'three_four' | 'five_plus';

export type RecipesTabFilterDimension =
  | 'time'
  | 'difficulty'
  | 'meal'
  | 'shop'
  | 'people';

export interface RecipesTabFilterState {
  time: RecipesTabTimeChoice;
  difficulty: RecipesTabDifficultyChoice;
  meal: RecipesTabMealChoice;
  shop: RecipesTabShopChoice;
  people: RecipesTabPeopleChoice;
}

export const DEFAULT_RECIPES_TAB_FILTER_STATE: RecipesTabFilterState = {
  time: 'any',
  difficulty: 'any',
  meal: 'any',
  shop: 'any',
  people: 'any',
};

export const RECIPES_TAB_FILTERS_STORAGE_KEY = 'mealprep.recipesTab.filterState';

export const RECIPES_TAB_PEOPLE_SERVINGS: Record<
  Exclude<RecipesTabPeopleChoice, 'any'>,
  number
> = {
  just_me: 1,
  two: 2,
  three_four: 4,
  five_plus: 6,
};

export const RECIPES_TAB_FILTER_COPY = {
  filterButton: 'Filter recipes',
  clear: 'Clear',
  clearFilters: 'Clear filters',
  emptyTitle: 'No recipes match these filters',
  emptyBody: 'Try removing a filter or tap below to start over.',
  questions: {
    time: 'How much time do you have?',
    difficulty: 'How hard do you want it to be?',
    meal: 'What meal is this for?',
    shop: 'Do you want to shop?',
    people: 'How many people are you feeding?',
  },
  options: {
    any: 'Any',
    time: {
      '15': '15 min or less',
      '30': '30 min or less',
      '45': '45 min or less',
      '60': '1 hour or less',
    } satisfies Record<Exclude<RecipesTabTimeChoice, 'any'>, string>,
    difficulty: {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Worth the effort',
    } satisfies Record<RecipesTabDifficultyBucket, string>,
    meal: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
      side: 'Side',
    } satisfies Record<Exclude<RecipesTabMealChoice, 'any'>, string>,
    shop: {
      pantry_only: 'Use only what I have',
      grab_1_2: 'Fine to grab 1–2 things',
      happy_to_shop: 'Happy to shop',
    } satisfies Record<Exclude<RecipesTabShopChoice, 'any'>, string>,
    people: {
      just_me: 'Just me',
      two: '2',
      three_four: '3–4',
      five_plus: '5+',
    } satisfies Record<Exclude<RecipesTabPeopleChoice, 'any'>, string>,
  },
} as const;

export const RECIPES_TAB_TIME_CHOICES: RecipesTabTimeChoice[] = ['any', '15', '30', '45', '60'];
export const RECIPES_TAB_DIFFICULTY_CHOICES: RecipesTabDifficultyChoice[] = [
  'any',
  'easy',
  'medium',
  'hard',
];
export const RECIPES_TAB_MEAL_CHOICES: RecipesTabMealChoice[] = [
  'any',
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'side',
];
export const RECIPES_TAB_SHOP_CHOICES: RecipesTabShopChoice[] = [
  'any',
  'pantry_only',
  'grab_1_2',
  'happy_to_shop',
];
export const RECIPES_TAB_PEOPLE_CHOICES: RecipesTabPeopleChoice[] = [
  'any',
  'just_me',
  'two',
  'three_four',
  'five_plus',
];

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

export function recipesTabRowDifficulty(row: RecipesTabRow): RecipesTabDifficultyBucket {
  if (row.kind === 'discovery') return recipesTabDiscoveryDifficulty(row.recipe);
  return recipesTabKitchenDifficulty(row.recipe);
}

export function recipesTabRowMinutes(row: RecipesTabRow): number {
  if (row.kind === 'kitchen') return row.recipe.minutes;
  return Math.max(1, (row.recipe.prep_time ?? 0) + (row.recipe.cook_time ?? 0));
}

/** Main-dish signals — checked before side keywords so "burger bowl" is not classified as side from slaw. */
const MAIN_DISH_MEAL_PATTERN =
  /\b(bowl|burrito|tacos?|burger|pasta|pizza|curry|steak|salmon|chicken|pork|beef|ribs|wings|enchilada|casserole|stir[- ]?fry|roast|supper|dinner)\b/i;

const MEAL_KEYWORDS: { category: Exclude<RecipesTabMealChoice, 'any'>; pattern: RegExp }[] = [
  {
    category: 'breakfast',
    pattern: /\b(breakfast|brunch|oatmeal|pancakes?|waffles?|omelettes?|omelets?|french toast)\b/i,
  },
  { category: 'lunch', pattern: /\b(lunch|sandwich|wrap|salad bowl)\b/i },
  { category: 'dinner', pattern: /\b(dinner|supper|roast|casserole|stir[- ]?fry)\b/i },
  { category: 'snack', pattern: /\b(snack|bite|dessert|cookie|brownie|cake|pie|pudding)\b/i },
  {
    category: 'side',
    pattern: /\b(side dish|side(?!\s*of)|coleslaw|soup|stew|chili|chowder|broth)\b/i,
  },
];

function apiMealTypeToChoice(mealType: string | undefined | null): RecipesTabMealChoice | null {
  if (!mealType) return null;
  const normalized = mealType.toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'breakfast':
    case 'brunch':
      return 'breakfast';
    case 'snack':
      return 'snack';
    case 'side_dish':
    case 'starter':
    case 'appetizer':
    case 'soup':
      return 'side';
    case 'main':
      return 'dinner';
    case 'dessert':
      return 'snack';
    default:
      return null;
  }
}

export function inferKitchenMealChoice(recipe: Recipe): RecipesTabMealChoice | null {
  const haystack = `${recipe.name} ${recipe.description} ${recipe.tag}`;
  const mainDish = MAIN_DISH_MEAL_PATTERN.test(haystack);
  for (const { category, pattern } of MEAL_KEYWORDS) {
    if (!pattern.test(haystack)) continue;
    if (category === 'side' && mainDish) continue;
    return category;
  }
  if (mainDish) return 'dinner';
  return null;
}

export function recipesTabRowMealChoice(row: RecipesTabRow): RecipesTabMealChoice | null {
  if (row.kind === 'discovery') {
    const fromApi = apiMealTypeToChoice(row.recipe.meal_type);
    if (fromApi) return fromApi;
    return inferKitchenMealChoice({
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
  return inferKitchenMealChoice(row.recipe);
}

function timeMaxMinutes(choice: RecipesTabTimeChoice): number | null {
  if (choice === 'any') return null;
  return Number.parseInt(choice, 10);
}

function matchesShop(choice: RecipesTabShopChoice, missingCount: number): boolean {
  if (choice === 'any' || choice === 'happy_to_shop') return true;
  if (choice === 'pantry_only') return missingCount === 0;
  if (choice === 'grab_1_2') return missingCount >= 1 && missingCount <= 2;
  return true;
}

/** People choice does not remove recipes — it only scales servings. */
function matchesPeople(): boolean {
  return true;
}

function rowMatchesState(row: RecipesTabRow, state: RecipesTabFilterState): boolean {
  const maxMinutes = timeMaxMinutes(state.time);
  if (maxMinutes != null && recipesTabRowMinutes(row) > maxMinutes) return false;

  if (state.difficulty !== 'any' && recipesTabRowDifficulty(row) !== state.difficulty) return false;

  if (state.meal !== 'any') {
    const meal = recipesTabRowMealChoice(row);
    if (meal !== state.meal) return false;
  }

  if (!matchesShop(state.shop, row.match.missingCount)) return false;
  if (!matchesPeople()) return false;

  return true;
}

/** Any non-default choice (including people / servings). */
export function recipesTabFiltersActive(state: RecipesTabFilterState): boolean {
  return (
    state.time !== 'any' ||
    state.difficulty !== 'any' ||
    state.meal !== 'any' ||
    state.shop !== 'any' ||
    state.people !== 'any'
  );
}

/** Filters that narrow the recipe list (excludes people — servings only). */
export function recipesTabNarrowingFiltersActive(state: RecipesTabFilterState): boolean {
  return (
    state.time !== 'any' ||
    state.difficulty !== 'any' ||
    state.meal !== 'any' ||
    state.shop !== 'any'
  );
}

export function applyRecipesTabFilters<T extends RecipesTabRow>(
  rows: T[],
  state: RecipesTabFilterState,
): T[] {
  if (!recipesTabFiltersActive(state)) return rows;
  return rows.filter((row) => rowMatchesState(row, state));
}

export function withRecipesTabFilterDimension<K extends RecipesTabFilterDimension>(
  state: RecipesTabFilterState,
  dimension: K,
  value: RecipesTabFilterState[K],
): RecipesTabFilterState {
  return { ...state, [dimension]: value };
}

export function countRecipesTabFilterOption(
  rows: readonly RecipesTabRow[],
  state: RecipesTabFilterState,
  dimension: RecipesTabFilterDimension,
  value: RecipesTabFilterState[typeof dimension],
): number {
  const candidate = withRecipesTabFilterDimension(state, dimension, value);
  return applyRecipesTabFilters([...rows], candidate).length;
}

export function clearRecipesTabFilters(): RecipesTabFilterState {
  return { ...DEFAULT_RECIPES_TAB_FILTER_STATE };
}

export function recipesTabPeopleTargetServings(people: RecipesTabPeopleChoice): number | null {
  if (people === 'any') return null;
  return RECIPES_TAB_PEOPLE_SERVINGS[people];
}

const SUMMARY_TIME: Record<Exclude<RecipesTabTimeChoice, 'any'>, string> = {
  '15': '15 min',
  '30': '30 min',
  '45': '45 min',
  '60': '1 hr',
};

const SUMMARY_SHOP: Record<Exclude<RecipesTabShopChoice, 'any'>, string> = {
  pantry_only: 'Pantry only',
  grab_1_2: '1–2 to buy',
  happy_to_shop: 'OK to shop',
};

const SUMMARY_PEOPLE: Record<Exclude<RecipesTabPeopleChoice, 'any'>, string> = {
  just_me: 'Just me',
  two: '2 people',
  three_four: '3–4',
  five_plus: '5+',
};

/** Short summary for the filter button (active picks only). */
export function recipesTabFilterSummary(state: RecipesTabFilterState): string {
  const parts: string[] = [];
  if (state.time !== 'any') parts.push(SUMMARY_TIME[state.time]);
  if (state.shop !== 'any') parts.push(SUMMARY_SHOP[state.shop]);
  if (state.difficulty !== 'any') {
    parts.push(RECIPES_TAB_FILTER_COPY.options.difficulty[state.difficulty]);
  }
  if (state.meal !== 'any') parts.push(RECIPES_TAB_FILTER_COPY.options.meal[state.meal]);
  if (state.people !== 'any') parts.push(SUMMARY_PEOPLE[state.people]);
  return parts.join(' · ');
}

function isTimeChoice(value: unknown): value is RecipesTabTimeChoice {
  return typeof value === 'string' && RECIPES_TAB_TIME_CHOICES.includes(value as RecipesTabTimeChoice);
}
function isDifficultyChoice(value: unknown): value is RecipesTabDifficultyChoice {
  return typeof value === 'string' && RECIPES_TAB_DIFFICULTY_CHOICES.includes(value as RecipesTabDifficultyChoice);
}
function isMealChoice(value: unknown): value is RecipesTabMealChoice {
  return typeof value === 'string' && RECIPES_TAB_MEAL_CHOICES.includes(value as RecipesTabMealChoice);
}
function isShopChoice(value: unknown): value is RecipesTabShopChoice {
  return typeof value === 'string' && RECIPES_TAB_SHOP_CHOICES.includes(value as RecipesTabShopChoice);
}
function isPeopleChoice(value: unknown): value is RecipesTabPeopleChoice {
  return typeof value === 'string' && RECIPES_TAB_PEOPLE_CHOICES.includes(value as RecipesTabPeopleChoice);
}

export function parseStoredRecipesTabFilterState(raw: unknown): RecipesTabFilterState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RECIPES_TAB_FILTER_STATE };
  const record = raw as Record<string, unknown>;
  return {
    time: isTimeChoice(record.time) ? record.time : 'any',
    difficulty: isDifficultyChoice(record.difficulty) ? record.difficulty : 'any',
    meal: isMealChoice(record.meal) ? record.meal : 'any',
    shop: isShopChoice(record.shop) ? record.shop : 'any',
    people: isPeopleChoice(record.people) ? record.people : 'any',
  };
}

export function discoveryRecipeServingOverrideId(apiId: number): string {
  return `recipeapi-${apiId}`;
}
