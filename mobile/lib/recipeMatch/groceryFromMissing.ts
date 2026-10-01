import type { GroceryListItem, PantryCategory, PantryItem, RecipeIngredient } from '../../types/mealprep';
import { createManualGroceryItem } from '../grocery';
import { normalizeIngredientName } from './normalize';

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

function slugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'ingredient';
}

/** Dedupe key for grocery rows: normalized ingredient name + unit. */
export function groceryDedupeKey(name: string, unit: string): string {
  return `${normalizeIngredientName(name)}::${unit.trim().toLowerCase()}`;
}

function findExistingGroceryIndex(list: GroceryListItem[], ingredient: RecipeIngredient): number {
  const key = groceryDedupeKey(ingredient.name, ingredient.unit);
  return list.findIndex((row) => groceryDedupeKey(row.name, row.unit) === key);
}

export interface MergeMissingGroceryResult {
  items: GroceryListItem[];
  added: GroceryListItem[];
}

export function groceryItemsFromMissingIngredients(
  missing: RecipeIngredient[],
  recipeId: string,
  pantry: PantryItem[],
  previous: GroceryListItem[],
): GroceryListItem[] {
  const added: GroceryListItem[] = [];

  for (const ingredient of missing) {
    if (findExistingGroceryIndex(previous, ingredient) >= 0) continue;
    if (findExistingGroceryIndex(added, ingredient) >= 0) continue;

    const pantryMatch = pantry.find((item) => item.ingredientId === ingredient.ingredientId);
    const category: PantryCategory = pantryMatch?.category ?? 'dry_goods';
    const id = `groc-${ingredient.ingredientId}::${ingredient.unit}`;

    added.push({
      id,
      ingredientId: ingredient.ingredientId,
      name: ingredient.name,
      category,
      quantity: roundQty(ingredient.quantity),
      unit: ingredient.unit,
      checked: false,
      sourceRecipeIds: [recipeId],
    });
  }

  return added;
}

export function mergeGroceryWithMissing(
  previous: GroceryListItem[],
  missing: RecipeIngredient[],
  recipeId: string,
  pantry: PantryItem[],
): MergeMissingGroceryResult {
  const newItems = groceryItemsFromMissingIngredients(missing, recipeId, pantry, previous);
  if (newItems.length === 0) {
    return { items: previous, added: [] };
  }

  const merged = [...previous];
  const added: GroceryListItem[] = [];

  for (const item of newItems) {
    const idx = findExistingGroceryIndex(merged, item);
    if (idx >= 0) {
      const existing = merged[idx];
      merged[idx] = {
        ...existing,
        quantity: roundQty(existing.quantity + item.quantity),
        sourceRecipeIds: existing.sourceRecipeIds.includes(recipeId)
          ? existing.sourceRecipeIds
          : [...existing.sourceRecipeIds, recipeId],
      };
      continue;
    }

    merged.push(item);
    added.push(item);
  }

  return {
    items: merged.sort((a, b) => a.name.localeCompare(b.name)),
    added,
  };
}

export function addMissingRecipeIngredientsToGrocery(input: {
  missing: RecipeIngredient[];
  recipeId: string;
  pantry: PantryItem[];
  previous: GroceryListItem[];
}): MergeMissingGroceryResult {
  return mergeGroceryWithMissing(input.previous, input.missing, input.recipeId, input.pantry);
}

/** Manual one-off grocery row when ingredient id is unknown. */
export function groceryItemForIngredientName(input: {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  recipeId: string;
}): GroceryListItem {
  const manual = createManualGroceryItem({
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    category: input.category,
  });
  return {
    ...manual,
    sourceRecipeIds: [input.recipeId],
    ingredientId: slugFromName(input.name),
  };
}

export function removeGroceryItemsByIds(list: GroceryListItem[], ids: string[]): GroceryListItem[] {
  if (ids.length === 0) return list;
  const remove = new Set(ids);
  return list.filter((item) => !remove.has(item.id));
}
