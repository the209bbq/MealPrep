/**
 * Perf tap caching/memo regression checks.
 * Run from mobile/: npm run test:perf-tap
 */
import assert from 'node:assert/strict';
import {
  clearPhraseRegexCacheForTests,
  phraseMatchesHaystack,
  phraseRegexCacheSizeForTests,
} from '../lib/diet/allergenMatch';
import {
  clearRecipeDietTagCacheForTests,
  recipeDietTagFromIngredientLines,
} from '../lib/diet/conflicts';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import { DEFAULT_RECIPES_TAB_FILTER_STATE } from '../config/recipesTabFilters';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import {
  clearRecipeRankingScoreCacheForTests,
  recipeRankingScoreCacheStatsForTests,
} from '../lib/recipeRanking/scoreCache';
import {
  emptyEngagementIndexForGhost,
  type RecipeRankingContext,
} from '../lib/recipeRanking';
import { rankingInputFromRecipesTabRow } from '../lib/recipeRanking/recipeInputs';
import { scoreRecipeForRankingCached } from '../lib/recipeRanking/scoreCache';
import type { Recipe } from '../types/mealprep';

clearPhraseRegexCacheForTests();
const haystack = 'chicken breast with garlic and onion';
assert.equal(phraseRegexCacheSizeForTests(), 0);
phraseMatchesHaystack(haystack, 'chicken breast');
phraseMatchesHaystack(haystack, 'chicken breast');
assert.equal(phraseRegexCacheSizeForTests(), 1, 'phrase regex compiled once per normalized phrase');

const prefs = { ...DEFAULT_USER_DIET_PREFS, dislikes: ['mushroom'] };
clearRecipeDietTagCacheForTests();
const lines = ['chicken breast', 'mushrooms', 'rice'];
const tag1 = recipeDietTagFromIngredientLines(lines, prefs);
const tag2 = recipeDietTagFromIngredientLines(lines, prefs);
assert.deepEqual(tag2, tag1);

const match: RecipePantryMatch = {
  recipeId: 'r1',
  recipeName: 'Test',
  totalIngredients: 3,
  matchedCount: 2,
  missingCount: 1,
  percentMatch: 66,
  matched: [],
  missing: [],
};

function kitchenRow(id: string, ingredients: string[]): RecipesTabRow {
  const recipe: Recipe = {
    id,
    name: `Recipe ${id}`,
    tag: 'Beef',
    description: '',
    servings: 4,
    minutes: 30,
    calories: 400,
    protein: 20,
    carbs: 10,
    fat: 8,
    ingredients: ingredients.map((name, index) => ({
      ingredientId: `${id}-${index}`,
      name,
      quantity: 1,
      unit: 'cup',
    })),
    steps: ['Cook'],
    isMaster: false,
    createdAt: '',
  };
  return { kind: 'kitchen', recipe, match };
}

const rows = [
  kitchenRow('a', ['beef', 'onion', 'garlic']),
  kitchenRow('b', ['chicken', 'rice', 'broccoli']),
  kitchenRow('c', ['tofu', 'soy sauce', 'ginger']),
];

const ctx: RecipeRankingContext = {
  dietPrefs: DEFAULT_USER_DIET_PREFS,
  householdSize: 4,
  tabFilters: DEFAULT_RECIPES_TAB_FILTER_STATE,
  events: [],
  pricing: { ownerId: 'test', communityDeals: [] },
  engagementIndex: emptyEngagementIndexForGhost(),
  personalSignalsReady: false,
};

clearRecipeRankingScoreCacheForTests();
const costCache = new Map<string, number | null>();
for (const row of rows) {
  scoreRecipeForRankingCached(rankingInputFromRecipesTabRow(row), ctx, costCache);
}
const afterFirst = recipeRankingScoreCacheStatsForTests();
assert.ok(afterFirst.misses >= rows.length);

for (const row of rows) {
  scoreRecipeForRankingCached(rankingInputFromRecipesTabRow(row), ctx, costCache);
}
const afterSecond = recipeRankingScoreCacheStatsForTests();
assert.ok(
  afterSecond.hits >= rows.length,
  'unchanged ranking inputs should reuse cached per-recipe scores',
);
assert.equal(afterSecond.misses, afterFirst.misses);

console.log('perf-tap-check: ok');
