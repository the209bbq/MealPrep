import { FUZZY_MATCH_THRESHOLD } from '../../config/recipeMatchingConfig';
import { ingredientMatchScore, normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/normalize';
import { titleTokensForSimilarity } from '../recipes/nearDuplicate';
import { ingredientTextMatchesCategorySlug } from './categorySlugs';
import type { MainIngredientPick } from './types';

export function recipeTitleMatchesPick(recipeName: string, pick: MainIngredientPick): boolean {
  const titleTokens = titleTokensForSimilarity(recipeName);
  for (const term of pick.matchTerms) {
    const termTokens = tokenizeIngredientName(term);
    if (termTokens.length === 0) continue;
    if (termTokens.every((t) => titleTokens.has(t))) return true;
    const normTerm = normalizeIngredientName(term);
    const normTitle = normalizeIngredientName(recipeName);
    if (normTerm && normTitle.includes(normTerm)) return true;
  }
  if (pick.categorySlug && ingredientTextMatchesCategorySlug(recipeName, pick.categorySlug)) {
    return true;
  }
  return false;
}

export function ingredientNameMatchesPick(ingredientName: string, pick: MainIngredientPick): boolean {
  const trimmed = ingredientName.trim();
  if (!trimmed) return false;

  if (pick.categorySlug && ingredientTextMatchesCategorySlug(trimmed, pick.categorySlug)) {
    return true;
  }

  let best = 0;
  for (const term of pick.matchTerms) {
    best = Math.max(best, ingredientMatchScore(trimmed, term));
    best = Math.max(best, ingredientMatchScore(term, trimmed));
  }
  return best >= FUZZY_MATCH_THRESHOLD;
}
