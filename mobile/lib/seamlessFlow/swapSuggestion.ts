import type { RecipePantryMatch } from '../recipeMatch';

const NEAR_READY_MAX_MISSING = 2;
const NEAR_READY_MIN_PERCENT = 70;

function isSwapCandidate(match: RecipePantryMatch): boolean {
  if (match.totalIngredients <= 0) return false;
  if (match.missingCount === 0) return true;
  return (
    match.missingCount <= NEAR_READY_MAX_MISSING &&
    match.percentMatch >= NEAR_READY_MIN_PERCENT
  );
}

function swapCandidateScore(match: RecipePantryMatch): number {
  return match.percentMatch * 10 - match.missingCount * 25;
}

/** Pick a different ready (or near-ready) recipe, preferring the best pantry fit. */
export function pickSwapPantryMatch(
  ranked: readonly RecipePantryMatch[],
  currentRecipeId: string,
): RecipePantryMatch | null {
  let best: RecipePantryMatch | null = null;
  let bestScore = -Infinity;
  for (const match of ranked) {
    if (match.recipeId === currentRecipeId) continue;
    if (!isSwapCandidate(match)) continue;
    const score = swapCandidateScore(match);
    if (score > bestScore) {
      bestScore = score;
      best = match;
    }
  }
  return best;
}
