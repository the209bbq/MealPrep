import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { Recipe } from '../../types/mealprep';
import type { RecipeDiscoveryListItem } from '../recipeDiscovery/types';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';

export function ingredientLinesFromRecipe(recipe: Recipe): string[] {
  return recipe.ingredients.map((ing) => ing.name).filter(Boolean);
}

export function ingredientLinesFromDiscovery(recipe: RecipeDiscoveryListItem): string[] {
  if (!recipe.ingredients?.length) return [];
  return recipe.ingredients.map((ing) => ing.name).filter(Boolean);
}

export function ingredientLinesFromRecipesTabRow(row: RecipesTabRow): string[] | null {
  if (row.kind === 'kitchen') {
    const lines = ingredientLinesFromRecipe(row.recipe);
    return lines.length > 0 ? lines : null;
  }
  const lines = ingredientLinesFromDiscovery(row.recipe);
  return lines.length > 0 ? lines : null;
}

function titleAndDescriptionLines(model: CreatorFeedCardModel): string[] {
  const lines: string[] = [];
  const title = model.video.title?.trim() || model.item.title?.trim();
  if (title) lines.push(title);
  const description = model.video.descriptionSnippet?.trim();
  if (description) lines.push(description);
  return lines;
}

export function ingredientLinesFromCreatorModel(model: CreatorFeedCardModel): string[] | null {
  if (model.importedRecipe) {
    const lines = ingredientLinesFromRecipe(model.importedRecipe);
    if (lines.length > 0) return lines;
  }
  const fallback = titleAndDescriptionLines(model);
  return fallback.length > 0 ? fallback : null;
}

export function ingredientLinesForKitchenRecipe(
  recipe: Recipe,
  fallbackText?: string | null,
): string[] {
  const lines = ingredientLinesFromRecipe(recipe);
  if (lines.length > 0) return lines;
  const trimmed = fallbackText?.trim();
  return trimmed ? [trimmed] : [];
}
