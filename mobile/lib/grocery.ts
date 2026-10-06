import { CATEGORY_LABELS } from '../config/appConfig';
import type {
  GroceryListItem,
  GroceryPlannedMealLink,
  MealPlanItem,
  PantryCategory,
  PantryItem,
  Recipe,
  RecipeIngredient,
} from '../types/mealprep';
import { inferGroceryCategoryFromName } from './grocery/categorize';
import { isGroceryDismissed, isGroceryManualLineDismissed } from './grocery/dismissals';
import { compareScheduledMeals } from './mealCalendar/groupMeals';
import {
  findPantryItemsForIngredient,
  ingredientShortfall,
  totalPantryQuantityInUnit,
} from './recipeMatch/pantryStock';
import { isGroceryOriginPinned, preferGroceryOrigin } from './grocery/origin';
import {
  pinnedGroceryForMealPlanRebuild,
  pinnedGroceryWithoutMealPlan,
} from './grocery/pinnedSurvivors';
import { normalizePlannedMealLinks } from './grocery/grouping';
import { resolveMealPlanRecipeId } from './mealPlan/resolve';
import { convertIngredientQuantity, ingredientUnitsConvertible } from './units/ingredientUnitBridge';
import { normalizeIngredientName } from './recipeMatch/normalize';

/** Store aisle order for grouped grocery UI. */
export const GROCERY_AISLE_ORDER: PantryCategory[] = [
  'produce',
  'meats',
  'dairy',
  'frozen',
  'dry_goods',
  'condiments',
  'spices',
  'cookware',
];

export function isManualGroceryItem(item: GroceryListItem): boolean {
  return item.origin === 'manual' || item.ingredientId.startsWith('manual-');
}

