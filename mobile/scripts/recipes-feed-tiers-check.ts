import assert from 'node:assert/strict';
import type { Recipe } from '../types/mealprep';
import { applyRecipesTabFilters, type RecipesTabRow } from '../config/recipesTabFilters';
import { RECIPES_TAB_CLOSE_MATCH_LIMIT } from '../config/recipeMatching';
import {
  isCanMakePantryMatch,
  isClosePantryMatch,
  splitRankedMatchesForRecipesTab,
  splitRecipesTabRowsByTier,
} from '../lib/recipes/recipesFeedTiers';
import type { RecipePantryMatch } from '../lib/recipeMatch';

function matchStub(
  recipeId: string,
  overrides: Partial<RecipePantryMatch> = {},
): RecipePantryMatch {
  return {
    recipeId,
    recipeName: recipeId,
    totalIngredients: 6,
    matchedCount: 2,
    missingCount: 4,
    percentMatch: 33,
    matched: [],
    missing: [],
    ...overrides,
  };
}

const kitchenRecipe = (id: string, minutes: number): Recipe => ({
  id,
  name: id,
  tag: 'Test',
  description: '',
  servings: 4,
  minutes,
  calories: 400,
  protein: 20,
  carbs: 10,
  fat: 8,
  ingredients: [],
  steps: [],
  isMaster: false,
  createdAt: '',
});

const ranked = [
  matchStub('a', { matchedCount: 3, missingCount: 0, percentMatch: 75 }),
  matchStub('b', { matchedCount: 2, missingCount: 1, percentMatch: 40 }),
  matchStub('c', { matchedCount: 2, missingCount: 2, percentMatch: 45 }),
  matchStub('d', { matchedCount: 1, missingCount: 2, percentMatch: 20 }),
  matchStub('e', { matchedCount: 4, missingCount: 0, percentMatch: 90 }),
];

const split = splitRankedMatchesForRecipesTab(ranked, { pantryItemCount: 7 });
assert.equal(split.canMake.length, 2, 'only strict can-make rows (50% + 2 matches)');
assert.ok(split.canMake.every((m) => isCanMakePantryMatch(m)), 'can-make tier uses strict rules');
assert.ok(split.canMake.length < ranked.length, 'sparse overlaps should not promote every recipe to can-make');
assert.ok(split.close.length <= RECIPES_TAB_CLOSE_MATCH_LIMIT, 'close tier is capped');
assert.ok(
  split.close.every((m) => isClosePantryMatch(m, new Set(split.canMake.map((row) => row.recipeId)))),
  'close tier is missing 1–2 only',
);
assert.ok(!split.close.some((m) => split.canMake.some((ok) => ok.recipeId === m.recipeId)), 'no duplicate tiers');

const rows: RecipesTabRow[] = ranked.map((match) => ({
  kind: 'kitchen',
  recipe: kitchenRecipe(match.recipeId, match.recipeId === 'a' ? 20 : 50),
  match,
}));

const tierRows = splitRecipesTabRowsByTier(rows);
const filtered = applyRecipesTabFilters(tierRows.canMake, {
  time: '30',
  difficulty: 'any',
  meal: 'any',
  shop: 'any',
  people: 'any',
});
assert.ok(filtered.length < tierRows.canMake.length, 'time filter should narrow can-make results');
assert.ok(filtered.length > 0, 'some can-make rows should still match 30 min');

const padded = splitRankedMatchesForRecipesTab(
  [matchStub('only', { matchedCount: 3, missingCount: 0, percentMatch: 80 })],
  { pantryItemCount: 3 },
);
assert.equal(padded.canMake.length, 1, 'no padding to a target feed count');

console.log('recipes-feed-tiers-check: ok');
