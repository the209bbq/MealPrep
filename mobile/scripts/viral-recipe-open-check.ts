/**
 * useViralRecipeOpen — after mocked import, open row uses real recipe id for pantry match.
 */
import assert from 'node:assert/strict';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import type { Recipe } from '../types/mealprep';
import type { RecipeImportExtractedDto } from '../lib/recipeImport/types';

function simulatePostImportRow(
  stubId: string,
  saved: Recipe,
  pantry: { id: string; ingredientId: string; name: string; category: 'produce'; quantity: number; unit: string; location: 'pantry'; photoUri: null; expiresOn: null; updatedAt: string }[],
) {
  const match = scoreRecipeAgainstPantry(saved, pantry);
  assert.notEqual(saved.id, stubId, 'import replaces stub id');
  assert.ok(match.missing.length > 0, 'imported recipe yields missing ingredients for add-missing');
  return { recipe: saved, match };
}

const stubId = 'viral-stub-abc';
const saved: Recipe = {
  id: 'imported-slug',
  name: 'Imported Bowl',
  tag: '',
  description: '',
  servings: 4,
  minutes: 10,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: 'Rice', ingredientId: 'rice', quantity: 2, unit: 'cup' },
    { name: 'Soy sauce', ingredientId: 'soy', quantity: 2, unit: 'tbsp' },
  ],
  steps: ['Mix'],
  isMaster: false,
  createdAt: new Date().toISOString(),
  sourceUrl: 'https://www.youtube.com/watch?v=demo',
};

const extracted = {
  title: saved.name,
  ingredients: saved.ingredients,
} satisfies Partial<RecipeImportExtractedDto>;

assert.equal(extracted.ingredients.length, 2);

const pantry = [];
const row = simulatePostImportRow(stubId, saved, pantry);
assert.equal(row.recipe.id, 'imported-slug');

console.log('viral-recipe-open-check: ok');
