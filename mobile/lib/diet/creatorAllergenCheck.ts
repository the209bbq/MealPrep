import type { CreatorFeedCardModel } from '../recipes/creatorFeedRows';
import {
  PEANUT_DISH_NAME_STRONG,
  PEANUT_DISH_NAME_WEAK,
  PEANUT_INGREDIENT_KEYWORDS,
} from '../../config/dietRules';
import { normalizeIngredientName } from '../recipeMatch/ingredientNormalize';
import { haystackForLine, phraseMatchesHaystack } from './allergenMatch';
import { shouldHideRecipeForDietPrefs } from './conflicts';
import { ingredientLinesFromRecipe } from './ingredientLines';
import type { UserDietPrefs } from './types';

function peanutIngredientInHaystack(haystack: string): boolean {
  return PEANUT_INGREDIENT_KEYWORDS.some((phrase) => phraseMatchesHaystack(haystack, phrase));
}

function peanutStrongDishInHaystack(haystack: string): boolean {
  return PEANUT_DISH_NAME_STRONG.some((phrase) => phraseMatchesHaystack(haystack, phrase));
}

function peanutWeakDishInHaystack(haystack: string): boolean {
  return PEANUT_DISH_NAME_WEAK.some((phrase) => phraseMatchesHaystack(haystack, phrase));
}

function peanutTitleShouldHide(prefs: UserDietPrefs, title: string): boolean {
  if (!prefs.hideConflicts || !prefs.allergens.includes('peanuts')) return false;
  const haystack = haystackForLine(title);
  if (peanutIngredientInHaystack(haystack)) return true;
  if (peanutStrongDishInHaystack(haystack)) return true;
  return peanutWeakDishInHaystack(haystack);
}

function dislikeIngredientInHaystack(haystack: string, dislikes: readonly string[]): boolean {
  for (const dislike of dislikes) {
    const normalized = normalizeIngredientName(dislike);
    if (!normalized) continue;
    if (phraseMatchesHaystack(haystack, normalized)) return true;
  }
  return false;
}

/** Creator video descriptions: peanut ingredients + strong dish names; dislike ingredient words. */
export function shouldHideCreatorDescriptionForDietPrefs(
  prefs: UserDietPrefs,
  description: string,
): boolean {
  const trimmed = description.trim();
  if (!trimmed || !prefs.hideConflicts) return false;

  if (prefs.dislikes.length > 0) {
    const dislikeHaystack = haystackForLine(trimmed);
    if (dislikeIngredientInHaystack(dislikeHaystack, prefs.dislikes)) {
      return true;
    }
  }

  if (prefs.allergens.includes('peanuts')) {
    const haystack = haystackForLine(trimmed);
    if (peanutIngredientInHaystack(haystack)) {
      return shouldHideRecipeForDietPrefs(prefs, [trimmed]);
    }
    if (peanutStrongDishInHaystack(haystack)) {
      return shouldHideRecipeForDietPrefs(prefs, [trimmed]);
    }
    return false;
  }

  return shouldHideRecipeForDietPrefs(prefs, [trimmed]);
}

export function shouldHideCreatorModelForDietPrefs(
  prefs: UserDietPrefs,
  model: CreatorFeedCardModel,
): boolean {
  if (!prefs.hideConflicts) return false;
  const title = model.video.title?.trim() || model.item.title?.trim();
  if (title && peanutTitleShouldHide(prefs, title)) {
    return true;
  }
  const fromRecipe = model.importedRecipe ? ingredientLinesFromRecipe(model.importedRecipe) : [];
  const nonPeanutTitleLines = [...fromRecipe, ...(title ? [title] : [])];
  if (
    nonPeanutTitleLines.length > 0 &&
    shouldHideRecipeForDietPrefs(prefs, nonPeanutTitleLines)
  ) {
    return true;
  }
  const description = model.video.descriptionSnippet?.trim();
  if (description && shouldHideCreatorDescriptionForDietPrefs(prefs, description)) {
    return true;
  }
  return false;
}
