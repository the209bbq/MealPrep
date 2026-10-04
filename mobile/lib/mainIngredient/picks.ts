import type { PantryItem } from '../../types/mealprep';
import { canonicalIngredientSearchLabel } from '../recipeMatch/ingredientNormalize';
import { expandSynonymKeys } from '../recipeMatch/normalize';
import { categorySlugForLabel, slugForMainIngredientLabel } from './categorySlugs';
import type { MainIngredientPick } from './types';

export function mainIngredientPickFromLabel(rawLabel: string): MainIngredientPick {
  const label = rawLabel.trim() || 'Ingredient';
  const searchLabel = canonicalIngredientSearchLabel(label);
  const matchTerms = [...new Set([label, searchLabel, ...expandSynonymKeys(label)].filter(Boolean))];
  const categorySlug = categorySlugForLabel(label);
  return {
    id: slugForMainIngredientLabel(label),
    label: searchLabel || label,
    matchTerms,
    categorySlug,
  };
}

export function mainIngredientPickFromPantryItem(item: PantryItem): MainIngredientPick {
  return mainIngredientPickFromLabel(item.name);
}

export function mainIngredientPickFromChipId(id: string, label: string): MainIngredientPick {
  const pick = mainIngredientPickFromLabel(label);
  return { ...pick, id };
}
