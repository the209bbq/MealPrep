import type { RecipeIngredient } from '../../types/mealprep';
import { isUnpriceableIngredient } from '../costPerServing/unpriceable';
import { normalizeIngredientAmount } from '../costPerServing/parseIngredientAmount';
import { volumeToMl, isVolumeUnit } from '../costPerServing/volumeUnits';
import { normalizeIngredientName } from '../recipeMatch/normalize';

const GARNISH_RE =
  /\b(garnish|for garnish|to garnish|fresh parsley for serving|chopped parsley to garnish)\b/i;

const SPICE_RE =
  /\b(cayenne|paprika|chili powder|curry powder|nutmeg|allspice|clove|cloves|cinnamon|oregano|thyme|rosemary|basil dried|dried basil)\b/i;

const ONE_TBSP_ML = 14.7868;

export function isMinorIngredientUse(ingredient: RecipeIngredient): boolean {
  const name = ingredient.name.trim();
  if (!name) return true;
  if (GARNISH_RE.test(name)) return true;
  if (isUnpriceableIngredient(name, ingredient.quantity, ingredient.unit ?? '')) return true;

  const normalized = normalizeIngredientName(name);
  if (SPICE_RE.test(normalized) || normalized === 'parsley' || normalized === 'cilantro') {
    const normalizedAmount = normalizeIngredientAmount(ingredient.quantity, ingredient.unit ?? '');
    if (isVolumeUnit(normalizedAmount.unit)) {
      const ml = volumeToMl(normalizedAmount.quantity, normalizedAmount.unit);
      if (ml != null && ml <= ONE_TBSP_ML) return true;
    }
    if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) return true;
  }

  const normalizedAmount = normalizeIngredientAmount(ingredient.quantity, ingredient.unit ?? '');
  if (isVolumeUnit(normalizedAmount.unit)) {
    const ml = volumeToMl(normalizedAmount.quantity, normalizedAmount.unit);
    if (ml != null && ml < ONE_TBSP_ML) return true;
  }

  return false;
}
