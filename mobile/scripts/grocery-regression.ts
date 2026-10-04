/**
 * Regression checks for grocery rebuild, persistence semantics, and pantry-aware lists.
 * Run from mobile/: npm run test:grocery
 */

import {
  buildGroceryList,
  createManualGroceryItem,
  isManualGroceryItem,
  mergeManualGroceryLines,
} from '../lib/grocery';
import { kitchenRecipesForPantryMatch } from '../lib/recipeMatch/kitchenCatalogMerge';
import { applyGroceryCheckRestock, reverseGroceryCheckRestock } from '../lib/grocery/restockLedger';
import { inferGroceryCategoryFromName } from '../lib/grocery/categorize';
import { groceryDismissalKeysForItem } from '../lib/grocery/removals';
import {
  addGroceryDismissals,
  clearGroceryDismissals,
  groceryDismissalKey,
  readGroceryDismissals,
} from '../lib/grocery/dismissals';
import { enqueueGroceryPersist } from '../lib/grocery/persistQueue';
import { mergeGroceryWithMissing } from '../lib/recipeMatch/groceryFromMissing';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import { buildPantryDeductionLines, applyPantryDeductions } from '../lib/mealPlan/pantryDeduction';
import { convertQuantity, unitsAreConvertible } from '../lib/units/conversion';
import type { GroceryListItem, PantryItem, Recipe, RecipeIngredient } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
function pantryItem(
  name: string,
  quantity: number,
  unit: string,
  id?: string,
): PantryItem {
  return {
    id: id ?? `manual-${name}-${Date.now()}`,
    ingredientId: `manual-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name,
    category: 'meats',
    quantity,
    unit,
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  };
}

const recipe: Recipe = {
  id: 'lemon-chicken',
  name: 'Lemon Chicken',
  tag: '',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: 'Chicken breast', ingredientId: 'chicken-breast', quantity: 2, unit: 'lb' },
    { name: 'Limes', ingredientId: 'limes', quantity: 3, unit: 'each' },
  ],
  steps: [],
  isMaster: true,
  createdAt: '',
};

// --- Bug 1: demo meal plan must not rebuild over saved manual grocery when nothing is planned ---
const savedManual: GroceryListItem[] = [
  createManualGroceryItem({ name: 'QA paper towels', quantity: 1, unit: 'each', category: 'dry_goods' }),
  createManualGroceryItem({ name: 'QA coffee', quantity: 1, unit: 'each', category: 'dry_goods' }),
];
const noPlanRebuild = buildGroceryList([], [], [], {}, savedManual);
assert(
  noPlanRebuild.length === 2 && noPlanRebuild.every(isManualGroceryItem),
  'empty meal plan should keep manual grocery only',
);

// --- Bug 3: pantry name match (manual ids) subtracts stock ---
const pantryWithChicken = [pantryItem('Chicken breast', 2, 'lb')];
const withPantry = buildGroceryList([recipe], [recipe.id], pantryWithChicken, {}, []);
assert(
  !withPantry.some((g) => g.name.toLowerCase().includes('chicken')),
  'pantry chicken should satisfy recipe need by name',
);
assert(withPantry.some((g) => g.name === 'Limes'), 'still need limes not in pantry');

// --- Bug 8: head vs clove not convertible; garlic not wiped on made-it ---
assert(!unitsAreConvertible('head', 'clove'), 'head and clove must not convert 1:1');
const garlicPantry = [pantryItem('Garlic', 1, 'head', 'garlic-1')];
const garlicRecipe: Recipe = {
  ...recipe,
  id: 'garlic-test',
  ingredients: [{ name: 'Garlic', ingredientId: 'garlic', quantity: 3, unit: 'clove' }],
};
const garlicMatch = scoreRecipeAgainstPantry(garlicRecipe, garlicPantry);
const garlicLines = buildPantryDeductionLines(garlicMatch, garlicRecipe, {}, new Set());
assert(garlicLines.every((line) => !line.quantityApplied), 'incompatible units should not deduct');
const { nextPantry: garlicAfter } = applyPantryDeductions(garlicPantry, garlicLines);
assert(garlicAfter.length === 1 && garlicAfter[0].quantity === 1, 'garlic head must remain after failed deduct');

assert(convertQuantity(1, 'dozen', 'each') === 12, 'dozen converts to each');

// --- Quantity shortfall: 1 egg in pantry does not satisfy 6 eggs ---
const eggRecipe: Recipe = {
  ...recipe,
  id: 'egg-test',
  ingredients: [{ name: 'Eggs', ingredientId: 'eggs', quantity: 6, unit: 'each' }],
};
const eggPantry = [pantryItem('Eggs', 1, 'each', 'eggs-1')];
const eggMatch = scoreRecipeAgainstPantry(eggRecipe, eggPantry);
assert(eggMatch.missing.length === 1 && eggMatch.missing[0].quantity === 5, 'egg shortfall is 5');
const eggGrocery = buildGroceryList([eggRecipe], [eggRecipe.id], eggPantry, {}, []);
assert(eggGrocery[0]?.quantity === 5, 'grocery lists egg shortfall quantity');

// --- Bug 2: duplicate merge is idempotent ---
const missing: RecipeIngredient[] = [{ name: 'Broccoli', ingredientId: 'broccoli', quantity: 2, unit: 'cup' }];
const first = mergeGroceryWithMissing([], missing, recipe.id, []);
const second = mergeGroceryWithMissing(first.items, missing, recipe.id, []);
assert(first.items.length === 1 && second.items.length === 1, 'duplicate missing merge should not duplicate rows');
assert(second.added.length === 0, 'second merge should add nothing');

// --- Bug 3 undo dismissals survive rebuild ---
const owner = 'test-user-dismiss';
const dismissals = readGroceryDismissals(owner);
assert(dismissals.size === 0, 'fresh dismissals empty');
addGroceryDismissals(owner, [groceryDismissalKey(recipe.id, 'Limes', 'each')]);
const dismissedRebuild = buildGroceryList(
  [recipe],
  [recipe.id],
  [],
  {},
  [],
  { groceryDismissals: readGroceryDismissals(owner) },
);
assert(!dismissedRebuild.some((g) => g.name === 'Limes'), 'dismissed lime stays off list after rebuild');

// --- Persist queue runs tasks in order ---
let order = '';
await enqueueGroceryPersist(async () => {
  order += 'a';
});
await enqueueGroceryPersist(async () => {
  order += 'b';
});
assert(order === 'ab', 'grocery persist queue should serialize');
clearGroceryDismissals(owner);

assert(inferGroceryCategoryFromName('rice') === 'dry_goods', 'rice should be dry goods');
assert(inferGroceryCategoryFromName('pasta') === 'dry_goods', 'pasta should be dry goods');
assert(inferGroceryCategoryFromName('black beans') === 'dry_goods', 'beans should be dry goods');
assert(inferGroceryCategoryFromName('spinach') === 'produce', 'spinach should be produce');

const checkedRecipeItem: GroceryListItem = {
  id: 'groc-limes::each',
  ingredientId: 'limes',
  name: 'Limes',
  category: 'produce',
  quantity: 2,
  unit: 'each',
  checked: true,
  sourceRecipeIds: [recipe.id],
  origin: 'plan',
};
const dismissalKeys = groceryDismissalKeysForItem(checkedRecipeItem);
addGroceryDismissals(owner, dismissalKeys);
const afterClearSim = buildGroceryList(
  [recipe],
  [recipe.id],
  [],
  {},
  [],
  { groceryDismissals: readGroceryDismissals(owner) },
);
assert(!afterClearSim.some((g) => g.name === 'Limes'), 'cleared checked recipe item stays off after dismissals');

const tomatoPantry: PantryItem[] = [
  {
    id: 'tomato-1',
    ingredientId: 'tomato',
    name: 'Tomato',
    category: 'produce',
    quantity: 1,
    unit: 'each',
    location: 'fridge',
    photoUri: null,
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  },
];
const tomatoRecipe: Recipe = {
  ...recipe,
  id: 'tomato-bake',
  ingredients: [{ name: 'Tomato', ingredientId: 'tomato', quantity: 250, unit: 'g' }],
};
const tomatoList = buildGroceryList([tomatoRecipe], [tomatoRecipe.id], tomatoPantry, {}, []);
assert(!tomatoList.some((g) => g.name === 'Tomato'), 'skip grocery line when pantry name matches but units differ');

const mergedManual = mergeManualGroceryLines(
  [
    {
      id: 'groc-limes',
      ingredientId: 'limes',
      name: 'Limes',
      category: 'produce',
      quantity: 3,
      unit: 'each',
      checked: false,
      sourceRecipeIds: ['r1'],
      origin: 'plan',
    },
  ],
  [createManualGroceryItem({ name: 'limes', quantity: 1, unit: 'each' })],
);
assert(mergedManual.length === 1, 'manual limes merges with recipe Limes');
assert(mergedManual[0].quantity === 4, 'merged grocery quantity sums');

const catalog = kitchenRecipesForPantryMatch([]);
const guestPlanList = buildGroceryList(catalog, ['pulled-pork'], [], {}, []);
assert(
  guestPlanList.length > 0,
  'grocery rebuild includes built-in catalog recipes referenced by meal plan',
);

const ledger = new Map<string, { pantryItemId: string; quantityAdded: number; unit: string }>();
const startPantry: PantryItem[] = [];
const line: GroceryListItem = {
  id: 'g1',
  ingredientId: 'banana',
  name: 'Bananas',
  category: 'produce',
  quantity: 2,
  unit: 'each',
  checked: true,
  sourceRecipeIds: [],
  origin: 'plan',
};
let afterCheck = applyGroceryCheckRestock(startPantry, line, ledger);
assert(afterCheck.length === 1, 'check adds pantry row once');
afterCheck = applyGroceryCheckRestock(afterCheck, line, ledger);
assert(afterCheck[0].quantity === 2, 'second check restock is idempotent');
const afterUncheck = reverseGroceryCheckRestock(afterCheck, 'g1', ledger);
assert(afterUncheck.length === 0, 'uncheck reverses restock');

console.log('All grocery regression checks passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
