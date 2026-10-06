/**
 * Personal recipe ranking v2 — hard filters, blend, decay, repetition, v1 compatibility.
 * Run from mobile/: npm run test:recipe-ranking
 */

import { DEFAULT_RECIPES_TAB_FILTER_STATE } from '../config/recipesTabFilters';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { Recipe } from '../types/mealprep';
import {
  RANK_WEIGHT_SUM,
  appendRecipeEngagementEvent,
  createEngagementEvent,
  createSeamlessEngagementEvent,
  rankRecipesTabRows,
  recipeFailsDietHardFilter,
  scorePersonalV2,
  scoreRecipeForRanking,
  shouldHardExcludeRecipe,
  wontCookRefKeys,
  type RecipeEngagementEvent,
  type RecipeRankingContext,
} from '../lib/recipeRanking';
import { emptyEngagementIndexForGhost } from '../lib/recipeRanking/engagementIndexHelpers';
import {
  applyEngagementEventToIndex,
  rebuildEngagementIndex,
} from '../lib/recipeRanking/engagementIndex';
import { defaultTasteMetaForEvent } from '../lib/recipeRanking/eventMeta';
import { servingsFitScore } from '../lib/recipeRanking/profilePrior';
import { rankingInputFromRecipesTabRow } from '../lib/recipeRanking/recipeInputs';
import { normalizeV1EventType } from '../lib/recipeRanking/v2Signals';

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

assert(normalizeV1EventType('cook') === 'cook_confirmed', 'v1 cook maps to cook_confirmed');
assert(normalizeV1EventType('just_save') === 'save', 'just_save maps to save for scoring');

assert(servingsFitScore(4, 4) === 1, 'exact servings fit');
assert(servingsFitScore(0, 4) === 0.7, 'missing servings info');

const now = Date.parse('2026-10-05T12:00:00.000Z');
let index = emptyEngagementIndexForGhost(new Date(now));
const rowHigh = kitchenRow('high', 'High pantry', matchHigh, ['tofu', 'rice', 'broccoli', 'soy sauce']);
const rowLow = kitchenRow('low', 'Low pantry', { ...matchHigh, recipeId: 'low', percentMatch: 55 }, [
  'tofu',
  'rice',
  'broccoli',
  'soy sauce',
]);

const inputHigh = rankingInputFromRecipesTabRow(rowHigh);
const inputLow = rankingInputFromRecipesTabRow(rowLow);

const coldPersonalHigh = scorePersonalV2(inputHigh, index, DEFAULT_USER_DIET_PREFS, 4, now);
const coldPersonalLow = scorePersonalV2(inputLow, index, DEFAULT_USER_DIET_PREFS, 4, now);
assert(Math.abs(coldPersonalHigh - coldPersonalLow) < 15, 'cold start personal should be profile-heavy and close');

const ctxCold: RecipeRankingContext = {
  dietPrefs: DEFAULT_USER_DIET_PREFS,
  householdSize: 4,
  tabFilters: DEFAULT_RECIPES_TAB_FILTER_STATE,
  events: [],
  pricing: { ownerId: 'test', communityDeals: [] },
  engagementIndex: index,
  personalSignalsReady: false,
};

const costCache = new Map<string, number | null>();
const highCold = scoreRecipeForRanking(inputHigh, ctxCold, costCache, now, index);
const lowCold = scoreRecipeForRanking(inputLow, ctxCold, costCache, now, index);
assert(highCold.total > lowCold.total, 'higher pantry fit should rank higher during cold start');

const cookEvent = createEngagementEvent('kitchen:low', 'cook', '2026-10-04T12:00:00.000Z');
applyEngagementEventToIndex(index, cookEvent, defaultTasteMetaForEvent('kitchen:low', cookEvent));
index = rebuildEngagementIndex([cookEvent], defaultTasteMetaForEvent);

const ctxWarm: RecipeRankingContext = {
  ...ctxCold,
  events: [cookEvent],
  engagementIndex: index,
  personalSignalsReady: true,
};

const highWarm = scoreRecipeForRanking(inputHigh, ctxWarm, new Map(), now, index);
const lowWarm = scoreRecipeForRanking(inputLow, ctxWarm, new Map(), now, index);
assert(lowWarm.personal >= highWarm.personal - 5, 'cook on low row should lift personal affinity');

const ranked = rankRecipesTabRows([rowHigh, rowLow], ctxWarm, now);
assert(ranked[0]?.recipe.id === 'low' || ranked[0]?.recipe.id === 'high', 'section sort returns rows');

const yesterdayCook = createEngagementEvent('kitchen:repeat', 'cook_confirmed', '2026-10-04T12:00:00.000Z');
let repeatIndex = emptyEngagementIndexForGhost(new Date(now));
applyEngagementEventToIndex(
  repeatIndex,
  yesterdayCook,
  defaultTasteMetaForEvent('kitchen:repeat', yesterdayCook),
);
const repeatRow = kitchenRow('repeat', 'Repeat', matchHigh, ['tofu']);
const repeatInput = rankingInputFromRecipesTabRow(repeatRow);
const ctxRepeat: RecipeRankingContext = {
  ...ctxCold,
  engagementIndex: repeatIndex,
};
const withRepeat = scoreRecipeForRanking(repeatInput, ctxRepeat, new Map(), now, repeatIndex);
assert(
  withRepeat.repetitionAdjust === -15,
  'recipe cooked yesterday should apply a -15 repetition penalty',
);

assert(RANK_WEIGHT_SUM === 85, 'top-level weight points sum to 85 with peer at 0');

let store: RecipeEngagementEvent[] = [];
store = appendRecipeEngagementEvent('test-user', createEngagementEvent('kitchen:x', 'open'), store);
assert(store.length === 1, 'event store append should persist in memory for tests');

const importEvent = createSeamlessEngagementEvent('kitchen:imp', 'import', {
  ts: now,
  recipeId: 'imp',
  source: 'import',
  group: 'main',
  sheetId: 'import-1',
  tags: ['weeknight'],
});
assert(importEvent.type === 'import', 'import event type');

console.log('recipe-ranking-check: ok');
