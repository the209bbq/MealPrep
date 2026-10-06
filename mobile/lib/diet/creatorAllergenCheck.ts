import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import { PEANUT_DISH_NAME_KEYWORDS, PEANUT_INGREDIENT_KEYWORDS } from '../../config/dietRules';
import { haystackForLine, phraseMatchesHaystack } from './allergenMatch';
import { shouldHideRecipeForDietPrefs } from './conflicts';
import { ingredientLinesFromRecipe } from './ingredientLines';
import type { UserDietPrefs } from './types';

function redactPeanutDishNamePhrases(line: string): string {
  let out = line;
  for (const phrase of PEANUT_DISH_NAME_KEYWORDS) {
    const normalized = phrase.replace(/-/g, ' ');
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const body = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const re = new RegExp(`(?:^|[\\s|,])${body}(?:$|[\\s|,])`, 'gi');
    out = out.replace(re, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Creator video descriptions: direct peanut words only (not title-style dish names). */
export function shouldHideCreatorDescriptionForDietPrefs(
  prefs: UserDietPrefs,
  description: string,
): boolean {
  const trimmed = description.trim();
  if (!trimmed || !prefs.hideConflicts) return false;

  if (prefs.allergens.includes('peanuts')) {
    const haystack = haystackForLine(trimmed);
    const ingredientPeanut = PEANUT_INGREDIENT_KEYWORDS.some((phrase) =>
      phraseMatchesHaystack(haystack, phrase),
    );
    if (ingredientPeanut) {
      return shouldHideRecipeForDietPrefs(prefs, [trimmed]);
    }
    const redacted = redactPeanutDishNamePhrases(trimmed);
    if (!redacted) return false;
    return shouldHideRecipeForDietPrefs(prefs, [redacted]);
  }

  return shouldHideRecipeForDietPrefs(prefs, [trimmed]);
}

export function shouldHideCreatorModelForDietPrefs(
  prefs: UserDietPrefs,
  model: CreatorFeedCardModel,
): boolean {
  if (!prefs.hideConflicts) return false;
  const title = model.video.title?.trim() || model.item.title?.trim();
  const fromRecipe = model.importedRecipe ? ingredientLinesFromRecipe(model.importedRecipe) : [];
  const titleAndIngredients = [...fromRecipe, ...(title ? [title] : [])];
  if (
    titleAndIngredients.length > 0 &&
    shouldHideRecipeForDietPrefs(prefs, titleAndIngredients)
  ) {
    return true;
  }
  const description = model.video.descriptionSnippet?.trim();
  if (description && shouldHideCreatorDescriptionForDietPrefs(prefs, description)) {
    return true;
  }
  return false;
}
