import assert from 'node:assert/strict';
import type { PantryItem } from '../types/mealprep';
import { buildRotatingPantrySearchPlans } from '../lib/recipeDiscovery/pantryQueryPlans';
import { applyFeedDiversity } from '../lib/recipes/feedDiversity';
import {
  collapseNearDuplicateRecipeRows,
  mainProteinBucket,
  titleTokenJaccard,
} from '../lib/recipes/nearDuplicate';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { Recipe } from '../types/mealprep';

function matchStub(recipeId: string, overrides: Partial<RecipePantryMatch> = {}): RecipePantryMatch {
  return {
    recipeId,
    recipeName: recipeId,
    totalIngredients: 4,
    matchedCount: 3,
    missingCount: 1,
    percentMatch: 75,
    matched: [],
    missing: [],
    ...overrides,
  };
}

const pantry: PantryItem[] = [
  {
    id: '1',
    ingredientId: 'i1',
    name: 'canned beans',
    quantity: 1,
    unit: 'can',
    category: 'pantry',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
  {
    id: '2',
    ingredientId: 'i2',
    name: 'pasta',
    quantity: 1,
    unit: 'box',
    category: 'pantry',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
  {
    id: '3',
    ingredientId: 'i3',
    name: 'rice',
    quantity: 1,
    unit: 'bag',
    category: 'pantry',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
  {
    id: '4',
    ingredientId: 'i4',
    name: 'tomato sauce',
    quantity: 1,
    unit: 'jar',
    category: 'pantry',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
  {
    id: '5',
    ingredientId: 'i5',
    name: 'peanut butter',
    quantity: 1,
    unit: 'jar',
    category: 'pantry',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
  {
    id: '6',
    ingredientId: 'i6',
    name: 'broth',
    quantity: 1,
    unit: 'carton',
    category: 'pantry',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '',
  },
];

const plansA = buildRotatingPantrySearchPlans(pantry, { seed: 0 });
const plansB = buildRotatingPantrySearchPlans(pantry, { seed: 2 });
assert.ok(plansA.length >= 3, 'should build multiple search plans');
assert.notEqual(plansA[0].search, plansB[0].search, 'rotating seed should change first query');
assert.ok(plansA.some((plan) => plan.page >= 1 && plan.page <= 12), 'page should be bounded');

assert.ok(titleTokenJaccard('Lemon Herb Chicken', 'Easy Lemon Herb Chicken Dinner') >= 0.7);

const chickenRecipe = (id: string, name: string): Recipe => ({
  id,
  name,
  tag: 'Lean',
  description: 'dinner',
  servings: 4,
  minutes: 30,
  calories: 400,
  protein: 40,
  carbs: 10,
  fat: 8,
  ingredients: [
    { ingredientId: 'c', name: 'chicken breast', quantity: 1, unit: 'lb' },
    { ingredientId: 'l', name: 'lemon', quantity: 1, unit: 'each' },
  ],
  steps: ['cook'],
  isMaster: false,
  createdAt: '',
});

const nearDupRows: RecipesTabRow[] = [
  {
    kind: 'kitchen',
    recipe: chickenRecipe('a', 'Lemon Herb Chicken Bowl'),
    match: matchStub('a', { matchedCount: 4 }),
  },
  {
    kind: 'kitchen',
    recipe: chickenRecipe('b', 'Easy Lemon Herb Chicken Dinner'),
    match: matchStub('b', { matchedCount: 3 }),
  },
];

assert.equal(collapseNearDuplicateRecipeRows(nearDupRows).length, 1);

const chickenRows: RecipesTabRow[] = Array.from({ length: 5 }, (_, index) => ({
  kind: 'kitchen' as const,
  recipe: chickenRecipe(`c-${index}`, `Chicken idea ${index}`),
  match: matchStub(`c-${index}`, { matchedCount: 5 - index }),
}));

const diversifiedChickenOnly = applyFeedDiversity(chickenRows, { topWindow: 10, maxPerProtein: 2, seed: 0 });
assert.equal(diversifiedChickenOnly.length, 5);
assert.ok(
  diversifiedChickenOnly.slice(0, 2).every((row) => mainProteinBucket(row) === 'chicken'),
  'best matches surface first',
);

const mixedRows: RecipesTabRow[] = [
  ...chickenRows,
  {
    kind: 'kitchen',
    recipe: {
      ...chickenRecipe('beef-1', 'Steak tips dinner'),
      ingredients: [{ ingredientId: 'b', name: 'beef sirloin', quantity: 1, unit: 'lb' }],
    },
    match: matchStub('beef-1', { matchedCount: 4, missingCount: 0 }),
  },
  {
    kind: 'kitchen',
    recipe: {
      ...chickenRecipe('veg-1', 'Roasted veggie bowl'),
      ingredients: [{ ingredientId: 'z', name: 'zucchini', quantity: 2, unit: 'each' }],
    },
    match: matchStub('veg-1', { matchedCount: 3 }),
  },
];

const diversified = applyFeedDiversity(mixedRows, { topWindow: 10, maxPerProtein: 2, seed: 0 });
const beefIndex = diversified.findIndex((row) => mainProteinBucket(row) === 'beef');
assert.ok(beefIndex >= 0 && beefIndex < 6, 'beef should surface near the top when mixed with chicken');

console.log('recipes-diversity-check: ok');
