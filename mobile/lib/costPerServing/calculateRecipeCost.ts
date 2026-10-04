import type { Recipe, RecipeIngredient } from '../../types/mealprep';
import { normalizeIngredientAmount } from './parseIngredientAmount';
import { isUnpriceableIngredient } from './unpriceable';
import { resolveIngredientPrice } from './resolveIngredientPrice';
import type { RecipeCostEstimate, RecipeCostPricingContext } from './types';

const DEFAULT_SERVINGS = 4;

export function effectiveRecipeServings(servings: number | undefined | null): {
  servings: number;
  assumedDefault: boolean;
} {
  if (servings != null && servings > 0) {
    return { servings, assumedDefault: false };
  }
  return { servings: DEFAULT_SERVINGS, assumedDefault: true };
}

export function calculateRecipeCostPerServing(
  recipe: Pick<Recipe, 'servings' | 'ingredients'>,
  pricing: RecipeCostPricingContext,
): RecipeCostEstimate {
  const { servings, assumedDefault } = effectiveRecipeServings(recipe.servings);
  let totalCost = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  const lines = recipe.ingredients.map((ingredient) => lineForIngredient(ingredient, pricing));

  for (const line of lines) {
    if (line.skippedReason === 'unpriceable') {
      unpricedCount += 1;
      continue;
    }
    if (line.cost != null) {
      totalCost += line.cost;
      pricedCount += 1;
    } else {
      unpricedCount += 1;
    }
  }

  totalCost = Math.round(totalCost * 100) / 100;
  const costPerServing =
    pricedCount > 0 ? Math.round((totalCost / servings) * 100) / 100 : null;

  return {
    totalCost,
    costPerServing,
    servings,
    servingsAssumedDefault: assumedDefault,
    pricedCount,
    unpricedCount,
    lines,
  };
}

function lineForIngredient(
  ingredient: RecipeIngredient,
  pricing: RecipeCostPricingContext,
): RecipeCostEstimate['lines'][number] {
  const name = ingredient.name.replace(/\s*\(optional\)\s*/i, '').trim();
  const normalized = normalizeIngredientAmount(ingredient.quantity, ingredient.unit ?? '');
  const quantity = normalized.quantity;
  const unit = normalized.unit;

  if (isUnpriceableIngredient(name, ingredient.quantity, ingredient.unit ?? '')) {
    return { ingredient, cost: null, skippedReason: 'unpriceable' };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ingredient, cost: null, skippedReason: 'unmatched' };
  }

  const resolved = resolveIngredientPrice({
    name,
    quantity,
    unit,
    sizeScale: normalized.sizeScale,
    ownerId: pricing.ownerId,
    communityDeals: pricing.communityDeals,
    krogerDealsByIngredientKey: pricing.krogerDealsByIngredientKey,
  });

  if (!resolved) {
    return { ingredient, cost: null, skippedReason: 'unmatched' };
  }

  return {
    ingredient,
    cost: resolved.cost,
    source: resolved.source,
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
