import { normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/normalize';
import { BASE_PRICE_TABLE } from './basePrices';
import type { BasePriceEntry } from './types';

function entryMatchScore(name: string, entry: BasePriceEntry): number {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return 0;

  const candidates = [entry.name, ...entry.aliases].map((c) => normalizeIngredientName(c));
  let best = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (normalized === candidate) best = Math.max(best, 100);
    else if (normalized.includes(candidate) || candidate.includes(normalized)) {
      best = Math.max(best, 85);
    } else {
      const tokens = tokenizeIngredientName(normalized);
      const entryTokens = tokenizeIngredientName(candidate);
      if (entryTokens.length > 0 && entryTokens.every((t) => tokens.includes(t))) {
        best = Math.max(best, 70);
      }
    }
  }
  return best;
}

export function findBasePriceForIngredient(name: string): BasePriceEntry | null {
  let best: BasePriceEntry | null = null;
  let bestScore = 0;
  for (const entry of BASE_PRICE_TABLE) {
    const score = entryMatchScore(name, entry);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 70 ? best : null;
}
