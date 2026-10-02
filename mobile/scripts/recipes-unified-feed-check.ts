import assert from 'node:assert/strict';
import type { Recipe } from '../types/mealprep';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { RecipeDiscoveryListItem } from '../lib/recipeDiscovery/types';
import {
  buildUnifiedRecipesFeed,
  dedupeRecipesTabRows,
  normalizeRecipeTitleForDedup,
  rankRecipesTabRows,
  recipesTabRowMatchesSearch,
} from '../lib/recipes/unifiedFeed';

function matchStub(recipeId: string, overrides: Partial<RecipePantryMatch> = {}): RecipePantryMatch {
  return {
    recipeId,
    recipeName: recipeId,
    totalIngredients: 4,
    matchedCount: 2,
    missingCount: 2,
    percentMatch: 50,
    matched: [],
    missing: [],
    ...overrides,
  };
}

const kitchenRecipe: Recipe = {
  id: 'lemon-chicken',
  name: 'Grilled Lemon Herb Chicken',
  tag: 'Lean',
  description: 'Quick dinner',
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

const discoveryRecipe = (id: number, name: string): RecipeDiscoveryListItem => ({
  id,
  name,
  description: 'Online',
  cuisine: 'American',
  servings: 4,
  prep_time: 10,
  cook_time: 20,
  calories_per_serving: 300,
  protein: 25,
  carbs: 10,
  fat: 8,
  ingredients: [{ id: 1, name: 'chicken', category: 'meat', quantity: 1, unit: 'lb', optional: false }],
  instructions: ['Cook'],
  meal_type: 'main',
  difficulty: 'easy',
  dietary_tags: [],
});

assert.equal(normalizeRecipeTitleForDedup('  Lemon-Herb Chicken!! '), 'lemon herb chicken');

const kitchenRow: RecipesTabRow = {
  kind: 'kitchen',
  recipe: kitchenRecipe,
  match: matchStub('lemon-chicken', { matchedCount: 3, missingCount: 0, percentMatch: 100 }),
};

const duplicateDiscovery: RecipesTabRow = {
  kind: 'discovery',
  recipe: discoveryRecipe(99, 'Grilled Lemon Herb Chicken'),
  match: matchStub('recipeapi-99', { matchedCount: 2, missingCount: 1, percentMatch: 75 }),
};

const otherDiscovery: RecipesTabRow = {
  kind: 'discovery',
  recipe: discoveryRecipe(100, 'Pasta Primavera'),
  match: matchStub('recipeapi-100', { matchedCount: 4, missingCount: 0, percentMatch: 90 }),
};

const deduped = dedupeRecipesTabRows([duplicateDiscovery, kitchenRow, otherDiscovery]);
assert.equal(deduped.length, 2, 'title duplicate should collapse to kitchen row');
assert.equal(deduped[0].kind, 'kitchen', 'kitchen wins on duplicate title');

const ranked = rankRecipesTabRows(deduped);
assert.equal(ranked[0].kind, 'discovery', 'higher pantry match rank first');
assert.equal(ranked[0].match.matchedCount, 4);

assert.equal(recipesTabRowMatchesSearch(otherDiscovery, 'primavera'), true);
assert.equal(recipesTabRowMatchesSearch(otherDiscovery, 'tacos'), false);

const feed = buildUnifiedRecipesFeed(deduped, 'pasta');
assert.equal(feed.length, 1);
assert.equal(feed[0].kind, 'discovery');

console.log('recipes-unified-feed-check: ok');
