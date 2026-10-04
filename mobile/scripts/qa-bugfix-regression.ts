/**
 * Regression checks for QA bugfixes (C1, C2, H1–H3, H5 empty states, H6 diet/title).
 * Run: npx tsx scripts/qa-bugfix-regression.ts
 */

import assert from 'node:assert/strict';
import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import { isGroceryOriginPinned } from '../lib/grocery/origin';
import { isAllowedOsmGroceryElement } from '../lib/stores/groceryFilter';
import { mergeGroceryWithMissing } from '../lib/recipeMatch/groceryFromMissing';
import { formatQuantity } from '../lib/formatQuantity';
import { groceryItemToPantryItem } from '../lib/pantry/mergePantryStock';
import { isPersistedRowUuid } from '../lib/pantry/persistIds';
import { shouldHideRecipeForDietPrefs } from '../lib/diet/conflicts';
import { ingredientLinesFromCreatorModel } from '../lib/diet/ingredientLines';
import { mealDbIdsForEmptyPantryBrowse, resetMealDbEmptyPantryBrowseCache } from '../lib/mealdb/catalogBrowse';
import {
  storesTabShowsLoadError,
  storesTabShowsNoSearchResults,
  storesTabShowsNoStoresNearby,
} from '../lib/stores/storesTabEmptyState';
import type { GroceryListItem, PantryItem, Recipe } from '../types/mealprep';
import type { CreatorFeedCardModel } from '../lib/recipes/creatorFeedRows';
import type { UserDietPrefs } from '../lib/diet/types';

const recipe: Recipe = {
  id: 'r1',
  name: 'Test',
  tag: '',
  description: '',
  servings: 6,
  minutes: 20,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [{ name: 'Chicken', ingredientId: 'chicken', quantity: 1, unit: 'lb' }],
  steps: [],
  isMaster: false,
  createdAt: '',
};

// C1: add-missing rows survive rebuild with no meal plan
const missingAdded = mergeGroceryWithMissing(
  [],
  [{ name: 'Basil', ingredientId: 'basil', quantity: 1, unit: 'bunch' }],
  recipe.id,
  [],
);
const rebuilt = buildGroceryList([], [], [], {}, missingAdded.items);
assert.equal(rebuilt.length, 1, 'pinned missing item survives empty meal-plan rebuild');
assert.equal(rebuilt[0].origin, 'add_missing');
assert.ok(isGroceryOriginPinned(rebuilt[0].origin), 'missing row is pinned');

const stalePlanRow = {
  id: 'uuid-plan',
  ingredientId: 'chicken',
  name: 'Chicken',
  category: 'meats' as const,
  quantity: 1,
  unit: 'lb',
  checked: false,
  sourceRecipeIds: [recipe.id],
  origin: 'plan' as const,
};
const afterUnplan = buildGroceryList([], [], [], {}, [...missingAdded.items, stalePlanRow]);
assert.equal(afterUnplan.length, 1, 'plan rows pruned when meal not on plan');
assert.equal(afterUnplan[0].origin, 'add_missing');

const manual = createManualGroceryItem({ name: 'Tape', quantity: 1, unit: 'each' });
const mixed = [...missingAdded.items, manual];
const rebuiltMixed = buildGroceryList([], [], [], {}, mixed);
assert.equal(rebuiltMixed.length, 2, 'manual + missing both kept');

// C2: pantry restock ids are UUIDs
const pantryRow = groceryItemToPantryItem({
  id: 'g1',
  ingredientId: 'x',
  name: 'Milk',
  category: 'dairy',
  quantity: 1,
  unit: 'gal',
  checked: true,
  sourceRecipeIds: [],
});
assert.ok(isPersistedRowUuid(pantryRow.id), 'grocery restock pantry row uses UUID');

// H1: no household scaling in grocery build (6 servings recipe → 1 lb stays 1 lb)
const householdRebuild = buildGroceryList([recipe], [recipe.id], [], {}, [], undefined);
assert.equal(householdRebuild[0]?.quantity, 1, 'grocery quantity matches recipe without household scale');

assert.equal(formatQuantity(1 / 6), '⅛');
assert.equal(formatQuantity(0.167), '⅛');
assert.equal(formatQuantity(0.2), '¼');

