import type { Recipe, RecipeIngredient } from '../../types/mealprep';
import { isUnpriceableIngredient } from './skip';
import { resolvedIngredientAmount } from './parseIngredientAmount';
import { resolveIngredientPrice } from './resolvePrice';
import type { RecipeCostContext, RecipeCostLine, RecipeCostResult } from './types';

const DEFAULT_SERVINGS = 4;

function lineForIngredient(
  ing: RecipeIngredient,
  ctx: RecipeCostContext,
): RecipeCostLine {
  const { quantity, unit, name } = resolvedIngredientAmount(ing);

  if (isUnpriceableIngredient(name, quantity, unit)) {
    return {
      ingredientId: ing.ingredientId,
      name: ing.name,
      cost: null,
      skipped: true,
      skipReason: 'unpriceable',
    };
  }

  if (quantity <= 0) {
    return {
      ingredientId: ing.ingredientId,
      name: ing.name,
      cost: null,
      skipped: true,
      skipReason: 'no_amount',
    };
  }

  const resolved = resolveIngredientPrice({
    ingredientName: name,
    quantity,
    unit,
    ownerId: ctx.ownerId,
    communityDeals: ctx.communityDeals,
    krogerDeals: ctx.krogerDeals,
  });

  if (!resolved) {
    return {
      ingredientId: ing.ingredientId,
      name: ing.name,
      cost: null,
      skipped: true,
      skipReason: 'unmatched',
    };
  }

  return {
    ingredientId: ing.ingredientId,
    name: ing.name,
    cost: resolved.cost,
    skipped: false,
    priceSource: resolved.source,
  };
}

export function calculateRecipeCostPerServing(
  recipe: Recipe,
  ctx: RecipeCostContext,
): RecipeCostResult {
  const servingsRaw = recipe.servings;
  const usedDefaultServings = !Number.isFinite(servingsRaw) || servingsRaw <= 0;
  const servings = usedDefaultServings ? DEFAULT_SERVINGS : Math.max(1, Math.round(servingsRaw));

  const lines = recipe.ingredients.map((ing) => lineForIngredient(ing, ctx));
  const priced = lines.filter((l) => !l.skipped && l.cost !== null);
  const skippedCount = lines.length - priced.length;
  const totalCost = priced.reduce((sum, l) => sum + (l.cost ?? 0), 0);
  const roundedTotal = Math.round(totalCost * 100) / 100;
  const costPerServing =
    priced.length > 0 ? Math.round((roundedTotal / servings) * 100) / 100 : null;

  return {
    costPerServing,
    totalCost: roundedTotal,
    servings,
    usedDefaultServings,
    pricedCount: priced.length,
    skippedCount,
    lines,
  };
}
