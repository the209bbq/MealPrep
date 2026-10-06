import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import { recipeCategoryGroup, type RecipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import type { Recipe } from '../../types/mealprep';
import type { RecipeRankingInput } from './types';

export interface RecipeRankingFeatures {
  group: RecipeCategoryGroup;
  area: string;
  tags: string[];
}

function tagsFromRecipe(recipe: Recipe): string[] {
  const tags: string[] = [];
  const tag = recipe.tag?.trim();
  if (tag) tags.push(tag);
  return tags;
}

export function recipeFeaturesFromRankingInput(input: RecipeRankingInput): RecipeRankingFeatures {
  const recipe = input.recipe;
  const tags = tagsFromRecipe(recipe);
  const category =
    recipe.sourceType === 'themealdb' ? recipe.tag : recipe.tag?.split('·')[0]?.trim() ?? '';
  return {
    group: recipeCategoryGroup({
      category,
      title: recipe.name,
      tags,
    }),
    area: (recipe.tag ?? '').trim() || 'unknown',
    tags,
  };
}

export function recipeFeaturesFromRecipesTabRow(row: RecipesTabRow): RecipeRankingFeatures {
  if (row.kind === 'kitchen') {
    return recipeFeaturesFromRankingInput({
      refKey: '',
      recipe: row.recipe,
      match: row.match,
      ingredientLines: null,
    });
  }
  const api = row.recipe;
  const tags = [...(api.dietary_tags ?? []), api.cuisine, api.meal_type].filter(Boolean) as string[];
  return {
    group: recipeCategoryGroup({
      category: api.meal_type ?? api.cuisine ?? '',
      title: api.name,
      tags,
    }),
    area: api.cuisine?.trim() || 'unknown',
    tags,
  };
}

export function recipeFeaturesFromCreatorModel(model: CreatorFeedCardModel): RecipeRankingFeatures {
  const recipe = model.importedRecipe;
  if (recipe) {
    return recipeFeaturesFromRankingInput({
      refKey: '',
      recipe,
      match: model.match ?? {
        recipeId: recipe.id,
        recipeName: recipe.name,
        totalIngredients: 0,
        matchedCount: 0,
        missingCount: 0,
        percentMatch: 0,
        matched: [],
        missing: [],
      },
      ingredientLines: null,
    });
  }
  return {
    group: recipeCategoryGroup({ category: '', title: model.item.title, tags: [] }),
    area: 'unknown',
    tags: [],
  };
}
