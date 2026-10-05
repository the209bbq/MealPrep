import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import { ingredientLinesFromCreatorModel, ingredientLinesFromRecipesTabRow } from '../diet/ingredientLines';
import { recipeFromRecipesTabRow } from '../mainIngredient/recipeFromRow';
import { refKeyForCreatorVideo, refKeyForKitchenRecipe } from '../savedRecipes/refKey';
import type { RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import type { RecipeRankingInput } from './types';

function zeroMatch(recipe: Recipe): RecipePantryMatch {
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

export function refKeyFromRecipesTabRow(row: RecipesTabRow): string {
  if (row.kind === 'kitchen') return refKeyForKitchenRecipe(row.recipe);
  return `discovery:${row.recipe.id}`;
}

export function refKeyFromCreatorModel(model: CreatorFeedCardModel): string {
  return refKeyForCreatorVideo(model.videoId, model.importedRecipe);
}

export function rankingInputFromRecipesTabRow(row: RecipesTabRow): RecipeRankingInput {
  const recipe = recipeFromRecipesTabRow(row);
  const refKey = refKeyFromRecipesTabRow(row);
  return {
    refKey,
    recipe,
    match: row.match,
    ingredientLines: ingredientLinesFromRecipesTabRow(row),
  };
}

export function rankingInputFromCreatorModel(model: CreatorFeedCardModel): RecipeRankingInput {
  const recipe =
    model.importedRecipe ?? {
      id: model.videoId,
      name: model.item.title,
      tag: 'Creator',
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
      createdAt: '',
    };
  const match = model.match ?? zeroMatch(recipe);
  const refKey = refKeyFromCreatorModel(model);
  return {
    refKey,
    recipe,
    match,
    ingredientLines: ingredientLinesFromCreatorModel(model),
  };
}
