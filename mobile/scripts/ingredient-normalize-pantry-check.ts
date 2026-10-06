/**
 * Pantry scan name normalization checks (brands, plurals, accents, synonyms).
 * Run from mobile/: npm run test:ingredient-normalize-pantry
 */

import {
  areSameIngredientForPantryDedupe,
  canonicalIngredientPhrase,
  ingredientMatchScore,
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
  canonicalIngredientPhrase('WinCo Sliced Black Olives') === 'sliced black olive',
  'strip WinCo and keep sliced black olives specificity',
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
assert(canonicalIngredientPhrase('King Hawaiian Sweet Rolls') === 'roll', 'hawaiian rolls -> rolls');
assert(
  canonicalIngredientPhrase('Hungry Jack Pancake Syrup') === 'pancake syrup',
  'pancake syrup must not double-apply syrup synonym',
);
assert(canonicalIngredientPhrase('Peach Halves') === 'peach half', 'peach halves -> peach half');
assert(canonicalIngredientPhrase('Chili With Beans') === 'chili with beans', 'keep beans in chili with beans');
assert(canonicalIngredientPhrase('Instant Oatmeal') === 'instant oatmeal', 'instant oatmeal stays whole phrase');

assert(
  !areSameIngredientForPantryDedupe('black olives', 'chopped olives'),
  'black olives and chopped olives must not dedupe together',
);
assert(
  !areSameIngredientForPantryDedupe('diced tomatoes', 'marinara sauce'),
  'diced tomatoes and marinara sauce must not dedupe together',
);

assert(ingredientMatchScore('diced tomatoes', 'tomato paste') < 0.72, 'diced tomatoes vs tomato paste');
assert(ingredientMatchScore('diced tomatoes', 'tomato soup') < 0.72, 'diced tomatoes vs tomato soup');
assert(ingredientMatchScore('diced tomatoes', 'ketchup') < 0.72, 'diced tomatoes vs ketchup');
assert(
  ingredientMatchScore('1 large yellow onion, diced', 'Onion') >= 0.72,
  'yellow onion diced matches onion',
);
assert(
  ingredientMatchScore('2 tablespoons unsalted butter, softened', 'Butter') >= 0.72,
  'descriptive butter matches butter',
);
assert(ingredientMatchScore('butter', 'peanut butter') < 0.72, 'butter vs peanut butter');

const tokens = tokenizeIngredientName('Essential Everyday All Purpose Flour 5 lb');
assert(tokens.join(' ').includes('all-purpose'), 'all purpose flour phrase');

console.log('OK: ingredient normalize pantry checks passed');
