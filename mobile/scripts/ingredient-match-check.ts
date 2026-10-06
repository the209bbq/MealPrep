/**
 * Descriptive recipe-line ↔ pantry matching (simweek butter chicken / chili cases).
 * Run from mobile/: npm run test:ingredient-match
 */

import { buildPantryMatchIndex, scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import { ingredientMatchScore } from '../lib/recipeMatch/ingredientNormalize';
import type { PantryItem, Recipe } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function pantryItem(name: string, id = name.toLowerCase().replace(/\s+/g, '-')): PantryItem {
  return {
    id: `p-${id}`,
    ingredientId: id,
    name,
    category: 'produce',
    quantity: 10,
    unit: 'each',
    location: 'pantry',
    expiresOn: null,
    updatedAt: new Date().toISOString(),
  };
}

const pantry: PantryItem[] = [
  pantryItem('Butter'),
  pantryItem('Onion'),
  pantryItem('Salt'),
  pantryItem('Garlic'),
  pantryItem('Rice', 'rice'),
];

assert(
  ingredientMatchScore('2 tablespoons unsalted butter, softened', 'Butter') >= 0.72,
  'descriptive butter line matches pantry butter',
);
assert(
  ingredientMatchScore('1 large yellow onion, diced', 'Onion') >= 0.72,
  'yellow onion diced matches onion',
);
assert(
  ingredientMatchScore('salt (plus more to taste)', 'Salt') >= 0.72,
  'salt with note matches salt',
);
assert(
  ingredientMatchScore('garlic (minced)', 'Garlic') >= 0.72,
  'garlic minced matches garlic',
);
assert(
  ingredientMatchScore('butter', 'peanut butter') < 0.72,
  'butter must not match peanut butter',
);
assert(
  ingredientMatchScore('garlic', 'garlic powder') < 0.72,
  'fresh garlic must not match garlic powder',
);
assert(
  ingredientMatchScore('2 cups hot water', 'Salt') < 0.72,
  'hot water must not match salt',
);

const butterChicken: Recipe = {
  id: 'import-butter',
  name: 'Butter Chicken',
  tag: '',
  description: '',
  servings: 4,
  minutes: 40,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: '2 tablespoons unsalted butter, softened', ingredientId: 'butter', quantity: 2, unit: 'tbsp' },
    { name: '1 large yellow onion, diced', ingredientId: 'onion', quantity: 1, unit: 'each' },
    { name: 'salt (plus more to taste)', ingredientId: 'salt', quantity: 1, unit: 'tsp' },
    { name: 'garlic (minced)', ingredientId: 'garlic', quantity: 4, unit: 'clove' },
    { name: '4 cups hot water', ingredientId: 'water', quantity: 4, unit: 'cup' },
    { name: 'chicken thighs', ingredientId: 'chicken', quantity: 2, unit: 'lb' },
  ],
  steps: [],
  isMaster: false,
  createdAt: '',
};

const match = scoreRecipeAgainstPantry(butterChicken, pantry);
assert(
  match.matchedCount >= 3,
  `butter chicken matches pantry staples (got ${match.matchedCount} matched, missing ${match.missing.map((m) => m.name).join(', ')})`,
);
assert(
  match.missing.length === 1 && match.missing[0].name.includes('chicken'),
  'only chicken thighs should be missing',
);
assert(
  !match.missing.some((row) => row.name.toLowerCase().includes('water')),
  'water is never missing',
);

const index = buildPantryMatchIndex([butterChicken], pantry);
const missingNames = index.byRecipeId.get('import-butter')?.missing.map((m) => m.name) ?? [];
assert(!missingNames.some((n) => n.toLowerCase().includes('water')), 'water excluded from grocery missing');

console.log('OK: ingredient-match checks passed');
