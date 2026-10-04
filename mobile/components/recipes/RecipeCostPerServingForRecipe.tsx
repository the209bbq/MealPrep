import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { chainKeysFromSavedStores, useCommunityDealsForStores } from '../../lib/communityDeals/useCommunityDeals';
import { useRecipeCostEstimate } from '../../lib/costPerServing/useRecipeCostEstimate';
import type { Recipe } from '../../types/mealprep';
import { RecipeCostPerServingLine } from './RecipeCostPerServingLine';

type Props = {
  recipe: Pick<Recipe, 'servings' | 'ingredients'>;
};

export function RecipeCostPerServingForRecipe({ recipe }: Props) {
  const { profile } = useApp();
  const ownerId = profile.id || 'demo-user';
  const storeKeys = useMemo(() => chainKeysFromSavedStores(), []);
  const { deals } = useCommunityDealsForStores(storeKeys);
  const estimate = useRecipeCostEstimate(recipe, ownerId, deals);
  return <RecipeCostPerServingLine estimate={estimate} />;
}
