import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { discoveryRecipeServingOverrideId } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import { engagementSourceFromRecipe } from '../seamlessFlow/engagementSource';
import { recipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import { refKeyFromCreatorModel } from '../recipeRanking/recipeInputs';
import { refKeyForKitchenRecipe } from '../savedRecipes/refKey';
import type { RecipePantryMatch } from '../recipeMatch';
import type { MealPlanItem, Recipe } from '../../types/mealprep';
import { parseRecipeApiNumericId } from '../recipeDiscovery/slugs';
import { resolveKitchenRecipeImageUrl } from '../recipes/recipeImageUrl';
import type { RecipeEngagementSource } from '../recipeRanking/types';

export interface ScheduleRecipeTarget {
  title: string;
  recipeSlug: string | null;
  recipeApiId: number | null;
  imageUrl: string | null;
  /** Pantry / grocery recipe id (kitchen id or discovery override id). */
  pantryRecipeId: string;
  refKey: string;
  source: RecipeEngagementSource;
  categoryLabel: string;
  tags?: string[];
  match: RecipePantryMatch | null;
  sheetId?: string;
  onOpenCookView?: () => void;
  onJustSave?: () => void;
  onOpenSwapRecipe?: (recipeId: string) => void;
}

export interface ScheduleRecipeOpenOptions {
  onOpenCookView?: () => void;
  onJustSave?: () => void;
  onOpenSwapRecipe?: (recipeId: string) => void;
}

function baseFromKitchen(
  recipe: Recipe,
  match: RecipePantryMatch | null,
  options?: ScheduleRecipeOpenOptions,
): ScheduleRecipeTarget {
  return {
    title: recipe.name,
    recipeSlug: recipe.id,
    recipeApiId: null,
    imageUrl: resolveKitchenRecipeImageUrl(recipe),
    pantryRecipeId: recipe.id,
    refKey: refKeyForKitchenRecipe(recipe),
    source: engagementSourceFromRecipe(recipe),
    categoryLabel: recipe.tag,
    tags: [],
    match,
    onOpenCookView: options?.onOpenCookView,
    onJustSave: options?.onJustSave,
    onOpenSwapRecipe: options?.onOpenSwapRecipe,
  };
}

export function scheduleTargetFromKitchenRecipe(
  recipe: Recipe,
  match: RecipePantryMatch | null,
  options?: ScheduleRecipeOpenOptions,
): ScheduleRecipeTarget {
  return baseFromKitchen(recipe, match, options);
}

export function scheduleTargetFromDiscoveryRecipe(
  recipe: {
    id: number;
    name: string;
    image_url?: string | null;
    cuisine?: string;
    tags?: string[];
  },
  match: RecipePantryMatch | null,
  options?: ScheduleRecipeOpenOptions,
): ScheduleRecipeTarget {
  const pantryRecipeId = discoveryRecipeServingOverrideId(recipe.id);
  return {
    title: recipe.name,
    recipeSlug: null,
    recipeApiId: recipe.id,
    imageUrl: recipe.image_url ?? null,
    pantryRecipeId,
    refKey: `discovery:${recipe.id}`,
    source: 'mealdb',
    categoryLabel: recipe.cuisine ?? '',
    tags: recipe.tags ?? [],
    match,
    onOpenCookView: options?.onOpenCookView,
    onJustSave: options?.onJustSave,
    onOpenSwapRecipe: options?.onOpenSwapRecipe,
  };
}

export function scheduleTargetFromRecipesTabRow(
  row: RecipesTabRow,
  options?: ScheduleRecipeOpenOptions,
): ScheduleRecipeTarget {
  if (row.kind === 'kitchen') {
    return scheduleTargetFromKitchenRecipe(row.recipe, row.match, options);
  }
  return scheduleTargetFromDiscoveryRecipe(row.recipe, row.match, options);
}

export function scheduleTargetFromCreatorModel(
  model: CreatorFeedCardModel,
  options?: ScheduleRecipeOpenOptions,
): ScheduleRecipeTarget {
  const recipe = model.importedRecipe;
  const match = model.match;
  if (recipe) {
    const target = scheduleTargetFromKitchenRecipe(recipe, match, options);
    return {
      ...target,
      refKey: refKeyFromCreatorModel(model),
      source: 'creator',
      categoryLabel: recipe.tag,
    };
  }
  return {
    title: model.item.title,
    recipeSlug: null,
    recipeApiId: null,
    imageUrl: model.item.thumbnailUrl,
    pantryRecipeId: model.videoId,
    refKey: refKeyFromCreatorModel(model),
    source: 'creator',
    categoryLabel: 'Creator',
    tags: [],
    match,
    onOpenCookView: options?.onOpenCookView,
    onJustSave: options?.onJustSave,
    onOpenSwapRecipe: options?.onOpenSwapRecipe,
  };
}

export function scheduleTargetFromMealPlanItem(item: MealPlanItem): ScheduleRecipeTarget {
  return {
    title: item.title.replace(/^Leftovers:\s*/i, ''),
    recipeSlug: item.recipeSlug,
    recipeApiId: item.recipeApiId,
    imageUrl: item.imageUrl,
    pantryRecipeId: item.recipeSlug ?? `recipeapi-${item.recipeApiId}`,
    refKey: item.recipeSlug ? `kitchen:${item.recipeSlug}` : `discovery:${item.recipeApiId}`,
    source: 'import',
    categoryLabel: '',
    match: null,
  };
}

export function scheduleTargetFromRecipeId(
  recipeId: string,
  recipes: Recipe[],
): ScheduleRecipeTarget {
  const recipe = recipes.find((row) => row.id === recipeId);
  if (recipe) return scheduleTargetFromKitchenRecipe(recipe, null);
  const apiId = parseRecipeApiNumericId(recipeId);
  if (apiId != null) {
    return scheduleTargetFromDiscoveryRecipe({ id: apiId, name: 'Recipe' }, null);
  }
  return {
    title: recipeId,
    recipeSlug: recipeId,
    recipeApiId: null,
    imageUrl: null,
    pantryRecipeId: recipeId,
    refKey: `kitchen:${recipeId}`,
    source: 'import',
    categoryLabel: '',
    match: null,
  };
}

export function categoryGroupForTarget(target: ScheduleRecipeTarget) {
  return recipeCategoryGroup({
    category: target.categoryLabel,
    title: target.title,
    tags: target.tags,
  });
}
