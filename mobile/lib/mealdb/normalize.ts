import { mealDbMealPageUrl } from '../../config/mealdb';
import { sanitizeHttpUrl } from '../recipeImport/safeHttpUrl';
import {
  mapNormalizedRecipeToAppRecipe,
  splitRecipeInstructionText,
  type NormalizedRecipeIngredient,
  type NormalizedRecipeShape,
} from '../recipes/normalizedRecipeShape';
import type { Recipe } from '../../types/mealprep';
import { parseMealDbMeasure } from './parseMeasure';
import type { MealDbMealDetail } from './types';
import { mealDbRecipeId } from './slug';

const INGREDIENT_SLOT_COUNT = 20;

export function mealDbIngredientPairs(meal: MealDbMealDetail): NormalizedRecipeIngredient[] {
  const rows: NormalizedRecipeIngredient[] = [];
  for (let index = 1; index <= INGREDIENT_SLOT_COUNT; index += 1) {
    const name = meal[`strIngredient${index}`]?.trim();
    if (!name) continue;
    const measure = meal[`strMeasure${index}`]?.trim() ?? '';
    const { quantity, unit } = parseMealDbMeasure(measure);
    rows.push({ name, quantity, unit });
  }
  return rows;
}

export function mealDbMealToNormalizedShape(meal: MealDbMealDetail): NormalizedRecipeShape {
  const idMeal = meal.idMeal.trim();
  const category = meal.strCategory?.trim();
  const area = meal.strArea?.trim();
  const tagParts = [area, category].filter(Boolean);
  const youtube = sanitizeHttpUrl(meal.strYoutube);
  const publisher = sanitizeHttpUrl(meal.strSource);
  const mealPage = mealDbMealPageUrl(idMeal);

  return {
    id: mealDbRecipeId(idMeal),
    name: meal.strMeal.trim() || 'Recipe',
    tag: tagParts.length > 0 ? tagParts.join(' · ') : 'Classic',
    description: category
      ? `${category} recipe from TheMealDB.`
      : 'Classic recipe from TheMealDB.',
    servings: 4,
    minutes: 45,
    ingredients: mealDbIngredientPairs(meal),
    steps: splitRecipeInstructionText(meal.strInstructions ?? ''),
    isMaster: true,
    imageUrl: meal.strMealThumb?.trim() || null,
    sourceUrl: mealPage,
    sourceType: 'themealdb',
    sourceTitle: 'TheMealDB',
    sourceAuthorUrl: publisher ?? undefined,
    sourceChannelUrl: youtube ?? undefined,
    prepMinutes: null,
    cookMinutes: null,
  };
}

export function mealDbMealToAppRecipe(meal: MealDbMealDetail): Recipe {
  return mapNormalizedRecipeToAppRecipe(mealDbMealToNormalizedShape(meal));
}

export function mealDbAttributionUrls(meal: MealDbMealDetail): {
  mealDbPage: string;
  originalUrl: string | null;
  youtubeUrl: string | null;
} {
  return {
    mealDbPage: mealDbMealPageUrl(meal.idMeal),
    originalUrl: sanitizeHttpUrl(meal.strSource),
    youtubeUrl: sanitizeHttpUrl(meal.strYoutube),
  };
}

export function isMealDbRecipeId(recipeId: string): boolean {
  return recipeId.startsWith('mealdb-');
}
