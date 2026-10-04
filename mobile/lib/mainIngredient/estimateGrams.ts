import type { RecipeIngredient } from '../../types/mealprep';
import { normalizeIngredientAmount } from '../costPerServing/parseIngredientAmount';
import { findBasePriceForIngredient } from '../costPerServing/matchBasePrice';
import { gramsEachForEntry, gramsPerCupForEntry } from '../costPerServing/eachWeights';
import { volumeToMl, isVolumeUnit } from '../costPerServing/volumeUnits';
import { isRecipeCountUnit } from '../costPerServing/countUnits';

const ML_PER_CUP = 236.588;
const G_PER_OZ = 28.3495;
const G_PER_LB = 453.592;

function massToGrams(quantity: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') return quantity;
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return quantity * 1000;
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return quantity * G_PER_OZ;
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return quantity * G_PER_LB;
  return null;
}

/** Rough grams for weight-share heuristics (not for pricing). */
export function estimateIngredientGrams(ingredient: RecipeIngredient): number | null {
  const normalized = normalizeIngredientAmount(ingredient.quantity, ingredient.unit ?? '');
  const { quantity, unit, sizeScale } = normalized;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const directMass = massToGrams(quantity, unit);
  if (directMass != null) return directMass;

  const entry = findBasePriceForIngredient(ingredient.name);
  const gramsEach = entry ? gramsEachForEntry(entry) : undefined;
  const gramsPerCup = entry ? gramsPerCupForEntry(entry) : undefined;

  if (isVolumeUnit(unit)) {
    const ml = volumeToMl(quantity, unit);
    if (ml != null && gramsPerCup != null && gramsPerCup > 0) {
      return (ml / ML_PER_CUP) * gramsPerCup;
    }
  }

  if (isRecipeCountUnit(unit) && gramsEach != null && gramsEach > 0) {
    return quantity * gramsEach * sizeScale;
  }

  if (gramsEach != null && gramsEach > 0 && (!unit || unit === 'each')) {
    return quantity * gramsEach * sizeScale;
  }

  return null;
}
