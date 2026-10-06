import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { Recipe } from '../../types/mealprep';
import type { RecipeDiscoveryListItem } from '../recipeDiscovery/types';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import type { CreatorVideoItem } from '../creatorVideos/types';

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

/** Title, tag, description, and ingredients — same haystack as creator cards for diet/allergen rules. */
export function dietCheckLinesFromRecipesTabRow(row: RecipesTabRow): string[] | null {
  if (row.kind === 'kitchen') {
    const fromIng = ingredientLinesFromRecipe(row.recipe);
    const meta: string[] = [];
    const name = row.recipe.name?.trim();
    if (name) meta.push(name);
    const tag = row.recipe.tag?.trim();
    if (tag) meta.push(tag);
    const description = row.recipe.description?.trim();
    if (description) meta.push(description);
    const merged = [...fromIng, ...meta];
    const unique = [...new Set(merged.map((line) => line.trim()).filter(Boolean))];
    return unique.length > 0 ? unique : null;
  }
  const lines = ingredientLinesFromDiscovery(row.recipe);
  if (lines.length > 0) return lines;
  const name = row.recipe.name?.trim();
  return name ? [name] : null;
}

function titleAndDescriptionLines(model: CreatorFeedCardModel): string[] {
  const lines: string[] = [];
  const title = model.video.title?.trim() || model.item.title?.trim();
  if (title) lines.push(title);
  const description = model.video.descriptionSnippet?.trim();
  if (description) lines.push(description);
  return lines;
}

export function ingredientLinesFromCreatorVideo(video: CreatorVideoItem): string[] | null {
  const lines: string[] = [];
  const title = video.title?.trim();
  if (title) lines.push(title);
  const description = video.descriptionSnippet?.trim();
  if (description) lines.push(description);
  return lines.length > 0 ? lines : null;
}

/** Diet/allergen haystack for creator cards — always include title, description, and tags. */
export function dietCheckLinesFromCreatorModel(model: CreatorFeedCardModel): string[] | null {
  const meta = titleAndDescriptionLines(model);
  const tagLines = (model.importedRecipe?.tag ? [model.importedRecipe.tag] : []).filter(Boolean);
  const fromRecipe = model.importedRecipe ? ingredientLinesFromRecipe(model.importedRecipe) : [];
  const merged = [...fromRecipe, ...meta, ...tagLines];
  const unique = [...new Set(merged.map((line) => line.trim()).filter(Boolean))];
  return unique.length > 0 ? unique : null;
}

export function ingredientLinesFromCreatorModel(model: CreatorFeedCardModel): string[] | null {
  return dietCheckLinesFromCreatorModel(model);
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
