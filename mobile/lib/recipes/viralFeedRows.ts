import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { ViralRecipeLinkItem } from '../viralRecipes/types';
import { compareRecipePantryMatches, type PantryMatchIndex, type RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import { isUserImportedKitchenRecipe } from '../recipeImport/mapToAppRecipe';
import { findKitchenRecipeBySourceUrl } from './recipeSourceUrl';
import { buildRecipesTabCatalogRows } from './recipesTabCatalog';

export function stubKitchenRecipeFromViralItem(item: ViralRecipeLinkItem): Recipe {
  return {
    id: `viral-preview-${item.videoId}`,
    name: item.title,
    tag: 'YouTube',
    description: 'Importing ingredients from this video…',
    servings: 4,
    minutes: 30,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: [],
    steps: [],
    isMaster: false,
    createdAt: '',
    sourceUrl: item.watchUrl,
    sourceType: 'youtube',
    sourceChannelName: item.channelTitle,
    sourceChannelUrl: item.channelUrl,
    imageUrl: item.thumbnailUrl,
  };
}

export interface ViralFeedCardModel {
  videoId: string;
  item: ViralRecipeLinkItem;
  importedRecipe: Recipe | null;
  match: RecipePantryMatch | null;
}

function zeroMatchForRecipe(recipe: Recipe): RecipePantryMatch {
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredients: recipe.ingredients.length,
    matchedCount: 0,
    missingCount: recipe.ingredients.length,
    percentMatch: 0,
    matched: [],
    missing: recipe.ingredients,
  };
}

export function buildViralFeedCardModels(
  items: readonly ViralRecipeLinkItem[],
  kitchenRecipes: readonly Recipe[],
  pantryMatches: PantryMatchIndex,
): ViralFeedCardModel[] {
  return items.map((item) => {
    const importedRecipe = findKitchenRecipeBySourceUrl(kitchenRecipes, item.watchUrl) ?? null;
    const match = importedRecipe
      ? pantryMatches.byRecipeId.get(importedRecipe.id) ?? zeroMatchForRecipe(importedRecipe)
      : null;
    return {
      videoId: item.videoId,
      item,
      importedRecipe,
      match,
    };
  });
}

export function viralItemToKitchenRow(
  item: ViralRecipeLinkItem,
  recipe: Recipe,
  match: RecipePantryMatch,
): RecipesTabRow {
  return {
    kind: 'kitchen',
    recipe,
    match,
  };
}

export function buildMyRecipesFeedRows(options: {
  kitchenRecipes: readonly Recipe[];
  pantryMatches: PantryMatchIndex;
}): RecipesTabRow[] {
  const owned = options.kitchenRecipes.filter((recipe) => isUserImportedKitchenRecipe(recipe));
  const rows = buildRecipesTabCatalogRows({
    kitchenRecipes: owned,
    pantryMatches: options.pantryMatches,
    discoverySuggestions: [],
  });
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}