export function groupGroceryByAisle(items: GroceryListItem[]): { category: PantryCategory; label: string; items: GroceryListItem[] }[] {
  const byCat = new Map<PantryCategory, GroceryListItem[]>();
  for (const item of items) {
    const list = byCat.get(item.category) ?? [];
    list.push(item);
    byCat.set(item.category, list);
  }
  const sections: { category: PantryCategory; label: string; items: GroceryListItem[] }[] = [];
  for (const category of GROCERY_AISLE_ORDER) {
    const aisleItems = byCat.get(category);
    if (!aisleItems?.length) continue;
    sections.push({
      category,
      label: CATEGORY_LABELS[category],
      items: aisleItems.sort((a, b) => a.name.localeCompare(b.name)),
    });
    byCat.delete(category);
  }
  for (const [category, aisleItems] of byCat) {
    sections.push({
      category,
      label: CATEGORY_LABELS[category],
      items: aisleItems.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return sections;
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

function categoryForIngredient(
  ingredientName: string,
  ingredientId: string,
  pantry: PantryItem[],
): GroceryListItem['category'] {
  const matches = findPantryItemsForIngredient(
    { name: ingredientName, ingredientId, quantity: 0, unit: 'each' },
    pantry,
  );
  return matches[0]?.category ?? 'dry_goods';
}

export interface BuildGroceryListOptions {
  groceryDismissals?: Set<string>;
  mealPlan?: MealPlanItem[];
  userId?: string;
}

function activeMealsForGrocery(mealPlan: MealPlanItem[]): MealPlanItem[] {
  return mealPlan
    .filter((item) => !item.made && !item.leftoverOfId)
    .sort((a, b) => {
      const schedA = a.scheduledOn ?? '9999-12-31';
      const schedB = b.scheduledOn ?? '9999-12-31';
      if (schedA !== schedB) return schedA.localeCompare(schedB);
      return compareScheduledMeals(a, b);
    });
}

function clonePantryForSimulation(pantry: PantryItem[]): PantryItem[] {
  return pantry.map((row) => ({ ...row }));
}

function consumePantryForIngredient(
  pantry: PantryItem[],
  ingredient: RecipeIngredient,
  neededQuantity: number,
): void {
  let remaining = neededQuantity;
  const matches = findPantryItemsForIngredient(ingredient, pantry);
  for (const item of matches) {
    if (remaining <= 0) break;
    if (!ingredientUnitsConvertible(ingredient.name, item.unit, ingredient.unit)) continue;
    const available = convertIngredientQuantity(
      item.quantity,
      item.unit,
      ingredient.unit,
      ingredient.name,
    );
    if (available == null || available <= 0) continue;
    const take = Math.min(remaining, available);
    remaining = roundQty(remaining - take);
    const takeInItemUnit = convertIngredientQuantity(
      take,
      ingredient.unit,
      item.unit,
      ingredient.name,
    );
    if (takeInItemUnit == null) continue;
    item.quantity = roundQty(Math.max(0, item.quantity - takeInItemUnit));
  }
}

function mealLinkForItem(meal: MealPlanItem): GroceryPlannedMealLink {
  return {
    mealPlanItemId: meal.id,
    scheduledOn: meal.scheduledOn,
    mealSlot: meal.mealSlot,
    mealTitle: meal.title,
  };
}

function previousCheckedForMealLine(
  previous: GroceryListItem[],
  mealId: string,
  name: string,
  unit: string,
  lineId: string,
): boolean {
  const byMeal = previous.find(
    (row) =>
      row.plannedMealLinks.some((link) => link.mealPlanItemId === mealId) &&
      groceryLineKey(row) === groceryLineKey({ name, unit }),
  );
  if (byMeal) return byMeal.checked;
  const byId = previous.find((row) => row.id === lineId);
  if (byId) return byId.checked;
  const legacy = previous.find((row) => groceryLineKey(row) === groceryLineKey({ name, unit }));
  return legacy?.checked ?? false;
}

function buildGroceryListFromMealPlan(
  recipes: Recipe[],
  mealPlan: MealPlanItem[],
  userId: string,
  pantry: PantryItem[],
  servingOverrides: Record<string, number>,
  previous: GroceryListItem[],
  dismissals: Set<string>,
): GroceryListItem[] {
  const simulatedPantry = clonePantryForSimulation(pantry);
  const list: GroceryListItem[] = [];

  for (const meal of activeMealsForGrocery(mealPlan)) {
    const recipeId = resolveMealPlanRecipeId(meal, recipes, userId);
    if (!recipeId) continue;
    const recipe = recipes.find((row) => row.id === recipeId);
    if (!recipe) continue;

    const servings = servingOverrides[recipe.id] ?? recipe.servings;
    const scale = recipe.servings > 0 ? servings / recipe.servings : 1;
    const link = mealLinkForItem(meal);

    for (const ingredient of recipe.ingredients) {
      const scaled: RecipeIngredient = {
        ...ingredient,
        quantity: roundQty(ingredient.quantity * scale),
      };
      if (
        isGroceryDismissed(dismissals, recipe.id, scaled.name, scaled.unit)
      ) {
        continue;
      }

      const shortfall = ingredientShortfall(scaled, simulatedPantry, scaled.quantity);
      if (!shortfall || shortfall.missingQuantity <= 0) {
        consumePantryForIngredient(simulatedPantry, scaled, scaled.quantity);
        continue;
      }

      consumePantryForIngredient(simulatedPantry, scaled, scaled.quantity - shortfall.missingQuantity);

      const ingredientId =
        shortfall.matchedPantryItem?.ingredientId ??
        (scaled.ingredientId ||
          scaled.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40));
      const lineId = `groc-${meal.id}-${ingredientId}::${scaled.unit}`;

      list.push({
        id: lineId,
        ingredientId,
        name: scaled.name,
        category: categoryForIngredient(scaled.name, scaled.ingredientId, pantry),
        quantity: shortfall.missingQuantity,
        unit: scaled.unit,
        checked: previousCheckedForMealLine(previous, meal.id, scaled.name, scaled.unit, lineId),
        sourceRecipeIds: [recipe.id],
        origin: 'plan',
        plannedMealLinks: [link],
      });
    }
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildGroceryList(
  recipes: Recipe[],
  selectedRecipeIds: string[],
  pantry: PantryItem[],
  servingOverrides: Record<string, number>,
  previous: GroceryListItem[],
  options?: BuildGroceryListOptions,
): GroceryListItem[] {
  const dismissals = options?.groceryDismissals ?? new Set<string>();
  const normalizedPrevious = previous.map((row) => ({
    ...row,
    plannedMealLinks: normalizePlannedMealLinks(row.plannedMealLinks),
  }));

  if (options?.mealPlan?.length && options.userId) {
    const active = activeMealsForGrocery(options.mealPlan);
    if (active.length > 0) {
      const pinnedItems = pinnedGroceryForMealPlanRebuild(normalizedPrevious, dismissals);
      const recipeItems = buildGroceryListFromMealPlan(
        recipes,
        options.mealPlan,
        options.userId,
        pantry,
        servingOverrides,
        normalizedPrevious,
        dismissals,
      );
      return mergeManualGroceryLines(recipeItems, pinnedItems);
    }
  }

  const needed = new Map<
    string,
    { name: string; unit: string; quantity: number; recipeIds: string[]; category: GroceryListItem['category'] }
  >();

  for (const recipe of recipes) {
    if (!selectedRecipeIds.includes(recipe.id)) continue;
    const servings = servingOverrides[recipe.id] ?? recipe.servings;
    const scale = recipe.servings > 0 ? servings / recipe.servings : 1;
    for (const ingredient of recipe.ingredients) {
      const key = `${normalizeIngredientName(ingredient.name)}::${ingredient.unit.trim().toLowerCase()}`;
      const qty = ingredient.quantity * scale;
      const current = needed.get(key);
      if (current) {
        current.quantity += qty;
        if (!current.recipeIds.includes(recipe.id)) current.recipeIds.push(recipe.id);
      } else {
        needed.set(key, {
          name: ingredient.name,
          unit: ingredient.unit,
          quantity: qty,
          recipeIds: [recipe.id],
          category: categoryForIngredient(ingredient.name, ingredient.ingredientId, pantry),
        });
      }
    }
  }

  const checked = new Map(
    normalizedPrevious.map((item) => [
      normalizeIngredientName(item.name) + '::' + item.unit.trim().toLowerCase(),
      item.checked,
    ]),
  );

  const pinnedItems = pinnedGroceryWithoutMealPlan(normalizedPrevious, dismissals);

  const list: GroceryListItem[] = [];
  for (const [key, value] of needed) {
    const dismissedForAllRecipes = value.recipeIds.every((recipeId) =>
      isGroceryDismissed(dismissals, recipeId, value.name, value.unit),
    );
    if (dismissedForAllRecipes) continue;

    const pantryMatches = findPantryItemsForIngredient(
      {
        name: value.name,
        ingredientId: key.split('::')[0] ?? value.name,
        quantity: value.quantity,
        unit: value.unit,
      },
      pantry,
    );
    const have = totalPantryQuantityInUnit(pantryMatches, value.unit, value.name);
    if (pantryMatches.length > 0 && have === null) {
      // Name/id match in pantry but units don't convert (e.g. 1 each vs 250 g) — skip auto-buy line.
      continue;
    }
    const remaining = have === null ? value.quantity : roundQty(Math.max(0, value.quantity - have));
    if (remaining <= 0) continue;

    const ingredientId =
      pantryMatches[0]?.ingredientId ??
      value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

    list.push({
      id: `groc-${ingredientId}::${value.unit}`,
      ingredientId,
      name: value.name,
      category: value.category,
      quantity: remaining,
      unit: value.unit,
      checked: checked.get(key) ?? false,
      sourceRecipeIds: value.recipeIds.filter(
        (recipeId) => !isGroceryDismissed(dismissals, recipeId, value.name, value.unit),
      ),
      origin: 'plan',
      plannedMealLinks: [],
    });
  }

  const recipeItems = list.sort((a, b) => a.name.localeCompare(b.name));
  return mergeManualGroceryLines(recipeItems, pinnedItems);
}

function groceryLineKey(item: Pick<GroceryListItem, 'name' | 'unit'>): string {
  return `${normalizeIngredientName(item.name)}::${item.unit.trim().toLowerCase()}`;
}

/** Merge manual lines into recipe-derived lines by normalized name + unit (case-insensitive). */
export function mergeManualGroceryLines(
  recipeItems: GroceryListItem[],
  manualItems: GroceryListItem[],
): GroceryListItem[] {
  const merged = recipeItems.map((row) => ({ ...row }));
  const indexByKey = new Map(merged.map((row, index) => [groceryLineKey(row), index]));

  for (const manual of manualItems) {
    const key = groceryLineKey(manual);
    const existingIndex = indexByKey.get(key);
    if (existingIndex != null) {
      const existing = merged[existingIndex];
      const sumQty = !(existing.origin === 'plan' && manual.origin === 'add_missing');
      merged[existingIndex] = {
        ...existing,
        quantity: sumQty
          ? roundQty(existing.quantity + manual.quantity)
          : existing.quantity,
        checked: existing.checked || manual.checked,
        origin: preferGroceryOrigin(existing.origin, manual.origin),
      };
      continue;
    }
    merged.push(manual);
    indexByKey.set(key, merged.length - 1);
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function createManualGroceryItem(input: {
  name: string;
  quantity: number;
  unit: string;
  category?: PantryCategory;
}): GroceryListItem {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const trimmedName = input.name.trim();
  const category = input.category ?? inferGroceryCategoryFromName(trimmedName);
  return {
    id: `manual-${Date.now()}-${slug}`,
    ingredientId: `manual-${slug}-${Date.now()}`,
    name: trimmedName,
    category,
    quantity: input.quantity,
    unit: input.unit.trim() || 'each',
    checked: false,
    sourceRecipeIds: [],
    origin: 'manual',
    plannedMealLinks: [],
  };
}
