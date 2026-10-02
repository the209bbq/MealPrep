import assert from 'node:assert/strict';
import type { Recipe } from '../types/mealprep';
import {
  applyRecipesTabFilters,
  countRecipesTabFilterOption,
  DEFAULT_RECIPES_TAB_FILTER_STATE,
  inferKitchenMealChoice,
  recipesTabFilterSummary,
  recipesTabNarrowingFiltersActive,
  recipesTabPeopleTargetServings,
  type RecipesTabDiscoveryRow,
  type RecipesTabFilterState,
  type RecipesTabKitchenRow,
  type RecipesTabRow,
} from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';
import { recipesTabKitchenDifficulty } from '../config/recipesTabFilterDifficulty';

function matchStub(
  recipeId: string,
  overrides: Partial<RecipePantryMatch> = {},
): RecipePantryMatch {
  return {
    recipeId,
    recipeName: recipeId,
    totalIngredients: 3,
    matchedCount: 2,
    missingCount: 1,
    percentMatch: 66,
    matched: [],
    missing: [],
    ...overrides,
  };
}

function kitchenRow(recipe: Recipe, match: RecipePantryMatch): RecipesTabKitchenRow {
  return { kind: 'kitchen', recipe, match };
}

function discoveryRow(
  recipe: RecipeDiscoveryListItem,
  match: RecipePantryMatch,
): RecipesTabDiscoveryRow {
  return { kind: 'discovery', recipe, match };
}

const baseRecipe: Recipe = {
  id: 'lemon-chicken',
  name: 'Grilled Lemon Herb Chicken',
  tag: 'Lean',
  description: 'A quick dinner',
  servings: 4,
  minutes: 35,
  calories: 400,
  protein: 40,
  carbs: 10,
  fat: 8,
  ingredients: [{ ingredientId: 'a', name: 'chicken', quantity: 1, unit: 'lb' }],
  steps: ['a', 'b', 'c'],
  isMaster: false,
  createdAt: '',
};

const rows: RecipesTabRow[] = [
  kitchenRow(baseRecipe, matchStub('lemon-chicken', { missingCount: 0, matchedCount: 3 })),
  kitchenRow(
    {
      ...baseRecipe,
      id: 'fast-bowl',
      name: 'Pulled Pork Bowl',
      minutes: 25,
      description: 'Lunch bowl',
      ingredients: Array.from({ length: 12 }, (_, i) => ({
        ingredientId: `i-${i}`,
        name: `ing ${i}`,
        quantity: 1,
        unit: 'cup',
      })),
      steps: Array.from({ length: 9 }, () => 'step'),
    },
    matchStub('fast-bowl', { missingCount: 2, matchedCount: 1 }),
  ),
  discoveryRow(
    {
      id: 101,
      name: 'Weekend Pancakes',
      description: 'Breakfast treat',
      difficulty: 'easy',
      meal_type: 'breakfast',
      cuisine: 'american',
      dietary_tags: [],
      servings: 2,
      prep_time: 10,
      cook_time: 15,
      calories_per_serving: 300,
      protein: 8,
      instructions: ['mix', 'cook'],
      ingredients: [{ id: 1, name: 'flour', category: 'dry', quantity: 1, unit: 'cup', optional: false }],
    },
    matchStub('recipeapi-101', { missingCount: 1, matchedCount: 2 }),
  ),
];

const state30Lunch: RecipesTabFilterState = {
  ...DEFAULT_RECIPES_TAB_FILTER_STATE,
  time: '30',
  meal: 'lunch',
};

assert.equal(applyRecipesTabFilters(rows, state30Lunch).length, 1);
assert.equal(applyRecipesTabFilters(rows, { ...DEFAULT_RECIPES_TAB_FILTER_STATE, shop: 'pantry_only' }).length, 1);
assert.equal(
  applyRecipesTabFilters(rows, { ...DEFAULT_RECIPES_TAB_FILTER_STATE, shop: 'grab_1_2' }).length,
  2,
);
assert.equal(
  applyRecipesTabFilters(rows, { ...DEFAULT_RECIPES_TAB_FILTER_STATE, time: '30', shop: 'pantry_only' }).length,
  0,
);

assert.equal(recipesTabKitchenDifficulty(baseRecipe), 'easy');
assert.equal(recipesTabKitchenDifficulty(rows[1]!.kind === 'kitchen' ? rows[1]!.recipe : baseRecipe), 'hard');

assert.equal(
  applyRecipesTabFilters(rows, { ...DEFAULT_RECIPES_TAB_FILTER_STATE, difficulty: 'hard' }).length,
  1,
);

assert.equal(countRecipesTabFilterOption(rows, DEFAULT_RECIPES_TAB_FILTER_STATE, 'time', '30'), 2);
assert.equal(recipesTabPeopleTargetServings('three_four'), 4);
assert.equal(
  recipesTabFilterSummary({ ...DEFAULT_RECIPES_TAB_FILTER_STATE, time: '30', difficulty: 'easy' }),
  '30 min · Easy',
);
assert.equal(
  recipesTabFilterSummary({
    ...DEFAULT_RECIPES_TAB_FILTER_STATE,
    time: '30',
    difficulty: 'easy',
    meal: 'dinner',
    people: 'two',
    shop: 'grab_1_2',
  }),
  '30 min · 1–2 to buy · Easy · Dinner · 2 people',
);
assert.equal(recipesTabNarrowingFiltersActive({ ...DEFAULT_RECIPES_TAB_FILTER_STATE, people: 'two' }), false);

assert.equal(inferKitchenMealChoice({ ...baseRecipe, name: 'Sunday Pancakes', description: '' }), 'breakfast');

console.log('recipes-tab-filters-check: ok');
