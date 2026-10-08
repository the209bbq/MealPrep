/**
 * Regression checks for Forky Round 3 QA fixes (FK3-1 … FK3-8).
 * Run: npx tsx scripts/forky-r3-fixes-check.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GroceryListItem, PantryItem, Recipe } from '../types/mealprep';
import {
  applyPantryDeductions,
  buildPantryDeductionLines,
  isWholeCountIngredientUnit,
  mealMadeReviewRowsWithDeductions,
  restorePantryFromDeductions,
  scaledPantryDeductionQuantity,
} from '../lib/mealPlan/pantryDeduction';
import { scoreRecipeForPantryDeduction } from '../lib/recipeMatch/match';
import { resolveGroceryListForServerSync } from '../lib/grocery/manualGroceryInsertLifecycle';
import { shouldReplaceForkinatorAutoPrompt } from '../lib/forkinator/forkinatorActivePrompt';
import {
  planStapleRestockLines,
  planStapleRestockLinesForCook,
} from '../lib/forkinator/restockReminders';

const mobileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (rel: string) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');

function pantryRow(partial: Partial<PantryItem> & Pick<PantryItem, 'id' | 'name' | 'quantity' | 'unit'>): PantryItem {
  return {
    ingredientId: partial.name.toLowerCase(),
    category: 'other' as PantryItem['category'],
    location: 'pantry' as PantryItem['location'],
    photoUri: null,
    expiresOn: null,
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...partial,
  };
}

function recipe(id: string, servings: number, ingredients: Recipe['ingredients']): Recipe {
  return {
    id,
    name: id,
    tag: 'dinner',
    description: '',
    servings,
    minutes: 10,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients,
    steps: ['Cook'],
    isMaster: false,
    createdAt: '',
  } as Recipe;
}

// FK3-2: scaled amounts; whole-count units round to whole numbers (min 1).
assert.equal(isWholeCountIngredientUnit('each'), true);
assert.equal(isWholeCountIngredientUnit('large'), true);
assert.equal(isWholeCountIngredientUnit('cup'), false);
const egg = { ingredientId: 'egg', name: 'Egg', quantity: 2, unit: 'each' };
assert.equal(scaledPantryDeductionQuantity(egg, 3 / 4), 2, '2 eggs × ¾ rounds to 2');
assert.equal(scaledPantryDeductionQuantity({ ...egg, name: 'yellow onion', unit: 'large', quantity: 1 }, 3 / 8), 1);
assert.equal(scaledPantryDeductionQuantity({ ...egg, name: 'garlic', unit: 'cloves', quantity: 2 }, 3 / 8), 1);
assert.equal(scaledPantryDeductionQuantity({ ...egg, name: 'flour', unit: 'cup', quantity: 2 }, 3 / 4), 1.5);
assert.equal(scaledPantryDeductionQuantity({ ...egg, quantity: 0 }, 1), 0);

const eggsPantry = [pantryRow({ id: 'p-eggs', name: 'Eggs', ingredientId: 'staple-eggs', quantity: 12, unit: 'each' })];
const omelette = recipe('bread-omelette', 4, [egg]);
const omeletteMatch = scoreRecipeForPantryDeduction(omelette, eggsPantry);
const reviewRows = mealMadeReviewRowsWithDeductions(omeletteMatch, omelette, {}, 3);
const lines = buildPantryDeductionLines(omeletteMatch, omelette, {}, new Set(), 3);
assert.equal(reviewRows.length, 1);
assert.equal(reviewRows[0]!.deductQuantity, 2, 'review shows the deducted amount');
assert.equal(lines[0]!.deductQuantity, reviewRows[0]!.deductQuantity, 'review and deduction match');
const { nextPantry } = applyPantryDeductions(eggsPantry, lines);
assert.equal(nextPantry[0]!.quantity, 10, '12 eggs → 10, not 10½');

// FK3-1 helper: undo restores exactly the deducted rows.
const restored = restorePantryFromDeductions(nextPantry, lines);
assert.equal(restored.find((row) => row.id === 'p-eggs')!.quantity, 12);

// FK3-4: egg yolk / egg white match the Eggs pantry row in the deduction path.
const aioli = recipe('aioli', 4, [
  { ingredientId: 'egg-yolk', name: 'Egg yolk', quantity: 1, unit: 'piece' },
  { ingredientId: 'garlic', name: 'Garlic', quantity: 2, unit: 'cloves' },
]);
const aioliMatch = scoreRecipeForPantryDeduction(aioli, eggsPantry);
assert.ok(
  aioliMatch.matched.some((row) => row.matchedPantryItem?.id === 'p-eggs'),
  'egg yolk should match Eggs',
);
const aioliRows = mealMadeReviewRowsWithDeductions(aioliMatch, aioli, {}, 4);
assert.ok(aioliRows.some((row) => row.matchedPantryItem?.id === 'p-eggs'), 'Eggs row appears in review');
const whites = recipe('meringue', 2, [{ ingredientId: 'egg-white', name: 'Egg whites', quantity: 3, unit: 'each' }]);
assert.ok(scoreRecipeForPantryDeduction(whites, eggsPantry).matched.some((row) => row.matchedPantryItem?.id === 'p-eggs'));

// FK3-6: a queued full-list sync keeps a manual add that finished saving meanwhile.
const groc = (id: string, name: string): GroceryListItem =>
  ({ id, name, ingredientId: name.toLowerCase(), quantity: 1, unit: 'each', checked: false }) as GroceryListItem;
const savedEggs = groc('3f1c2b9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', 'Eggs');
const resolved = resolveGroceryListForServerSync(
  [groc('groc-onion', 'Onion'), groc('manual-123', 'Eggs'), groc('manual-999', 'Milk')],
  new Map([['manual-123', savedEggs]]),
);
assert.deepEqual(resolved.map((row) => row.id), ['groc-onion', savedEggs.id]);

// FK3-7: lower priority never replaces a visible higher one.
assert.equal(shouldReplaceForkinatorAutoPrompt('aisleSort', 'scanner'), false);
assert.equal(shouldReplaceForkinatorAutoPrompt('aisleSort', 'greeting'), true);

// FK3-9: restock after cooking only covers rows the recipe deducted; eggs restock a dozen.
const stapleRow = (id: string, stapleId: string, name: string, quantity: number, unit: string) =>
  pantryRow({ id, name, ingredientId: `staple-${stapleId}`, quantity, unit });
const preCookEggs = stapleRow('s-eggs', 'eggs', 'Eggs', 4, 'each');
const lowMilk = stapleRow('s-milk', 'milk', 'Milk', 0.2, 'gal');
const afterCook = [{ ...preCookEggs, quantity: 2 }, lowMilk];
const cookRestock = planStapleRestockLinesForCook(afterCook, [preCookEggs], []);
assert.deepEqual(cookRestock.map((line) => line.stapleId), ['eggs'], 'eggs-only recipe must not restock milk');
assert.equal(cookRestock[0]!.quantity, 12, 'eggs restock is a dozen');
assert.equal(cookRestock[0]!.unit, 'each');
const usedUp = planStapleRestockLinesForCook([lowMilk], [preCookEggs], []);
assert.deepEqual(usedUp.map((line) => line.stapleId), ['eggs'], 'eggs used up completely still restock');
assert.equal(planStapleRestockLinesForCook(afterCook, [], []).length, 0, 'nothing deducted → no restock');
assert.equal(
  planStapleRestockLines([stapleRow('s-e2', 'eggs', 'Eggs', 1, 'each')], [])[0]!.quantity,
  12,
  'eggs default size wins over the 6 ct option',
);

// Source guards.
const appContext = read('context/AppContext.tsx');
assert.match(appContext, /mealMadeUndoRef/, 'FK3-1: meal-made undo lives in a ref');
assert.ok(!/if \(!mealMadeUndo\) return;/.test(appContext), 'FK3-1: no stale-state undo guard');
assert.match(appContext, /runMealMadeUndo\(undoState\)/, 'FK3-1: toast Undo closes over its own snapshot');
assert.match(appContext, /enqueueGroceryPersist\(\(\) => insertGroceryItem/, 'FK3-6: manual insert is serialized');

const home = read('app/(tabs)/index.tsx');
const openDetailBlock = home.slice(home.indexOf('const openDetail = useCallback('), home.indexOf('const openSwapRecipe'));
assert.ok(!openDetailBlock.includes('beginCookViewSession('), 'FK3-3: viewing a recipe must not start a cook session');
assert.match(read('components/mealCalendar/ScheduleRecipeSheet.tsx'), /beginCookViewSession\(target\)/);
assert.match(home, /kitchenRecipesForPantryMatch\(accountRecipes\)/, 'FK3-5: deep link resolves from quiz catalog');

const overlay = read('components/forkinator/ForkinatorOverlay.tsx');
assert.match(overlay, /shouldReplaceForkinatorAutoPrompt\(current, kind\)/, 'FK3-7: priority wired into showAutoPrompt');
assert.equal((overlay.match(/if \(sessionAutoPromptShownRef\.current\) return;/g) ?? []).length >= 4, true, 'FK3-7: timers respect session');
assert.match(overlay, /aisleSortPromptVisible && !isGroceryScreen/, 'FK3-8: aisle hides off Grocery');
assert.match(overlay, /mascotReady &&\s+isHomeScreen &&\s+!mealMadeReviewOpen &&/, 'FK3-8: fork-in-road only on Home, never behind Made-it');
assert.match(overlay, /!isHomeScreen && forkInRoadDismissedThisVisit/, 'fork-in-road close resets when leaving Home');
assert.ok(!overlay.includes('shouldAutoShowForkInRoadPrompt'), 'fork-in-road on Home has no daily limit/cooldown');
assert.ok(!overlay.includes('subscribeForkInRoadHomeIdleReady'), 'fork-in-road on Home has no idle wait');
assert.match(overlay, /removeGroceryItem\(target\.id\)/, 'FK3-6: restock Undo removes by id');
assert.match(overlay, /planStapleRestockLinesForCook\(/, 'FK3-9: overlay plans restock from deducted rows');
assert.ok(!/planStapleRestockLines\(payload\.nextPantry/.test(overlay), 'FK3-9: never the whole pantry');
assert.match(appContext, /deductedPantryRows: lines/, 'FK3-9: cook flow passes deducted rows');

console.log('forky-r3-fixes-check: ok');
