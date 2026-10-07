/**
 * G1-1: grocery recipe source line resolves saved MealDB / kitchen titles.
 */
import assert from 'node:assert/strict';
import {
  buildGroceryRecipeNameById,
  groceryRecipeSourceLabels,
} from '../lib/grocery/recipeLabels.ts';
import { savedRefKeyMealDb } from '../lib/savedRecipes/keys.ts';
import type { SavedRecipeRecord } from '../lib/savedRecipes/types.ts';
import { mealDbRecipeId } from '../lib/mealdb/slug.ts';

const mealdbId = '53155';
const recipeId = mealDbRecipeId(mealdbId);
const saved: SavedRecipeRecord = {
  refKey: savedRefKeyMealDb(mealdbId),
  sourceType: 'mealdb',
  mealdbId,
  title: 'Spanish chicken pie',
  imageUrl: null,
  preview: {
    kind: 'mealdb',
    shape: {
      id: recipeId,
      name: 'Spanish chicken pie',
      tag: '',
      description: '',
      servings: 4,
      minutes: 30,
      ingredients: [],
      steps: [],
      isMaster: false,
    },
  },
  savedAt: new Date().toISOString(),
};

const nameById = buildGroceryRecipeNameById({
  recipes: [],
  savedRecords: [saved],
});

assert.equal(nameById.get(recipeId), 'Spanish chicken pie');
assert.equal(
  groceryRecipeSourceLabels([recipeId], nameById),
  'Spanish chicken pie',
);
assert.equal(groceryRecipeSourceLabels([recipeId], new Map()), '');

console.log('grocery-recipe-labels-check: ok');
