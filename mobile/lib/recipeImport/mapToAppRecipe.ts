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

export function photoImportRecipeSlug(userId: string, title: string): string {
  const base = `${title.trim().toLowerCase()}-${Date.now()}`;
  const hash = base
    .split('')
    .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 0)
    .toString(36);
  return `photo-import-${userId.slice(0, 8)}-${hash}`;
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

  const tagBySource: Record<RecipeImportExtractedDto['source_type'], string> = {
    youtube: 'Imported · YouTube',
    web: 'Imported · Web',
    tiktok: 'Imported · TikTok',
    instagram: 'Imported · Instagram',
    facebook: 'Imported · Facebook',
    photo: 'Imported · Photo',
    video: 'Imported · Video',
  };
  const descriptionBySource: Record<RecipeImportExtractedDto['source_type'], string> = {
    youtube: 'Imported from a YouTube cooking video and saved in your own words.',
    web: 'Imported from a recipe page and saved in your own words.',
    tiktok: 'Imported from a TikTok post and saved in your own words.',
    instagram: 'Imported from an Instagram caption and saved in your own words.',
    facebook: 'Imported from a Facebook post and saved in your own words.',
    photo: 'Imported from your recipe photos and saved in your own words.',
    video: 'Imported from your saved cooking video and saved in your own words.',
  };

  const persistYoutubeMeta = extracted.source_type === 'youtube';
  const socialHandle = extracted.social_author_name?.trim();
  const slugSource =
    extracted.source_type === 'photo'
      ? photoImportRecipeSlug(userId, extracted.title)
      : linkImportRecipeSlug(userId, extracted.source_url);

  return {
    id: slugSource,
    name: extracted.title,
    tag: tagBySource[extracted.source_type],
    description: descriptionBySource[extracted.source_type],
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
    sourceUrl: extracted.social_author_url ?? extracted.source_url,
    sourceType: extracted.source_type,
    sourceTitle: persistYoutubeMeta ? undefined : socialHandle ?? extracted.source_title,
    sourceChannelName: persistYoutubeMeta ? extracted.youtube_channel_name ?? undefined : undefined,
    sourceMetadataRefreshedAt: persistYoutubeMeta ? extracted.metadata_refreshed_at : undefined,
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
