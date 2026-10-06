import type { MealSlot, Recipe } from '../../types/mealprep';
import { mealDbCategoryFromRecipeTag } from '../recipesTab/categoryDiet';
import { recipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import { mealSlotToPlanCode, type PlanSlotCode } from '../seamlessFlow/planSlots';

const MAIN_MEALDB_CATEGORIES =
  /^(beef|chicken|lamb|pork|goat|seafood|pasta|vegetarian|vegan|miscellaneous)$/i;

const CONDIMENT_DISH_START =
  /^\s*(aioli|aji|ají|mayo|mayonnaise|salsa|dip|sauce|gravy|pesto|chimichurri|tahini|hummus|guacamole|ketchup|mustard|relish|chutney|dressing|marinade|condiment)\b/i;

const SWEET_FRIED_SIDE_TITLE =
  /\b(sopaipillas?|buñuelos?|bunuelos?|jamaican festival|num e|ansom chek|churros?|beignets?|doughnuts?|donuts?|fritters?)\b/i;

const DINNER_SIDE_ALLOWED_TITLE =
  /\b(soup|chowder|stew|pierogi|mantu|burek|kumpir|callaloo|dumpling)\b/i;

/** Title fallback when MealDB category is unknown (imports, creator recipes). */
const DESSERT_TITLE_FALLBACK =
  /\b(cake|cookie|brownie|cupcake|muffin|pastry|pudding|tart|boterkoek|butter cake|sweet bread|banana bread|zucchini bread|pumpkin bread|brioche|babka|challah|affogato|baklava|crumble|chelsea buns?|buns)\b/i;

const BREAKFAST_TITLE_FALLBACK =
  /\b(pancakes?|waffles?|omelett?e|oats?|oatmeal|granola|smoothie|toast|frittata|crepes?|blini|boxty|breakfast|congee|porridge|muffins?|bagels?|hash browns?|french toast|aebleskiver|ebleskiver|beetroot pancakes)\b/i;

const SWEET_BREAD_TITLE =
  /\b(sweet bread|babka|challah|brioche|bajan sweet bread|boterkoek|butter cake)\b/i;

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
    .replace(/Æ/g, 'Ae')
    .replace(/æ/g, 'ae')
    .replace(/Œ/g, 'Oe')
    .replace(/œ/g, 'oe')
    .replace(/Ø/g, 'O')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

function mealDbCategoryForRecipe(recipe: Recipe): string | null {
  return mealDbCategoryFromRecipeTag(recipe.tag, {
    recipeId: recipe.id,
    sourceType: recipe.sourceType,
  });
}

function categoryGroupForRecipe(recipe: Recipe) {
  const mealdbCat = mealDbCategoryForRecipe(recipe);
  if (mealdbCat) {
    if (/^breakfast$/i.test(mealdbCat)) return 'breakfast';
    if (/^dessert$/i.test(mealdbCat)) return 'dessert';
    if (/^(starter|side)$/i.test(mealdbCat)) return 'light';
    if (MAIN_MEALDB_CATEGORIES.test(mealdbCat)) {
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

const CONDIMENT_FALSE_MAIN_WORD =
  /\b(lentils|chicken|eggplant|sandwich|pita|wrap|bowl|salad|potato|potatoes|corn|lamb|beef|pork|fish|prawn|shrimp|tofu)\b/i;

function isStandaloneCondimentTitle(name: string): boolean {
  const trimmed = name.trim();
  if (/^\s*aj/i.test(trimmed) && /\baguacate\b/i.test(trimmed)) return true;
  if (!CONDIMENT_DISH_START.test(trimmed)) return false;
  const normalized = normalizeTitleForKeywordMatch(trimmed);
  if (CONDIMENT_FALSE_MAIN_WORD.test(normalized)) return false;
  return true;
}

function isSauceOrCondimentTitle(name: string, mealDbCategory: string | null): boolean {
  if (isStandaloneCondimentTitle(name)) return true;
  if (mealDbCategory && MAIN_MEALDB_CATEGORIES.test(mealDbCategory)) {
    return false;
  }
  return isStandaloneCondimentTitle(name);
}

function lunchDinnerExcludedByCategory(recipe: Recipe, slot: MealSlot): boolean {
  const category = mealDbCategoryForRecipe(recipe);
  if (!category) return false;
  if (isDessertCategory(category)) return true;
  if (slot === 'dinner' && /^(starter|side)$/i.test(category)) {
    const normalized = normalizeTitleForKeywordMatch(recipe.name);
    if (DINNER_SIDE_ALLOWED_TITLE.test(normalized)) return false;
    return true;
  }
  return false;
}

function lunchDinnerExcludedByTitleFallback(name: string, slot: MealSlot): boolean {
  const normalized = normalizeTitleForKeywordMatch(name);
  if (DESSERT_TITLE_FALLBACK.test(normalized)) return true;
  if (BREAKFAST_TITLE_FALLBACK.test(normalized)) return true;
  if (SWEET_BREAD_TITLE.test(normalized)) return true;
  if (slot === 'lunch' && SWEET_FRIED_SIDE_TITLE.test(normalized)) return true;
  return false;
}

function breakfastAllowed(recipe: Recipe): boolean {
  const category = mealDbCategoryForRecipe(recipe);
  if (isBreakfastCategory(category)) return true;
  const normalized = normalizeTitleForKeywordMatch(recipe.name);
  if (BREAKFAST_TITLE_FALLBACK.test(normalized)) return true;
  const group = categoryGroupForRecipe(recipe);
  if (group === 'breakfast') return true;
  return false;
}

/** Default picker list (not search): hide recipes that clearly belong to another slot. */
export function recipeSuitsMealPickerSlot(recipe: Recipe, slot: MealSlot): boolean {
  const category = mealDbCategoryForRecipe(recipe);
  if (isSauceOrCondimentTitle(recipe.name, category)) return false;

  if (slot === 'lunch' || slot === 'dinner') {
    if (lunchDinnerExcludedByCategory(recipe, slot)) return false;
    if (lunchDinnerExcludedByTitleFallback(recipe.name, slot)) return false;
    if (isDessertCategory(category) || categoryGroupForRecipe(recipe) === 'dessert') return false;
  }

  if (slot === 'breakfast') {
    if (!breakfastAllowed(recipe)) return false;
    const normalized = normalizeTitleForKeywordMatch(recipe.name);
    if (isBreakfastCategory(category) || BREAKFAST_TITLE_FALLBACK.test(normalized)) {
      return true;
    }
    return slotPriorForRecipe(recipe, slot) >= 0.5;
  }

  if (isBreakfastCategory(category) || categoryGroupForRecipe(recipe) === 'breakfast') {
    return false;
  }
  if (BREAKFAST_TITLE_FALLBACK.test(normalizeTitleForKeywordMatch(recipe.name))) {
    return false;
  }
  if (SWEET_BREAD_TITLE.test(normalizeTitleForKeywordMatch(recipe.name))) {
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
