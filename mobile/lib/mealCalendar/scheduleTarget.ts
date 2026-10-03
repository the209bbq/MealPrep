import type { MealPlanItem, Recipe } from '../../types/mealprep';
import { parseRecipeApiNumericId } from '../recipeDiscovery/slugs';
import { resolveKitchenRecipeImageUrl } from '../recipes/recipeImageUrl';

export interface ScheduleRecipeTarget {
  title: string;
  recipeSlug: string | null;
  recipeApiId: number | null;
  imageUrl: string | null;
}

export function scheduleTargetFromKitchenRecipe(
  recipe: Pick<Recipe, 'id' | 'name' | 'imageUrl' | 'sourceUrl' | 'sourceType'>,
): ScheduleRecipeTarget {
  return {
    title: recipe.name,
    recipeSlug: recipe.id,
    recipeApiId: null,
    imageUrl: resolveKitchenRecipeImageUrl(recipe as Recipe),
  };
}

export function scheduleTargetFromDiscoveryRecipe(recipe: {
  id: number;
  name: string;
  image_url?: string | null;
}): ScheduleRecipeTarget {
  return {
    title: recipe.name,
    recipeSlug: null,
    recipeApiId: recipe.id,
    imageUrl: recipe.image_url ?? null,
  };
}

export function scheduleTargetFromMealPlanItem(item: MealPlanItem): ScheduleRecipeTarget {
  return {
    title: item.title.replace(/^Leftovers:\s*/i, ''),
    recipeSlug: item.recipeSlug,
    recipeApiId: item.recipeApiId,
    imageUrl: item.imageUrl,
  };
}

export function scheduleTargetFromRecipeId(recipeId: string, recipes: Recipe[]): ScheduleRecipeTarget {
  const recipe = recipes.find((row) => row.id === recipeId);
  if (recipe) return scheduleTargetFromKitchenRecipe(recipe);
  const apiId = parseRecipeApiNumericId(recipeId);
  if (apiId != null) {
    return {
      title: 'Recipe',
      recipeSlug: null,
      recipeApiId: apiId,
      imageUrl: null,
    };
  }
  return {
    title: recipeId,
    recipeSlug: recipeId,
    recipeApiId: null,
    imageUrl: null,
  };
}
