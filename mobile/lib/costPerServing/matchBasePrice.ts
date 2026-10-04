import { fuzzyNameScore, normalizeIngredientName } from '../recipeMatch/normalize';
import { BASE_PRICE_ENTRIES, BASE_PRICE_BY_KEY } from './basePrices';
import type { BasePriceEntry } from './types';

const MIN_SCORE = 72;

export function matchBasePriceEntry(ingredientName: string): BasePriceEntry | null {
  const normalized = normalizeIngredientName(ingredientName);
  if (!normalized) return null;

  let best: BasePriceEntry | null = null;
  let bestScore = 0;

  for (const entry of BASE_PRICE_ENTRIES) {
    for (const alias of entry.aliases) {
      const aliasNorm = normalizeIngredientName(alias);
      if (!aliasNorm) continue;
      if (normalized === aliasNorm) {
        return entry;
      }
      if (normalized.includes(aliasNorm) || aliasNorm.includes(normalized)) {
        const score = Math.max(aliasNorm.length, normalized.length) + 50;
        if (score > bestScore) {
          bestScore = score;
          best = entry;
        }
      }
      const fuzzy = fuzzyNameScore(normalized, aliasNorm);
      if (fuzzy > bestScore && fuzzy >= MIN_SCORE) {
        bestScore = fuzzy;
        best = entry;
      }
    }
  }

  return best;
}

export function basePriceEntryByKey(key: string): BasePriceEntry | undefined {
  return BASE_PRICE_BY_KEY.get(key);
}
