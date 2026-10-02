import assert from 'node:assert/strict';
import type { PantryItem, Recipe } from '../types/mealprep';
import {
  applyRecipesTabFilters,
  countRecipesTabFilterMatches,
  inferKitchenMealCategory,
  type RecipesTabDiscoveryRow,
  type RecipesTabKitchenRow,
  type RecipesTabRow,
} from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';

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
  ingredients: [],
  steps: [],
  isMaster: false,
  createdAt: '',
};

const rows: RecipesTabRow[] = [
  kitchenRow(baseRecipe, matchStub('lemon-chicken', { missingCount: 0, matchedCount: 3 })),
  kitchenRow(
    { ...baseRecipe, id: 'fast-bowl', name: 'Pulled Pork Bowl', minutes: 25, description: 'Lunch bowl' },
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
      instructions: [],
      ingredients: [],
    },
    matchStub('recipeapi-101', { missingCount: 1, matchedCount: 2 }),
  ),
];

assert.equal(applyRecipesTabFilters(rows, ['can_make_now']).length, 1);
assert.equal(applyRecipesTabFilters(rows, ['missing_1_2']).length, 2);
assert.equal(applyRecipesTabFilters(rows, ['under_30']).length, 2);
assert.equal(applyRecipesTabFilters(rows, ['meal:breakfast']).length, 1);
assert.equal(applyRecipesTabFilters(rows, ['meal:lunch']).length, 1);
assert.equal(applyRecipesTabFilters(rows, ['can_make_now', 'under_30']).length, 0);
assert.equal(applyRecipesTabFilters(rows, ['can_make_now', 'missing_1_2']).length, 0);

const combined = applyRecipesTabFilters(rows, ['missing_1_2', 'meal:breakfast']);
assert.equal(combined.length, 1);
assert.equal(combined[0]?.kind, 'discovery');

assert.equal(countRecipesTabFilterMatches(rows, 'can_make_now', []), 1);
assert.equal(countRecipesTabFilterMatches(rows, 'can_make_now', ['missing_1_2']), 0);

assert.equal(inferKitchenMealCategory({ ...baseRecipe, name: 'Sunday Pancakes', description: '' }), 'breakfast');

console.log('recipes-tab-filters-check: ok');
