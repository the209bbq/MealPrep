import { pantryCategoryForImportedIngredient } from '../recipeDiscovery/mapToAppRecipe';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import type { Recipe, RecipeIngredient } from '../../types/mealprep';
import type { RecipeImportExtractedDto } from './types';

function ingredientIdForImportName(name: string): string {
  const normalized = normalizeIngredientName(name);
  const slug = normalized.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `import-ing-${slug || 'item'}`;
}

export function linkImportRecipeSlug(userId: string, sourceUrl: string): string {
  const normalized = sourceUrl.trim().toLowerCase();
  const hash = normalized
    .split('')
    .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 0)
    .toString(36);
  const userPart = userId.slice(0, 8);
  return `link-import-${userPart}-${hash}`;
}

export function mapExtractedImportToRecipe(
  extracted: RecipeImportExtractedDto,
  userId: string,
): Recipe {
  const ingredients: RecipeIngredient[] = extracted.ingredients.map((ing) => ({
    ingredientId: ingredientIdForImportName(ing.name),
    name: ing.note ? `${ing.name} (${ing.note})` : ing.name,
    quantity: ing.quantity,
    unit: ing.unit || 'each',
    notes: pantryCategoryForImportedIngredient(ing.name, ing.note),
  }));

  const prep = extracted.prep_minutes ?? 0;
  const cook = extracted.cook_minutes ?? 0;
  const minutes = Math.max(1, prep + cook > 0 ? prep + cook : 30);

  const tag =
    extracted.source_type === 'youtube' ? 'Imported · YouTube' : 'Imported · Web';

  return {
    id: linkImportRecipeSlug(userId, extracted.source_url),
    name: extracted.title,
    tag,
    description: extracted.source_title && extracted.source_title !== extracted.title
      ? extracted.source_title
      : 'Saved from a link you imported',
    servings: Math.max(1, extracted.servings),
    minutes,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients,
    steps: extracted.steps,
    isMaster: false,
    createdAt: new Date().toISOString(),
    sourceUrl: extracted.source_url,
    sourceType: extracted.source_type,
    sourceTitle: extracted.source_title ?? extracted.title,
    prepMinutes: extracted.prep_minutes,
    cookMinutes: extracted.cook_minutes,
  };
}

export function isUserOwnedKitchenRecipe(recipe: Recipe): boolean {
  if (recipe.isMaster) return false;
  if (recipe.id.startsWith('recipeapi-')) return false;
  if (recipe.sourceUrl) return true;
  return recipe.id.startsWith('link-import-');
}
