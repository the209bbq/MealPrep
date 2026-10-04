/**
 * Shared catalog/import recipe shape → app `Recipe` (pantry match, grocery, detail).
 */
import { pantryCategoryForImportedIngredient } from '../recipeDiscovery/mapToAppRecipe';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import type { Recipe, RecipeIngredient } from '../../types/mealprep';

export interface NormalizedRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  note?: string;
}

export type NormalizedRecipeSourceType =
  | 'youtube'
  | 'web'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'reddit'
  | 'photo'
  | 'video'
  | 'themealdb';

export interface NormalizedRecipeShape {
  id: string;
  name: string;
  tag: string;
  description: string;
  servings: number;
  minutes: number;
  ingredients: NormalizedRecipeIngredient[];
  steps: string[];
  isMaster: boolean;
  createdAt?: string;
  imageUrl?: string | null;
  sourceUrl?: string;
  sourceType?: NormalizedRecipeSourceType;
  sourceTitle?: string;
  sourceChannelName?: string;
  sourceChannelUrl?: string;
  sourceAuthorUrl?: string;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
}

function ingredientIdForNormalizedName(name: string, prefix: string): string {
  const normalized = normalizeIngredientName(name);
  const slug = normalized.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${prefix}-${slug || 'item'}`;
}

export function mapNormalizedRecipeToAppRecipe(shape: NormalizedRecipeShape): Recipe {
  const idPrefix = shape.id.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'recipe';
  const ingredients: RecipeIngredient[] = shape.ingredients.map((ing) => ({
    ingredientId: ingredientIdForNormalizedName(ing.name, idPrefix),
    name: ing.note?.trim() ? `${ing.name} (${ing.note.trim()})` : ing.name,
    quantity: ing.quantity,
    unit: ing.unit || 'each',
    notes: pantryCategoryForImportedIngredient(ing.name, ing.note),
  }));

  return {
    id: shape.id,
    name: shape.name,
    tag: shape.tag,
    description: shape.description,
    servings: Math.max(1, shape.servings),
    minutes: Math.max(1, shape.minutes),
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients,
    steps: shape.steps,
    isMaster: shape.isMaster,
    createdAt: shape.createdAt ?? new Date().toISOString(),
    sourceUrl: shape.sourceUrl,
    sourceType: shape.sourceType as Recipe['sourceType'],
    sourceTitle: shape.sourceTitle,
    sourceChannelName: shape.sourceChannelName,
    sourceChannelUrl: shape.sourceChannelUrl,
    sourceAuthorUrl: shape.sourceAuthorUrl,
    prepMinutes: shape.prepMinutes,
    cookMinutes: shape.cookMinutes,
    imageUrl: shape.imageUrl ?? null,
  };
}

/** Split free-text instructions into display steps (preserve API wording). */
export function splitRecipeInstructionText(instructions: string): string[] {
  const trimmed = instructions.trim();
  if (!trimmed) return [];
  const lines = trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length > 1) return lines;
  const numbered = trimmed
    .split(/\s*(?=\d+[\).]\s)/)
    .map((part) => part.replace(/^\d+[\).]\s*/, '').trim())
    .filter((part) => part.length > 0);
  return numbered.length > 1 ? numbered : [trimmed];
}
