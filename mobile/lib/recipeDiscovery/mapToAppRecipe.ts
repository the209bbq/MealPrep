import type { PantryCategory, Recipe, RecipeIngredient } from '../../types/mealprep';
import { inferGroceryCategoryFromName } from '../grocery/categorize';
import type { RecipeApiRecipe } from './types';
import { recipeApiMasterSlug, recipeApiPersonalSlug } from './slugs';

function mapIngredientCategory(apiCategory: string, ingredientName: string): PantryCategory {
  const fromName = inferGroceryCategoryFromName(ingredientName);
  const c = apiCategory.toLowerCase();
  if (c.includes('spice') || c.includes('herb')) return 'spices';
  if (c.includes('meat') || c.includes('fish') || c.includes('seafood') || c.includes('poultry')) return 'meats';
  if (fromName === 'dry_goods') return 'dry_goods';
  if (
    c.includes('vegetable') ||
    c.includes('fruit') ||
    c.includes('produce') ||
    /\b(broccoli|asparagus|kale|spinach|lettuce|tomato|onion|pepper|carrot|celery|squash|zucchini)\b/.test(c)
  ) {
    return 'produce';
  }
  if (c.includes('dairy') || c.includes('cheese') || c.includes('milk')) return 'dairy';
  if (c.includes('frozen')) return 'frozen';
  if (c.includes('condiment') || c.includes('sauce')) return 'condiments';
  return fromName;
}

export function recipeApiToAppRecipe(
  api: RecipeApiRecipe,
  options: { asMaster: boolean; userId: string },
): Recipe {
  const slug = options.asMaster
    ? recipeApiMasterSlug(api.id)
    : recipeApiPersonalSlug(api.id, options.userId);
  const ingredients: RecipeIngredient[] = api.ingredients.map((ing) => ({
    ingredientId: `recipeapi-ing-${ing.id}`,
    name: ing.optional ? `${ing.name} (optional)` : ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    notes: ing.category,
    grams: undefined,
  }));

  const minutes = Math.max(1, (api.prep_time ?? 0) + (api.cook_time ?? 0));
  const tagParts = [api.cuisine, api.meal_type, api.difficulty].filter(Boolean);
  const tag = tagParts.join(' · ');

  return {
    id: slug,
    name: api.name,
    tag,
    description: api.description,
    servings: Math.max(1, api.servings),
    minutes,
    calories: Math.round(api.calories_per_serving ?? 0),
    protein: Math.round(api.protein ?? 0),
    carbs: Math.round(api.carbs ?? 0),
    fat: Math.round(api.fat ?? 0),
    ingredients,
    steps: api.instructions ?? [],
    isMaster: options.asMaster,
    createdAt: new Date().toISOString(),
    nutritionSource: 'Recipe source',
    nutritionCitation: 'Nutrition per serving from the recipe provider',
    nutritionSourcedAt: new Date().toISOString(),
  };
}

export function pantryCategoryForImportedIngredient(name: string, notes?: string): PantryCategory {
  const hint = [notes, name].filter(Boolean).join(' ');
  return mapIngredientCategory(hint, name);
}
