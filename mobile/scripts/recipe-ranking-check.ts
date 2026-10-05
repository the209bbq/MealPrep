/**
 * Personal recipe ranking v1 — hard filters, weights, cold start, recency, section sort.
 * Run from mobile/: npm run test:recipe-ranking
 */

import { DEFAULT_RECIPES_TAB_FILTER_STATE } from '../config/recipesTabFilters';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { Recipe } from '../types/mealprep';
import {
  RANK_WEIGHT_FIT,
  RANK_WEIGHT_NOVELTY,
  RANK_WEIGHT_PERSONAL,
  RANK_WEIGHT_PEER,
  appendRecipeEngagementEvent,
  createEngagementEvent,
  personalSignalsReady,
  rankRecipesTabRows,
  recipeFailsDietHardFilter,
  scorePersonalHistory,
  scoreRecipeForRanking,
  shouldHardExcludeRecipe,
  wontCookRefKeys,
  type RecipeEngagementEvent,
  type RecipeRankingContext,
} from '../lib/recipeRanking';
import { rankingInputFromRecipesTabRow } from '../lib/recipeRanking/recipeInputs';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const matchHigh: RecipePantryMatch = {
  recipeId: 'a',
  recipeName: 'A',
  totalIngredients: 4,
  matchedCount: 4,
  missingCount: 0,
  percentMatch: 95,
  matched: [],
  missing: [],
};

const matchLow: RecipePantryMatch = {
  ...matchHigh,
  recipeId: 'b',
  recipeName: 'B',
  matchedCount: 1,
  missingCount: 3,
  percentMatch: 25,
};

function kitchenRow(id: string, name: string, match: RecipePantryMatch, ingredients: string[]): RecipesTabRow {
  const recipe: Recipe = {
    id,
    name,
    tag: 'dinner',
    description: '',
    servings: 4,
    minutes: 30,
    calories: 400,
    protein: 20,
    carbs: 10,
    fat: 8,
    ingredients: ingredients.map((ingredient, index) => ({
      ingredientId: `${id}-${index}`,
      name: ingredient,
      quantity: 1,
      unit: 'cup',
    })),
    steps: ['Cook'],
    isMaster: false,
    createdAt: '',
  };
  return { kind: 'kitchen', recipe, match };
}

assert(
  recipeFailsDietHardFilter(
    { ...DEFAULT_USER_DIET_PREFS, hideConflicts: false, diets: ['vegan'] },
    ['chicken breast', 'rice'],
  ),
  'non-vegan recipe should hard-filter even when hideConflicts is off',
);

assert(
  !recipeFailsDietHardFilter(
    { ...DEFAULT_USER_DIET_PREFS, hideConflicts: false, diets: ['vegan'] },
    ['tofu', 'rice'],
  ),
  'vegan-friendly lines should pass hard filter',
);

const wontEvents: RecipeEngagementEvent[] = [
  createEngagementEvent('kitchen:bad', 'wont_cook'),
];
assert(wontCookRefKeys(wontEvents).has('kitchen:bad'), 'wont_cook events should be tracked');
assert(
  shouldHardExcludeRecipe(DEFAULT_USER_DIET_PREFS, ['salt'], 'kitchen:bad', wontEvents),
  'wont_cook ref should hard exclude',
);

const now = Date.parse('2026-10-05T12:00:00.000Z');
const recentCook = createEngagementEvent('kitchen:loved', 'cook', '2026-10-04T12:00:00.000Z');
const oldCook = createEngagementEvent('kitchen:old', 'cook', '2025-06-01T12:00:00.000Z');
const recentScore = scorePersonalHistory('kitchen:loved', [recentCook], now);
const oldScore = scorePersonalHistory('kitchen:old', [oldCook], now);
assert(recentScore > oldScore, 'recent cook should outscore old cook');

const coldEvents: RecipeEngagementEvent[] = [
  createEngagementEvent('kitchen:1', 'save'),
  createEngagementEvent('kitchen:2', 'save'),
];
assert(!personalSignalsReady(coldEvents), 'cold start until 5 cook/save events');
const warmEvents = [...coldEvents];
for (let i = 3; i <= 5; i += 1) {
  warmEvents.push(createEngagementEvent(`kitchen:${i}`, 'cook'));
}
assert(personalSignalsReady(warmEvents), 'personal signals ready at 5 cook/save');

const matchMid: RecipePantryMatch = { ...matchHigh, recipeId: 'm', percentMatch: 55 };
const rowHigh = kitchenRow('high', 'High pantry', matchHigh, ['tofu', 'rice', 'broccoli', 'soy sauce']);
const rowLow = kitchenRow('low', 'Low pantry', matchMid, ['tofu', 'rice', 'broccoli', 'soy sauce']);

const ctxCold: RecipeRankingContext = {
  dietPrefs: DEFAULT_USER_DIET_PREFS,
  householdSize: 4,
  tabFilters: DEFAULT_RECIPES_TAB_FILTER_STATE,
  events: coldEvents,
  pricing: { ownerId: 'test', communityDeals: [] },
  personalSignalsReady: false,
};

const costCache = new Map<string, number | null>();
const highCold = scoreRecipeForRanking(rankingInputFromRecipesTabRow(rowHigh), ctxCold, costCache, now);
const lowCold = scoreRecipeForRanking(rankingInputFromRecipesTabRow(rowLow), ctxCold, costCache, now);
assert(highCold.total > lowCold.total, 'higher pantry fit should rank higher during cold start');

const ctxWarm: RecipeRankingContext = {
  ...ctxCold,
  events: [
    ...warmEvents,
    createEngagementEvent('kitchen:low', 'cook', '2026-10-04T12:00:00.000Z'),
  ],
  personalSignalsReady: true,
};

const highWarm = scoreRecipeForRanking(rankingInputFromRecipesTabRow(rowHigh), ctxWarm, new Map(), now);
const lowWarm = scoreRecipeForRanking(rankingInputFromRecipesTabRow(rowLow), ctxWarm, new Map(), now);
assert(lowWarm.personal > highWarm.personal, 'recent cook on low row should lift personal score');

const ranked = rankRecipesTabRows([rowHigh, rowLow], ctxWarm, now);
assert(ranked[0]?.recipe.id === 'low', 'section sort should order high score first');

const weightSum =
  RANK_WEIGHT_FIT + RANK_WEIGHT_PERSONAL + RANK_WEIGHT_PEER + RANK_WEIGHT_NOVELTY;
assert(Math.abs(weightSum - 1) < 0.0001, 'top-level weights should sum to 1');

let store: RecipeEngagementEvent[] = [];
store = appendRecipeEngagementEvent('test-user', createEngagementEvent('kitchen:x', 'open'), store);
assert(store.length === 1, 'event store append should persist in memory for tests');

console.log('recipe-ranking-check: ok');
