import assert from 'node:assert/strict';
import { mealDbApiBaseUrl, mealDbMealPageUrl } from '../config/mealdb';
import {
  mealDbIngredientPairs,
  mealDbMealToAppRecipe,
  mealDbMealToNormalizedShape,
} from '../lib/mealdb/normalize';
import { parseMealDbMeasure } from '../lib/mealdb/parseMeasure';
import { splitRecipeInstructionText } from '../lib/recipes/normalizedRecipeShape';
import { scoreRecipeAgainstPantry } from '../lib/recipeMatch';
import type { MealDbMealDetail } from '../lib/mealdb/types';
import type { PantryItem } from '../types/mealprep';

assert.equal(mealDbApiBaseUrl().includes('/api/json/v1/1/'), true);
assert.equal(mealDbMealPageUrl('52772'), 'https://www.themealdb.com/meal/52772');

assert.deepEqual(parseMealDbMeasure('2 tbsp'), { quantity: 2, unit: 'tbsp' });
assert.deepEqual(parseMealDbMeasure(''), { quantity: 1, unit: 'each' });

const steps = splitRecipeInstructionText('Step one.\r\nStep two.');
assert.equal(steps.length, 2);

const sample: MealDbMealDetail = {
  idMeal: '52772',
  strMeal: 'Teriyaki Chicken Casserole',
  strCategory: 'Chicken',
  strArea: 'Japanese',
  strInstructions: 'Preheat oven.\nBake until done.',
  strMealThumb: 'https://www.themealdb.com/images/media/meals/wruvqv1511553471.jpg',
  strTags: null,
  strYoutube: 'https://www.youtube.com/watch?v=abc',
  strSource: 'https://example.com/recipe',
  strIngredient1: 'soy sauce',
  strMeasure1: '3/4 cup',
  strIngredient2: 'chicken thighs',
  strMeasure2: '1 lb',
  strIngredient3: '',
  strMeasure3: '',
};

const pairs = mealDbIngredientPairs(sample);
assert.equal(pairs.length, 2);
assert.equal(pairs[0]!.name, 'soy sauce');
assert.equal(pairs[0]!.quantity, 0.75);

const shape = mealDbMealToNormalizedShape(sample);
assert.equal(shape.id, 'mealdb-52772');
assert.equal(shape.steps.length, 2);
assert.equal(shape.sourceType, 'themealdb');

const recipe = mealDbMealToAppRecipe(sample);
assert.equal(recipe.ingredients.length, 2);
assert.equal(recipe.imageUrl, sample.strMealThumb);

const pantry: PantryItem[] = [
  {
    id: 'p1',
    ingredientId: 'soy-sauce',
    name: 'soy sauce',
    category: 'condiments',
    quantity: 1,
    unit: 'bottle',
    location: 'pantry',
    photoUri: null,
    expiresOn: null,
    updatedAt: '2026-01-01',
  },
];

const match = scoreRecipeAgainstPantry(recipe, pantry);
assert.equal(match.missingCount, 1);

console.log('mealdb-normalize-check: ok');
