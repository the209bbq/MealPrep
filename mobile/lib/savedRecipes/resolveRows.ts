import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry, type PantryMatchIndex } from '../recipeMatch';
import { mapNormalizedRecipeToAppRecipe } from '../recipes/normalizedRecipeShape';
import { findKitchenRecipeBySourceUrl } from '../recipes/recipeSourceUrl';
import { stubKitchenRecipeFromViralItem } from '../recipes/viralFeedRows';
import type { PantryItem, Recipe } from '../../types/mealprep';
import type { SavedRecipeRecord } from './types';

function zeroMatch(recipe: Recipe) {
  return scoreRecipeAgainstPantry(recipe, []);
}

export function resolveSavedRecipeToRow(
  record: SavedRecipeRecord,
  kitchenRecipes: readonly Recipe[],
  pantry: PantryItem[],
  pantryMatches: PantryMatchIndex,
): RecipesTabRow | null {
  if (record.sourceType === 'kitchen' && record.kitchenRecipeId) {
    const recipe =
      kitchenRecipes.find((row) => row.id === record.kitchenRecipeId) ??
      ({
        id: record.kitchenRecipeId,
        name: record.title,
        tag: '',
        description: '',
        servings: 4,
        minutes: 30,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        ingredients: [],
        steps: [],
        isMaster: false,
        createdAt: record.savedAt,
        imageUrl: record.imageUrl ?? undefined,
      } satisfies Recipe);
    const match =
      pantryMatches.byRecipeId.get(recipe.id) ?? scoreRecipeAgainstPantry(recipe, pantry);
    return { kind: 'kitchen', recipe, match };
  }

  if (record.sourceType === 'mealdb') {
    if (record.preview.kind === 'mealdb') {
      const recipe = mapNormalizedRecipeToAppRecipe(record.preview.shape);
      const match = scoreRecipeAgainstPantry(recipe, pantry);
      return { kind: 'kitchen', recipe, match };
    }
    if (record.kitchenRecipeId) {
      const recipe = kitchenRecipes.find((row) => row.id === record.kitchenRecipeId);
      if (recipe) {
        const match =
          pantryMatches.byRecipeId.get(recipe.id) ?? scoreRecipeAgainstPantry(recipe, pantry);
        return { kind: 'kitchen', recipe, match };
      }
    }
    return null;
  }

  if (record.sourceType === 'creator_video') {
    const watchUrl = record.creatorWatchUrl ?? '';
    const imported = watchUrl ? findKitchenRecipeBySourceUrl(kitchenRecipes, watchUrl) : null;
    if (imported) {
      const match =
        pantryMatches.byRecipeId.get(imported.id) ?? scoreRecipeAgainstPantry(imported, pantry);
      return { kind: 'kitchen', recipe: imported, match };
    }
    if (record.preview.kind === 'creator') {
      const stub = stubKitchenRecipeFromViralItem(record.preview.item);
      const match = zeroMatch(stub);
      return { kind: 'kitchen', recipe: stub, match };
    }
    return null;
  }

  return null;
}

export function buildSavedRecipeFeedRows(
  records: readonly SavedRecipeRecord[],
  kitchenRecipes: readonly Recipe[],
  pantry: PantryItem[],
  pantryMatches: PantryMatchIndex,
): RecipesTabRow[] {
  const rows: RecipesTabRow[] = [];
  for (const record of records) {
    const row = resolveSavedRecipeToRow(record, kitchenRecipes, pantry, pantryMatches);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}

export function savedCreatorItemFromRecord(record: SavedRecipeRecord) {
  if (record.preview.kind === 'creator') return record.preview.item;
  if (record.creatorWatchUrl && record.creatorVideoId) {
    return {
      videoId: record.creatorVideoId,
      category: 'quick' as const,
      title: record.title,
      thumbnailUrl: record.imageUrl ?? '',
      channelId: '',
      channelTitle: '',
      channelUrl: '',
      watchUrl: record.creatorWatchUrl,
      viewCount: 0,
      publishedAt: null,
    };
  }
  return null;
}
