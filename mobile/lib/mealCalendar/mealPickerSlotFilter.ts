import type { MealSlot, Recipe } from '../../types/mealprep';
import { recipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import { mealSlotToPlanCode, type PlanSlotCode } from '../seamlessFlow/planSlots';

/** Sauces / condiments that are not meal picks (matches QA dinner picker noise). */
const SAUCE_CONDIMENT_TITLE =
  /\b(aioli|mayo|mayonnaise|ketchup|mustard|relish|chutney|dressing|dip|gravy|marinade|salsa|pesto|tahini|hummus|guacamole|bbq sauce|barbecue sauce|condiment)\b/i;

const SLOT_PRIOR: Record<
  ReturnType<typeof recipeCategoryGroup>,
  Record<PlanSlotCode, number>
> = {
  breakfast: { B: 3, L: 0.5, D: 0 },
  light: { B: 0.3, L: 2, D: 1.5 },
  main: { B: 0, L: 1, D: 2 },
  dessert: { B: 0, L: 0.5, D: 2 },
  unknown: { B: 0.3, L: 1, D: 1 },
};

function categoryGroupForRecipe(recipe: Recipe) {
  return recipeCategoryGroup({
    category: recipe.tag,
    title: recipe.name,
    tags: [],
  });
}

function slotPriorForRecipe(recipe: Recipe, slot: MealSlot): number {
  const code = mealSlotToPlanCode(slot);
  if (!code) return 0;
  const group = categoryGroupForRecipe(recipe);
  return SLOT_PRIOR[group][code] ?? 0;
}

/** Default picker list (not search): hide recipes that clearly belong to another slot. */
export function recipeSuitsMealPickerSlot(recipe: Recipe, slot: MealSlot): boolean {
  if (SAUCE_CONDIMENT_TITLE.test(recipe.name)) return false;
  const group = categoryGroupForRecipe(recipe);
  if (group === 'dessert') return false;
  if (slot !== 'breakfast' && group === 'breakfast') return false;
  if (slot === 'breakfast' && group === 'main') return false;
  return slotPriorForRecipe(recipe, slot) >= 0.5;
}

export function compareMealPickerPantryRank(
  a: { missingCount: number; matchedCount: number; pantryPercent: number; title: string; isSaved: boolean },
  b: { missingCount: number; matchedCount: number; pantryPercent: number; title: string; isSaved: boolean },
): number {
  if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
  const aReady = !a.isSaved && a.missingCount === 0 && a.matchedCount > 0;
  const bReady = !b.isSaved && b.missingCount === 0 && b.matchedCount > 0;
  if (aReady !== bReady) return aReady ? -1 : 1;
  if (a.pantryPercent !== b.pantryPercent) return b.pantryPercent - a.pantryPercent;
  return a.title.localeCompare(b.title);
}
