import { useMemo } from 'react';
import { chainKeysFromSavedStores, useCommunityDealsForStores } from '../communityDeals/useCommunityDeals';
import type { Recipe } from '../../types/mealprep';
import { calculateRecipeCostPerServing } from './calculate';
import type { RecipeCostResult } from './types';

export function useRecipeCostEstimate(recipe: Recipe | null, ownerId: string): RecipeCostResult | null {
  const storeKeys = useMemo(() => chainKeysFromSavedStores(), []);
  const { deals: communityDeals } = useCommunityDealsForStores(storeKeys);

  return useMemo(() => {
    if (!recipe) return null;
    return calculateRecipeCostPerServing(recipe, {
      ownerId: ownerId || 'demo-user',
      communityDeals,
      krogerDeals: [],
    });
  }, [recipe, ownerId, communityDeals]);
}
