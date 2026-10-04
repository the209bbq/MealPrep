import { CATEGORY_LABELS } from '../config/appConfig';
import type { GroceryListItem, PantryCategory, PantryItem, Recipe } from '../types/mealprep';
import { inferGroceryCategoryFromName } from './grocery/categorize';
import { isGroceryDismissed, isGroceryManualLineDismissed } from './grocery/dismissals';
import {
  findPantryItemsForIngredient,
  totalPantryQuantityInUnit,
} from './recipeMatch/pantryStock';
import { isGroceryOriginPinned, preferGroceryOrigin } from './grocery/origin';
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

  const checked = new Map(previous.map((item) => [normalizeIngredientName(item.name) + '::' + item.unit.trim().toLowerCase(), item.checked]));

  const pinnedItems = previous.filter(
    (item) =>
      isGroceryOriginPinned(item.origin) &&
      !isGroceryManualLineDismissed(dismissals, item.name, item.unit),
  );

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
    const have = totalPantryQuantityInUnit(pantryMatches, value.unit);
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
      merged[existingIndex] = {
        ...existing,
        quantity: roundQty(existing.quantity + manual.quantity),
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
  };
}
