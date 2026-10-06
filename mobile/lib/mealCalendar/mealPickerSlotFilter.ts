import type { MealSlot, Recipe } from '../../types/mealprep';
import { mealDbCategoryFromRecipeTag } from '../recipesTab/categoryDiet';
import { recipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import { mealSlotToPlanCode, type PlanSlotCode } from '../seamlessFlow/planSlots';

/** Sauces / condiments that are not meal picks (matches QA dinner picker noise). */
const SAUCE_CONDIMENT_TITLE =
  /\b(aioli|mayo|mayonnaise|ketchup|relish|chutney|dip|gravy|marinade|salsa|pesto|tahini|guacamole|bbq sauce|barbecue sauce|condiment)\b/i;

function isSauceOrCondimentTitle(name: string): boolean {
  if (SAUCE_CONDIMENT_TITLE.test(name)) return true;
  if (/^\s*aj/i.test(name) && /\baguacate\b/i.test(name)) return true;
  return false;
}

/** Title fallback when MealDB category is unknown (imports, creator recipes). */
const DESSERT_TITLE_FALLBACK =
  /\b(cake|cookie|brownie|cupcake|muffin|pastry|pudding|tart|boterkoek|butter cake|sweet bread|banana bread|zucchini bread|pumpkin bread|brioche|babka|challah|affogato|baklava|crumble|chelsea buns?|buns)\b/i;

const BREAKFAST_TITLE_FALLBACK =
  /\b(pancakes?|waffles?|omelett?e|oats?|oatmeal|granola|smoothie|toast|frittata|crepes?|blini|boxty|breakfast|congee|porridge|muffins?|bagels?|hash browns?|french toast|aebleskiver|ebleskiver)\b/i;

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

function normalizeTitleForKeywordMatch(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function mealDbCategoryForRecipe(recipe: Recipe): string | null {
  return mealDbCategoryFromRecipeTag(recipe.tag);
}

function categoryGroupForRecipe(recipe: Recipe) {
  const mealdbCat = mealDbCategoryForRecipe(recipe);
  if (mealdbCat) {
    if (/^breakfast$/i.test(mealdbCat)) return 'breakfast';
    if (/^dessert$/i.test(mealdbCat)) return 'dessert';
    if (/^(starter|side)$/i.test(mealdbCat)) return 'light';
    if (
      /^(beef|chicken|lamb|pork|goat|seafood|pasta|vegetarian|vegan|miscellaneous)$/i.test(
        mealdbCat,
      )
    ) {
      return 'main';
    }
  }
  const category = mealdbCat ?? recipe.tag;
  return recipeCategoryGroup({
    category,
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

function isDessertCategory(category: string | null): boolean {
  return Boolean(category && /^dessert$/i.test(category));
}

function isBreakfastCategory(category: string | null): boolean {
  return Boolean(category && /^breakfast$/i.test(category));
}

function lunchDinnerExcludedByCategory(recipe: Recipe, slot: MealSlot): boolean {
  const category = mealDbCategoryForRecipe(recipe);
  if (!category) return false;
  if (isDessertCategory(category)) return true;
  if (slot === 'dinner' && /^(starter|side)$/i.test(category)) return true;
  return false;
}

function lunchDinnerExcludedByTitleFallback(name: string): boolean {
  const normalized = normalizeTitleForKeywordMatch(name);
  if (DESSERT_TITLE_FALLBACK.test(normalized)) return true;
  if (BREAKFAST_TITLE_FALLBACK.test(normalized)) return true;
  return false;
}

function breakfastAllowed(recipe: Recipe): boolean {
  const category = mealDbCategoryForRecipe(recipe);
  if (isBreakfastCategory(category)) return true;
  const group = categoryGroupForRecipe(recipe);
  if (group === 'breakfast') return true;
  if (!category) {
    return BREAKFAST_TITLE_FALLBACK.test(normalizeTitleForKeywordMatch(recipe.name));
  }
  return false;
}

/** Default picker list (not search): hide recipes that clearly belong to another slot. */
export function recipeSuitsMealPickerSlot(recipe: Recipe, slot: MealSlot): boolean {
  if (isSauceOrCondimentTitle(recipe.name)) return false;

  const category = mealDbCategoryForRecipe(recipe);
  const hasMealDbCategory = Boolean(category);

  if (slot === 'lunch' || slot === 'dinner') {
    if (hasMealDbCategory && lunchDinnerExcludedByCategory(recipe, slot)) return false;
    if (!hasMealDbCategory && lunchDinnerExcludedByTitleFallback(recipe.name)) return false;
    if (isDessertCategory(category) || categoryGroupForRecipe(recipe) === 'dessert') return false;
  }

  if (slot === 'breakfast') {
    if (!breakfastAllowed(recipe)) return false;
    return slotPriorForRecipe(recipe, slot) >= 0.5;
  }

  if (isBreakfastCategory(category) || categoryGroupForRecipe(recipe) === 'breakfast') {
    return false;
  }

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