// H2: creator title allergen / diet filter
const peanutPrefs: UserDietPrefs = {
  diets: [],
  allergens: ['peanuts'],
  dislikes: [],
  hideConflicts: true,
};
const satayModel = {
  videoId: 'v1',
  video: {
    videoId: 'v1',
    title: 'Satay Chicken Legs with Peanut Sauce',
    descriptionSnippet: null,
    thumbnailUrl: '',
    channelId: 'ch1',
    creatorName: 'Chef',
    creatorHandle: null,
    creatorAvatarUrl: null,
    channelUrl: 'https://example.com/channel',
    watchUrl: 'https://example.com/watch',
    viewCount: 0,
    likeCount: 0,
    durationSeconds: 60,
    isShort: false,
    publishedAt: null,
  },
  item: {
    videoId: 'v1',
    category: 'quick' as const,
    title: 'Satay Chicken Legs with Peanut Sauce',
    thumbnailUrl: '',
    channelId: '',
    channelTitle: '',
    channelUrl: '',
    watchUrl: 'https://example.com/watch',
    viewCount: 0,
    publishedAt: null,
  },
  importedRecipe: null,
  match: null,
  sourceLabel: 'Chef',
} satisfies CreatorFeedCardModel;
const satayLines = ingredientLinesFromCreatorModel(satayModel);
assert.ok(satayLines && shouldHideRecipeForDietPrefs(peanutPrefs, satayLines), 'peanut title hidden');

const vegPrefs: UserDietPrefs = {
  diets: ['vegetarian'],
  allergens: [],
  dislikes: [],
  hideConflicts: true,
};
const chickenTitleModel = {
  ...satayModel,
  video: { ...satayModel.video, title: 'Grilled Chicken Bowl' },
  item: { ...satayModel.item, title: 'Grilled Chicken Bowl' },
};
const chickenLines = ingredientLinesFromCreatorModel(chickenTitleModel);
assert.ok(chickenLines && shouldHideRecipeForDietPrefs(vegPrefs, chickenLines), 'chicken title fails vegetarian');

async function runH3BrowseTest(): Promise<void> {
  resetMealDbEmptyPantryBrowseCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('filter.php')) {
      return new Response(JSON.stringify({ meals: [{ idMeal: '1' }, { idMeal: '2' }] }), { status: 200 });
    }
    if (url.includes('search.php')) {
      return new Response(JSON.stringify({ meals: [{ idMeal: '3' }, { idMeal: '4' }] }), { status: 200 });
    }
    return originalFetch(input);
  };
  const browseIds = await mealDbIdsForEmptyPantryBrowse();
  globalThis.fetch = originalFetch;
  assert.ok(browseIds.length >= 4, 'empty pantry browse dedupes multiple catalog sources');
}

// H5: stores tab empty-state exclusivity
assert.equal(
  storesTabShowsLoadError({
    loadingStores: false,
    storeSearchFailed: true,
    filteredCount: 0,
    hasSearchQuery: false,
  }),
  true,
);
assert.equal(
  storesTabShowsNoStoresNearby({
    loadingStores: false,
    storeSearchFailed: false,
    filteredCount: 0,
    hasSearchQuery: false,
  }),
  true,
);
assert.equal(
  storesTabShowsNoSearchResults({
    loadingStores: false,
    storeSearchFailed: false,
    filteredCount: 0,
    hasSearchQuery: true,
  }),
  true,
);
assert.equal(
  storesTabShowsNoStoresNearby({
    loadingStores: false,
    storeSearchFailed: true,
    filteredCount: 0,
    hasSearchQuery: false,
  }),
  false,
  'error state suppresses generic no-stores copy',
);

assert.equal(isAllowedOsmGroceryElement({ name: '7-Eleven', shop: 'convenience' }), false);
assert.equal(isAllowedOsmGroceryElement({ name: 'Chevron', shop: 'convenience' }), false);
assert.equal(isAllowedOsmGroceryElement({ name: 'Quick Stop', shop: 'convenience' }), false);
assert.equal(isAllowedOsmGroceryElement({ name: "Sunny's Food Mart", shop: 'convenience' }), false);
assert.equal(isAllowedOsmGroceryElement({ name: "Sunny's Food Mart", shop: 'supermarket' }), true);
assert.equal(isAllowedOsmGroceryElement({ name: 'Save Mart', shop: 'supermarket' }), true);
assert.equal(isAllowedOsmGroceryElement({ name: 'Dollar General Market', shop: 'supermarket' }), true);

void runH3BrowseTest().then(() => {
  console.log('qa-bugfix-regression: ok');
});
