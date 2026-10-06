/**
 * Batch B retest regression checks.
 * Run from mobile/: npm run test:retest-fixes-b
 */

import assert from 'node:assert/strict';
import { suggestStorageLocationForPantryItem } from '../config/pantryStorage';
import { inferGroceryCategoryFromName } from '../lib/grocery/categorize';
import { dietCheckLinesFromCreatorModel } from '../lib/diet/ingredientLines';
import { shouldHideRecipeForDietPrefs } from '../lib/diet/conflicts';
import type { UserDietPrefs } from '../lib/diet/types';
import { buildMealPickerRecipeOptions } from '../lib/mealCalendar/recipePickerOptions';
import { recipeCategoryGroup } from '../lib/seamlessFlow/categoryGroup';
import { guessGhostDaySlot } from '../lib/seamlessFlow/ghostGuesser';
import { emptyEngagementIndexForGhost } from '../lib/recipeRanking/engagementIndexHelpers';
import { recipeMissingShopCount } from '../lib/recipeMatch/missingShopCount';
import { sourceTagForRecipesTabRow } from '../lib/recipes/searchResultSourceTag';
import { savedKitchenRecipeIdsFromRecords } from '../lib/savedRecipes/pickerRecipeIds';
import { resolveVisitForSimulation } from '../lib/recipesTab/visitState';
import { RECIPES_TAB_SURFACE } from '../config/recipesTabSurface';
import type { CreatorFeedCardModel } from '../lib/recipes/creatorFeedRows';
import type { Recipe } from '../types/mealprep';
import type { SavedRecipeRecord } from '../lib/savedRecipes/types';

// Storage defaults from grocery category inference
assert.equal(inferGroceryCategoryFromName('chicken thighs'), 'meats');
assert.equal(inferGroceryCategoryFromName('heavy cream'), 'dairy');
assert.equal(inferGroceryCategoryFromName('carrots'), 'produce');
assert.equal(suggestStorageLocationForPantryItem('chicken thighs', 'meats'), 'fridge');
assert.equal(suggestStorageLocationForPantryItem('heavy cream', 'dairy'), 'fridge');

// Peanut filter uses creator description even when imported recipe has other lines
const peanutPrefs: UserDietPrefs = {
  diets: [],
  allergens: ['peanuts'],
  dislikes: [],
  hideConflicts: true,
};
const creatorModel: CreatorFeedCardModel = {
  videoId: 'v1',
  video: {
    videoId: 'v1',
    channelId: 'ch',
    creatorName: 'Chef',
    creatorHandle: null,
    creatorAvatarUrl: null,
    channelUrl: 'https://youtube.com',
    title: '6 Salad Dressings',
    descriptionSnippet: 'Includes a Peanut-Ginger dressing',
    thumbnailUrl: 'https://example.com/t.jpg',
    publishedAt: null,
    viewCount: 1,
    likeCount: 0,
    durationSeconds: 60,
    isShort: false,
    watchUrl: 'https://youtube.com/watch?v=v1',
  },
  item: {
    videoId: 'v1',
    category: 'quick',
    title: '6 Salad Dressings',
    thumbnailUrl: 'https://example.com/t.jpg',
    channelId: 'ch',
    channelTitle: 'Chef',
    channelUrl: 'https://youtube.com',
    watchUrl: 'https://youtube.com/watch?v=v1',
    viewCount: 1,
    publishedAt: null,
  },
  importedRecipe: {
    id: 'kitchen-import-1',
    name: 'Dressings',
    tag: '',
    description: '',
    servings: 4,
    minutes: 10,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: [{ ingredientId: 'i1', name: 'olive oil', quantity: 1, unit: 'tbsp' }],
    steps: [],
    isMaster: false,
    createdAt: new Date().toISOString(),
  },
  match: null,
  sourceLabel: 'Chef',
};
const dietLines = dietCheckLinesFromCreatorModel(creatorModel);
assert.ok(dietLines && shouldHideRecipeForDietPrefs(peanutPrefs, dietLines), 'peanut in description hides video');

// Visit gap simulation
{
  const gap = RECIPES_TAB_SURFACE.visitGapMs + 1;
  const first = resolveVisitForSimulation(null, 1_000_000, false);
  const second = resolveVisitForSimulation(first.state, 1_000_000 + gap, false);
  assert.ok(second.isNewVisit, 'new visit after gap without cold start');
}

// Meal picker bookmarks
const savedRecord: SavedRecipeRecord = {
  refKey: 'mealdb:53367',
  title: 'Spanish chicken pie',
  imageUrl: null,
  savedAt: new Date().toISOString(),
  sourceType: 'mealdb',
  preview: {
    kind: 'mealdb',
    shape: {
      id: '53367',
      name: 'Spanish chicken pie',
      tag: 'Spanish · Chicken',
      description: '',
      servings: 4,
      minutes: 30,
      ingredients: [],
      steps: [],
      isMaster: true,
    },
  },
};
const savedIds = savedKitchenRecipeIdsFromRecords([savedRecord]);
assert.ok(savedIds.has('mealdb-53367'), 'mealdb bookmark id');
const picker = buildMealPickerRecipeOptions([], [], 50, savedIds, [savedRecord]);
assert.ok(picker.some((row) => row.title === 'Spanish chicken pie'), 'bookmark in picker');

// Ghost suggestions
const emptyIndex = emptyEngagementIndexForGhost(new Date('2026-10-12T08:00:00'));
assert.equal(recipeCategoryGroup({ category: 'Chicken', title: 'Boxty Breakfast' }), 'breakfast');
const friedRiceMorning = guessGhostDaySlot({
  category: 'Chinese',
  title: 'Chicken Fried Rice',
  mealPlan: [],
  todayIso: '2026-10-12',
  now: new Date('2026-10-12T08:00:00'),
  index: emptyIndex,
});
assert.notEqual(friedRiceMorning.slot, 'breakfast', 'fried rice not breakfast at 8am');
const boxty = guessGhostDaySlot({
  category: 'Breakfast',
  title: 'Boxty Breakfast',
  mealPlan: [],
  todayIso: '2026-10-12',
  now: new Date('2026-10-12T08:00:00'),
  index: emptyIndex,
});
assert.equal(boxty.slot, 'breakfast', 'boxty suggests breakfast');

// Missing shop count
assert.equal(
  recipeMissingShopCount({
    recipeId: 'r',
    recipeName: 'R',
    totalIngredients: 3,
    matchedCount: 1,
    missingCount: 99,
    percentMatch: 0,
    matched: [],
    missing: [
      { ingredientId: 'a', name: 'a', quantity: 1, unit: 'cup' },
      { ingredientId: 'b', name: 'b', quantity: 1, unit: 'cup' },
    ],
  }),
  2,
  'uses missing array length',
);

// Search source tag
const imported: Recipe = {
  id: 'photo-import-1',
  name: 'Pedernales chili',
  tag: '',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [],
  steps: [],
  isMaster: false,
  createdAt: new Date().toISOString(),
  sourceType: 'photo',
};
assert.equal(
  sourceTagForRecipesTabRow({
    kind: 'kitchen',
    recipe: imported,
    match: null,
  }),
  'Imported',
);

console.log('retest-fixes-b-check: ok');
