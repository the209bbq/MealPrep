import { COMMON_MAIN_INGREDIENT_CHIPS } from '../../config/mainIngredient';
import type { PantryItem } from '../../types/mealprep';
import { mainIngredientPickFromChipId, mainIngredientPickFromPantryItem } from './picks';
import type { MainIngredientPick } from './types';

const PROTEIN_CATEGORIES = new Set<PantryItem['category']>(['meats', 'frozen']);

function expirySortKey(item: PantryItem): number {
  if (!item.expiresOn) return Number.POSITIVE_INFINITY;
  const t = Date.parse(item.expiresOn);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function pantryChipScore(item: PantryItem): number {
  let score = 0;
  if (PROTEIN_CATEGORIES.has(item.category)) score += 100;
  const expiry = expirySortKey(item);
  if (expiry < Number.POSITIVE_INFINITY) {
    score += 50;
    score -= Math.min(expiry / 1_000_000_000_000, 1);
  }
  return score;
}

export interface MainIngredientChipOption {
  pick: MainIngredientPick;
}

export function suggestMainIngredientChips(pantry: readonly PantryItem[]): MainIngredientChipOption[] {
  const seen = new Set<string>();
  const options: MainIngredientChipOption[] = [];

  const pantrySorted = [...pantry].sort((a, b) => pantryChipScore(b) - pantryChipScore(a));
  for (const item of pantrySorted) {
    const pick = mainIngredientPickFromPantryItem(item);
    if (seen.has(pick.id)) continue;
    seen.add(pick.id);
    options.push({ pick });
    if (options.length >= 8) break;
  }

  for (const common of COMMON_MAIN_INGREDIENT_CHIPS) {
    if (seen.has(common.id)) continue;
    seen.add(common.id);
    options.push({ pick: mainIngredientPickFromChipId(common.id, common.label) });
    if (options.length >= 12) break;
  }

  return options;
}
