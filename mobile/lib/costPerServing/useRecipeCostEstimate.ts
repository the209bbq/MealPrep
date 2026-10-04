import { useMemo } from 'react';
import type { Recipe } from '../../types/mealprep';
import type { CommunityStoreDeal } from '../communityDeals/types';
import { calculateRecipeCostPerServing, type RecipeCostEstimate } from './index';

export function useRecipeCostEstimate(
  recipe: Pick<Recipe, 'servings' | 'ingredients'> | null | undefined,
  ownerId: string,
  communityDeals: CommunityStoreDeal[],
): RecipeCostEstimate | null {
  return useMemo(() => {
    if (!recipe || recipe.ingredients.length === 0) return null;
    return calculateRecipeCostPerServing(recipe, {
      ownerId,
      communityDeals,
    });
  }, [recipe, ownerId, communityDeals]);
}
