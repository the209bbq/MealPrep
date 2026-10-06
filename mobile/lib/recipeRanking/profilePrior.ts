import type { UserDietPrefs } from '../diet/types';
import type { RecipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import type { Recipe } from '../../types/mealprep';

export function defaultHouseholdServings(householdSize: number): number {
  return Math.max(1, Math.min(12, Math.round(householdSize) || 1));
}

/** servingsFit in 0..1 per personalization v2 §1.2 */
export function servingsFitScore(recipeServings: number | null | undefined, householdSize: number): number {
  const target = defaultHouseholdServings(householdSize);
  if (recipeServings == null || recipeServings <= 0) return 0.7;
  const servings = recipeServings;
  if (servings === target) return 1;
  const ratio = servings / target;
  const wholeMultiple = Math.abs(ratio - Math.round(ratio)) < 0.01;
  const halfMultiple = Math.abs(ratio * 2 - Math.round(ratio * 2)) < 0.01;
  if (wholeMultiple || halfMultiple) return 1;
  return 0.5;
}

export function profilePriorForGroup(
  prefs: UserDietPrefs,
  group: RecipeCategoryGroup,
  minutes: number,
  householdSize: number,
  recipeCategory?: string,
): number {
  let prior = 0;
  const diets = prefs.diets ?? [];
  const cat = (recipeCategory ?? '').toLowerCase();
  if (diets.includes('vegan') && (cat === 'vegan' || group === 'main' && cat === 'vegan')) {
    prior += 0.4;
  } else if (diets.includes('vegetarian') && (cat === 'vegetarian' || cat === 'vegan')) {
    prior += 0.4;
  }
  const household = Math.max(1, householdSize);
  if (household >= 3) {
    if (group === 'main') prior += 0.2;
  } else if (household <= 2 && minutes <= 30) {
    prior += 0.2;
  }
  return prior;
}

export function profilePriorScore(
  prefs: UserDietPrefs,
  group: RecipeCategoryGroup,
  recipe: Recipe,
  householdSize: number,
): number {
  const raw = profilePriorForGroup(prefs, group, recipe.minutes, householdSize, recipe.tag);
  return Math.max(0, Math.min(100, 50 + raw * 50));
}
