/**
 * Pantry scan name normalization checks (brands, plurals, accents, synonyms).
 * Run from mobile/: npm run test:ingredient-normalize-pantry
 */

import {
  canonicalIngredientPhrase,
  normalizeIngredientName,
  tokenizeIngredientName,
} from '../lib/recipeMatch/ingredientNormalize';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(
  canonicalIngredientPhrase('WinCo Sliced Black Olives') === 'black olive',
  'strip WinCo and keep black olives specificity',
);
assert(
  canonicalIngredientPhrase("Campbell's Cream of Mushroom Soup") === 'cream of mushroom soup',
  'apostrophe brand strip without stray s',
);
assert(canonicalIngredientPhrase('Roma Tomatoes').endsWith('tomato'), 'tomatoes -> tomato not tomatoe');
assert(!canonicalIngredientPhrase('Roma Tomatoes').includes('tomatoe'), 'no tomatoe stem');
assert(canonicalIngredientPhrase('Yukon Potatoes').endsWith('potato'), 'potatoes -> potato');
assert(
  normalizeIngredientName('La Costeña Jalapeños').includes('jalape'),
  'keep accented letters in normalized text',
);
assert(
  canonicalIngredientPhrase('Kraft Macaroni & Cheese') === 'macaroni and cheese',
  'ampersand becomes and',
);
assert(
  canonicalIngredientPhrase('Libby\'s 100% Pure Pumpkin') === 'pumpkin puree',
  'pure pumpkin maps to pumpkin puree',
);
assert(canonicalIngredientPhrase('Quaker Old Fashioned Oats') === 'oat', 'oats synonym collapses to oat token');
assert(
  canonicalIngredientPhrase('Hungry Jack Pancake Syrup').includes('pancake syrup'),
  'syrup maps toward pancake syrup',
);
assert(canonicalIngredientPhrase('King Hawaiian Sweet Rolls') === 'roll', 'hawaiian rolls -> rolls');

const tokens = tokenizeIngredientName('Essential Everyday All Purpose Flour 5 lb');
assert(tokens.join(' ').includes('all-purpose'), 'all purpose flour phrase');

console.log('OK: ingredient normalize pantry checks passed');
