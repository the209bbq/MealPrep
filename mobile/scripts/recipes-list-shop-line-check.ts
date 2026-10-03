import assert from 'node:assert/strict';
import { recipeListShopLine } from '../lib/recipes/recipeListShopLine.ts';
import type { RecipePantryMatch } from '../lib/recipeMatch';

function stubMatch(overrides: Partial<RecipePantryMatch>): RecipePantryMatch {
  return {
    recipeId: 'r1',
    recipeName: 'Test',
    totalIngredients: 5,
    matchedCount: 2,
    missingCount: 3,
    percentMatch: 40,
    matched: [],
    missing: [],
    ...overrides,
  };
}

assert.equal(recipeListShopLine(stubMatch({ missingCount: 0 })), 'Ready to cook! 🎉');
assert.equal(recipeListShopLine(stubMatch({ missingCount: 1 })), 'Missing 1 item');
assert.equal(recipeListShopLine(stubMatch({ missingCount: 3 })), 'Missing 3 items');

console.log('recipes-list-shop-line-check: ok');
