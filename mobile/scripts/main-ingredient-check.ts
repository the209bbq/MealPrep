/**
 * Main-ingredient filter heuristics + ranking order.
 * Run from mobile/: npm run test:main-ingredient
 */

import type { Recipe } from '../types/mealprep';
import {
  compareMainIngredientRanking,
  ingredientNameMatchesPick,
  isMainIngredient,
  isMinorIngredientUse,
  mainIngredientPickFromLabel,
  recipeTitleMatchesPick,
  sortRowsByMainIngredientRanking,
} from '../lib/mainIngredient';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const chickenPick = mainIngredientPickFromLabel('chicken');

const chickenThighRecipe: Recipe = {
  id: 'r1',
  name: 'Weeknight skillet dinner',
  tag: 'dinner',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 400,
  protein: 30,
  carbs: 10,
  fat: 12,
  ingredients: [
    { ingredientId: '1', name: 'chicken thighs', quantity: 1.5, unit: 'lb' },
    { ingredientId: '2', name: 'olive oil', quantity: 1, unit: 'tbsp' },
    { ingredientId: '3', name: 'parsley', quantity: 1, unit: 'tbsp' },
  ],
  steps: [],
  isMaster: false,
  createdAt: '',
};

assert(isMainIngredient(chickenThighRecipe, chickenPick), 'chicken thighs at lb weight should be main');
assert(
  !isMinorIngredientUse(chickenThighRecipe.ingredients[0]),
  'primary protein is not minor',
);
assert(isMinorIngredientUse(chickenThighRecipe.ingredients[2]), 'garnish-scale parsley is minor');

const garnishChicken: Recipe = {
  ...chickenThighRecipe,
  id: 'r2',
  name: 'Garden salad',
  ingredients: [
    { ingredientId: '1', name: 'mixed greens', quantity: 4, unit: 'cup' },
    { ingredientId: '2', name: 'chicken', quantity: 0.25, unit: 'cup' },
    { ingredientId: '3', name: 'lemon juice', quantity: 1, unit: 'tbsp' },
  ],
};
assert(!isMainIngredient(garnishChicken, chickenPick), 'tiny chicken garnish should not count as main');

const titleChicken: Recipe = {
  ...garnishChicken,
  id: 'r3',
  name: 'Chicken Caesar salad',
};
assert(isMainIngredient(titleChicken, chickenPick), 'title match should count even with small amount');

assert(
  ingredientNameMatchesPick('boneless chicken breast', chickenPick),
  'category chicken matches breast',
);
assert(
  ingredientNameMatchesPick('chicken drumsticks', mainIngredientPickFromLabel('chicken')),
  'drumsticks match chicken category pick',
);

assert(
  recipeTitleMatchesPick('Creamy Tuscan Chicken', chickenPick),
  'title token match for chicken',
);

const beefPick = mainIngredientPickFromLabel('ground beef');
const beefRecipe: Recipe = {
  ...chickenThighRecipe,
  id: 'r4',
  name: 'Taco night',
  ingredients: [
    { ingredientId: '1', name: 'ground beef', quantity: 1, unit: 'lb' },
    { ingredientId: '2', name: 'taco seasoning', quantity: 1, unit: 'tbsp' },
  ],
};
assert(isMainIngredient(beefRecipe, beefPick), 'ground beef lb share is main');

type RankRow = { id: string; recipe: Recipe; match: { recipeId: string; recipeName: string; totalIngredients: number; matchedCount: number; missingCount: number; percentMatch: number; matched: []; missing: [] } };

const rows: RankRow[] = [
  {
    id: 'a',
    recipe: { ...beefRecipe, id: 'a', ingredients: beefRecipe.ingredients },
    match: {
      recipeId: 'a',
      recipeName: 'a',
      totalIngredients: 2,
      matchedCount: 1,
      missingCount: 3,
      percentMatch: 50,
      matched: [],
      missing: [],
    },
  },
  {
    id: 'b',
    recipe: { ...beefRecipe, id: 'b' },
    match: {
      recipeId: 'b',
      recipeName: 'b',
      totalIngredients: 2,
      matchedCount: 2,
      missingCount: 1,
      percentMatch: 80,
      matched: [],
      missing: [],
    },
  },
  {
    id: 'c',
    recipe: { ...beefRecipe, id: 'c' },
    match: {
      recipeId: 'c',
      recipeName: 'c',
      totalIngredients: 2,
      matchedCount: 2,
      missingCount: 1,
      percentMatch: 80,
      matched: [],
      missing: [],
    },
  },
];

const sorted = sortRowsByMainIngredientRanking(
  rows,
  (row) => row.recipe,
  (row) => row.match,
);
assert(sorted[0].id === 'b' || sorted[0].id === 'c', 'fewest missing first');
assert(sorted[sorted.length - 1].id === 'a', 'most missing last');

const costCache = new Map<string, number | null>();
const cmp = compareMainIngredientRanking(
  rows[1].recipe,
  rows[1].match,
  1,
  rows[2].recipe,
  rows[2].match,
  2,
  costCache,
);
assert(cmp < 0, 'equal missing: lower index (popularity) wins when costs tie');

console.log('main-ingredient-check: ok');
