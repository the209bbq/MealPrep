import type { MealSlot, Recipe } from '../../types/mealprep';
import { recipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import { mealSlotToPlanCode, type PlanSlotCode } from '../seamlessFlow/planSlots';

/** Sauces / condiments that are not meal picks (matches QA dinner picker noise). */
const SAUCE_CONDIMENT_TITLE =
  /\b(aioli|mayo|mayonnaise|ketchup|mustard|relish|chutney|dressing|dip|gravy|marinade|salsa|pesto|tahini|hummus|guacamole|bbq sauce|barbecue sauce|condiment|sauce)\b/i;

function isSauceOrCondimentTitle(name: string): boolean {
  if (SAUCE_CONDIMENT_TITLE.test(name)) return true;
  if (/^\s*aj/i.test(name) && /\baguacate\b/i.test(name)) return true;
  return false;
}

const SWEET_OR_BAKED_TITLE =
  /\b(cake|cookie|brownie|cupcake|muffin|pastry|pudding|tart|pie|boterkoek|butter cake|sweet bread|banana bread|zucchini bread|pumpkin bread|brioche|babka|challah|æbleskiver|ebleskiver|pancake|waffle|crepe|blini|boxty)\b/i;

const SAVORY_FLATBREAD_TITLE =
  /\b(naan|pita|flatbread|focaccia|lavash|roti|chapati|tortilla wrap)\b/i;

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

function dinnerExcludedSweetOrSauce(recipe: Recipe): boolean {
  const tag = (recipe.tag ?? '').trim();
  if (/^dessert$/i.test(tag)) return true;
  const group = categoryGroupForRecipe(recipe);
  if (group === 'dessert') return true;
  const name = recipe.name;
  if (isSauceOrCondimentTitle(name)) return true;
  if (SWEET_OR_BAKED_TITLE.test(name)) return true;
  if (/\bbread\b/i.test(name)) {
    if (group === 'main' || SAVORY_FLATBREAD_TITLE.test(name)) return false;
    return true;
  }
  if (/\bcookie\b/i.test(name) || /\bcake\b/i.test(name)) return true;
  return false;
}

/** Default picker list (not search): hide recipes that clearly belong to another slot. */
export function recipeSuitsMealPickerSlot(recipe: Recipe, slot: MealSlot): boolean {
  if (isSauceOrCondimentTitle(recipe.name)) return false;
  const group = categoryGroupForRecipe(recipe);
  if (group === 'dessert') return false;
  if (slot === 'dinner' && dinnerExcludedSweetOrSauce(recipe)) return false;
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
