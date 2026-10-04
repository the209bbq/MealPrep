import type { Recipe } from '../../types/mealprep';
import { mealDbIdFromRecipeId } from '../mealdb/slug';
import type { NormalizedRecipeShape } from '../recipes/normalizedRecipeShape';
import type { ViralRecipeLinkItem } from '../viralRecipes/types';
import type { SavedRecipePreview, UserSavedRecipeRow } from './types';

export function appRecipeToNormalizedSnapshot(recipe: Recipe): NormalizedRecipeShape {
  return {
    id: recipe.id,
    name: recipe.name,
    tag: recipe.tag,
    description: recipe.description,
    servings: recipe.servings,
    minutes: recipe.minutes,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
    steps: recipe.steps,
    isMaster: recipe.isMaster,
    createdAt: recipe.createdAt,
    imageUrl: recipe.imageUrl ?? null,
    sourceUrl: recipe.sourceUrl,
    sourceType: recipe.sourceType,
    sourceChannelName: recipe.sourceChannelName,
    sourceChannelUrl: recipe.sourceChannelUrl,
  };
}

export function encodePreview(preview: SavedRecipePreview): Record<string, unknown> {
  if (preview.kind === 'none') return {};
  if (preview.kind === 'creator') return { kind: 'creator', item: preview.item };
  return { kind: 'mealdb', shape: preview.shape };
}

export function decodePreview(raw: Record<string, unknown> | null | undefined): SavedRecipePreview {
  if (!raw || typeof raw !== 'object') return { kind: 'none' };
  const kind = raw.kind;
  if (kind === 'creator' && raw.item && typeof raw.item === 'object') {
    return { kind: 'creator', item: raw.item as ViralRecipeLinkItem };
  }
  if (kind === 'mealdb' && raw.shape && typeof raw.shape === 'object') {
    return { kind: 'mealdb', shape: raw.shape as NormalizedRecipeShape };
  }
  return { kind: 'none' };
}

export function previewFromUserRow(row: UserSavedRecipeRow): SavedRecipePreview {
  return decodePreview(row.preview);
}

export function mealDbIdFromKitchenRecipe(recipe: Recipe): string | null {
  const fromId = mealDbIdFromRecipeId(recipe.id);
  if (fromId) return fromId;
  if (recipe.sourceType === 'themealdb' && recipe.sourceUrl) {
    const match = recipe.sourceUrl.match(/mealdb\.com\/recipe\/([^/?#]+)/i);
    if (match?.[1]) return match[1];
  }
  return null;
}
