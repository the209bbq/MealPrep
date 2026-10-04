import assert from 'node:assert/strict';
import { KITCHEN_CATALOG } from '../data/kitchenCatalog';
import { applyRecipesTabFilters } from '../config/recipesTabFilters';
import { buildPantryMatchIndex } from '../lib/recipeMatch';
import { kitchenRecipesForPantryMatch } from '../lib/recipeMatch/kitchenCatalogMerge';
import { buildRecipesTabCatalogRows } from '../lib/recipes/recipesTabCatalog';
import type { PantryItem } from '../types/mealprep';

const kitchenRecipes = kitchenRecipesForPantryMatch([]);
assert.ok(kitchenRecipes.length >= KITCHEN_CATALOG.length, 'kitchen catalog should load for empty pantry');

const emptyPantry: PantryItem[] = [];
const emptyMatches = buildPantryMatchIndex(kitchenRecipes, emptyPantry);
const emptyCatalog = buildRecipesTabCatalogRows({
  kitchenRecipes,
  pantryMatches: emptyMatches,
  discoverySuggestions: [],
});
assert.ok(
  emptyCatalog.length >= KITCHEN_CATALOG.length,
  'empty pantry should still show full kitchen catalog for browsing',
);

const sparsePantry: PantryItem[] = [
  {
    id: 'p1',
    ingredientId: 'ing-pasta',
    name: 'pasta',
    category: 'dry_goods',
    quantity: 2,
    unit: 'lb',
    location: 'pantry',
  },
  {
    id: 'p2',
    ingredientId: 'ing-rice',
    name: 'rice',
    category: 'dry_goods',
    quantity: 1,
    unit: 'lb',
    location: 'pantry',
  },
];
const sparseMatches = buildPantryMatchIndex(kitchenRecipes, sparsePantry);
const sparseCatalog = buildRecipesTabCatalogRows({
  kitchenRecipes,
  pantryMatches: sparseMatches,
  discoverySuggestions: [],
});
assert.equal(
  sparseCatalog.length,
  kitchenRecipes.length,
  'pantry matches should rank but not hide non-matching kitchen recipes',
);
assert.ok(
  sparseCatalog[0].match.matchedCount >= sparseCatalog[sparseCatalog.length - 1].match.matchedCount,
  'best pantry matches should sort first',
);

const filtered = applyRecipesTabFilters(sparseCatalog, {
  time: '30',
  difficulty: 'any',
  meal: 'any',
  shop: 'any',
});
assert.ok(filtered.length < sparseCatalog.length, 'filters should narrow the full catalog');
assert.ok(filtered.length > 0, 'some catalog recipes should match a 30 min filter');

console.log('recipes-tab-catalog-check: ok');
