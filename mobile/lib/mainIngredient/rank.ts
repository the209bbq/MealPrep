import type { Recipe } from '../../types/mealprep';
import type { RecipePantryMatch } from '../recipeMatch';
import { calculateRecipeCostPerServing } from '../costPerServing';
import type { RecipeCostPricingContext } from '../costPerServing/types';

const DEFAULT_PRICING: RecipeCostPricingContext = {
  ownerId: 'main-ingredient-rank',
  communityDeals: [],
};

function costPerServingForRecipe(
  recipe: Recipe,
  cache: Map<string, number | null>,
  pricing: RecipeCostPricingContext,
): number | null {
  const cached = cache.get(recipe.id);
  if (cached !== undefined) return cached;
  const estimate = calculateRecipeCostPerServing(recipe, pricing);
  cache.set(recipe.id, estimate.costPerServing);
  return estimate.costPerServing;
}

/** Fewest missing pantry items, then lowest cost/serving, then stable popularity (index). */
export function compareMainIngredientRanking(
  aRecipe: Recipe,
  aMatch: RecipePantryMatch,
  aIndex: number,
  bRecipe: Recipe,
  bMatch: RecipePantryMatch,
  bIndex: number,
  costCache: Map<string, number | null>,
  pricing: RecipeCostPricingContext = DEFAULT_PRICING,
): number {
  if (aMatch.missingCount !== bMatch.missingCount) {
    return aMatch.missingCount - bMatch.missingCount;
  }

  const aCost = costPerServingForRecipe(aRecipe, costCache, pricing);
  const bCost = costPerServingForRecipe(bRecipe, costCache, pricing);
  const aSortable = aCost ?? Number.POSITIVE_INFINITY;
  const bSortable = bCost ?? Number.POSITIVE_INFINITY;
  if (aSortable !== bSortable) return aSortable - bSortable;

  return aIndex - bIndex;
}

export function sortRowsByMainIngredientRanking<T>(
  rows: readonly T[],
  getRecipe: (row: T) => Recipe,
  getMatch: (row: T) => RecipePantryMatch,
  pricing?: RecipeCostPricingContext,
): T[] {
  const costCache = new Map<string, number | null>();
  const ctx = pricing ?? DEFAULT_PRICING;
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) =>
    compareMainIngredientRanking(
      getRecipe(a.row),
      getMatch(a.row),
      a.index,
      getRecipe(b.row),
      getMatch(b.row),
      b.index,
      costCache,
      ctx,
    ),
  );
  return indexed.map((entry) => entry.row);
}
