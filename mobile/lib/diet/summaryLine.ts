import { ALLERGEN_CONTAINS_LABEL, ALLERGEN_FREE_LABEL } from '../../config/diet';
import { ingredientLinesMatchingAllergen } from './tagRecipe';
import type { AllergenId, RecipeDietTagResult, UserDietPrefs } from './types';

function uniqueDisplayNames(lines: string[], limit = 3): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out.join(', ');
}

export function recipeDietSummaryForPrefs(
  prefs: UserDietPrefs,
  tag: RecipeDietTagResult,
  ingredientLines: string[],
): string | null {
  const userAllergens = prefs.allergens.filter((a) => tag.contains_allergens.includes(a));
  if (userAllergens.length > 0) {
    const primary = userAllergens[0]!;
    const hits = ingredientLinesMatchingAllergen(ingredientLines, primary);
    const names = uniqueDisplayNames(hits, 3);
    if (primary === 'peanuts' || primary === 'tree_nuts') {
      const label = ALLERGEN_CONTAINS_LABEL[primary];
      return names ? `Contains ${label}: ${names}` : `Contains ${label}`;
    }
    const freeLabel = ALLERGEN_FREE_LABEL[primary];
    return names ? `Not ${freeLabel}: ${names}` : `Not ${freeLabel}`;
  }

  for (const diet of prefs.diets) {
    const failed = tag.diets_fail[diet];
    if (failed && failed.length > 0) {
      return `Not ${diet}: ${uniqueDisplayNames(failed, 3)}`;
    }
    if (!tag.diets_ok.includes(diet)) {
      return `Not ${diet}`;
    }
  }

  if (prefs.dislikes.length > 0 && tag.dislikes_hit.length > 0) {
    return `Contains disliked: ${uniqueDisplayNames(tag.dislikes_hit, 3)}`;
  }

  return null;
}

export function primaryAllergenConflictBadge(
  prefs: UserDietPrefs,
  tag: RecipeDietTagResult,
): AllergenId | null {
  for (const allergen of prefs.allergens) {
    if (tag.contains_allergens.includes(allergen)) return allergen;
  }
  return null;
}
