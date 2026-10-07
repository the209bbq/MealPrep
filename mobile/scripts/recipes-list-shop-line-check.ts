import assert from 'node:assert/strict';
import { RECIPES_COPY } from '../config/recipesCopy.ts';
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

assert.equal(recipeListShopLine(stubMatch({ missingCount: 0, missing: [] })), 'Ready to cook! 🎉');
assert.equal(
  recipeListShopLine(
    stubMatch({
      missingCount: 1,
      missing: [{ ingredientId: 'x', name: 'salt', quantity: 1, unit: 'tsp' }],
    }),
  ),
  'Missing 1 item',
);
assert.equal(
  recipeListShopLine(
    stubMatch({
      missingCount: 3,
      missing: [
        { ingredientId: 'a', name: 'a', quantity: 1, unit: '' },
        { ingredientId: 'b', name: 'b', quantity: 1, unit: '' },
        { ingredientId: 'c', name: 'c', quantity: 1, unit: '' },
      ],
    }),
  ),
  'Missing 3 items',
);
assert.equal(
  recipeListShopLine(stubMatch({ totalIngredients: 0, missingCount: 0, matchedCount: 0 })),
  RECIPES_COPY.recipeCard.previewNoIngredients,
  'saved creator preview without ingredients should not show checking pantry',
);

console.log('recipes-list-shop-line-check: ok');
