/**
 * Pantry → recipe match → add missing → grocery → Smart Shop item prefill.
 * Run from mobile/: npm run test:grocery-flow
 */

import { kitchenRecipesForPantryMatch } from '../lib/recipeMatch/kitchenCatalogMerge';
import {
  buildPantryMatchIndex,
  filterRankedMatchesWithPartialFallback,
  scoreRecipeAgainstPantry,
} from '../lib/recipeMatch/match';
import { mergeGroceryWithMissing } from '../lib/recipeMatch/groceryFromMissing';
import { openGroceryItems } from '../lib/smartShop/aggregateDeals';
import type { GroceryListItem, PantryItem, Recipe } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function pantryFrom(names: string[]): PantryItem[] {
  return names.map((n, i) => ({
    id: `p${i}`,
    ingredientId: n.toLowerCase().replace(/\s+/g, '-'),
    name: n,
    category: 'dry_goods' as const,
    quantity: 1,
    unit: 'each',
    storageLocation: 'pantry' as const,
    updatedAt: new Date().toISOString(),
  }));
}

const scanPantry = pantryFrom([
  'canned beans',
  'pasta',
  'rice',
  'tomato sauce',
  'peanut butter',
  'broth',
  'tuna',
]);
const kitchen = kitchenRecipesForPantryMatch([]);
const { ranked } = buildPantryMatchIndex(kitchen, scanPantry);
const { matches } = filterRankedMatchesWithPartialFallback(ranked, 'best_match', 50, {
  minMatchedCount: 2,
  pantryItemCount: scanPantry.length,
});
assert(matches.length >= 1, 'expected at least one matched recipe for scan pantry');

const recipe = kitchen.find((r) => r.id === matches[0].recipeId);
assert(recipe, 'matched recipe should exist in kitchen catalog');

const match = scoreRecipeAgainstPantry(recipe, scanPantry);
assert(match.missing.length >= 1, 'recipe should have missing non-staple ingredients');

const firstMerge = mergeGroceryWithMissing([], match.missing, recipe.id, scanPantry);
assert(firstMerge.added.length >= 1, 'missing ingredients should add grocery rows');
assert(
  firstMerge.added.every((row) => row.sourceRecipeIds.includes(recipe.id)),
  'grocery rows should attribute recipe id',
);
assert(
  firstMerge.added.every((row) => !match.matched.some((m) => m.ingredient.name === row.name)),
  'grocery list should only contain missing items, not pantry hits',
);

const pantryNames = new Set(scanPantry.map((p) => p.name.toLowerCase()));
for (const row of firstMerge.added) {
  assert(!pantryNames.has(row.name.toLowerCase()), `should not list pantry item ${row.name}`);
}

const openItems = openGroceryItems(firstMerge.items);
assert(openItems.length === firstMerge.items.length, 'Smart Shop should prefill all open grocery rows');
assert(openItems.every((row) => firstMerge.items.some((g) => g.id === row.id)), 'Smart Shop uses same open items');

const secondMerge = mergeGroceryWithMissing(firstMerge.items, match.missing, recipe.id, scanPantry);
assert(secondMerge.added.length === 0, 'second add should merge not duplicate rows');
assert(secondMerge.items.length === firstMerge.items.length, 'deduped grocery list length stable');

console.log('grocery-recipe-smartshop-flow-check: OK');
