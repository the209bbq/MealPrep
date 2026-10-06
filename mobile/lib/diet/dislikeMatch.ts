import { normalizeIngredientName } from '../recipeMatch/ingredientNormalize';
import { haystackForLine, phraseMatchesHaystack } from './allergenMatch';

function dislikeStem(dislike: string): string {
  const normalized = normalizeIngredientName(dislike);
  if (!normalized) return '';
  if (normalized.length > 3 && normalized.endsWith('es')) {
    return normalized.slice(0, -2);
  }
  if (normalized.length > 2 && normalized.endsWith('s')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

/** Match a dislike ingredient against text (singular stem + simple plural forms). */
export function dislikeMatchesHaystack(haystack: string, dislike: string): boolean {
  const stem = dislikeStem(dislike);
  if (!stem) return false;
  if (phraseMatchesHaystack(haystack, stem)) return true;
  if (phraseMatchesHaystack(haystack, `${stem}s`)) return true;
  if (phraseMatchesHaystack(haystack, `${stem}es`)) return true;
  return false;
}

export function dislikeMatchesLine(line: string, dislikes: readonly string[]): boolean {
  if (dislikes.length === 0) return false;
  const haystack = haystackForLine(line);
  return dislikes.some((dislike) => dislikeMatchesHaystack(haystack, dislike));
}
