import type { GroceryListItem, PantryCategory, PantryItem, RecipeIngredient } from '../../types/mealprep';
import { pantryCategoryForImportedIngredient } from '../recipeDiscovery/mapToAppRecipe';
import { createManualGroceryItem } from '../grocery';
import { convertQuantity, unitsAreConvertible } from '../units/conversion';
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

function ingredientMergeKey(ingredient: RecipeIngredient): string {
  return ingredient.ingredientId || normalizeIngredientName(ingredient.name);
}

function categoryForMissingIngredient(ingredient: RecipeIngredient, pantry: PantryItem[]): PantryCategory {
  const pantryMatch = pantry.find(
    (item) =>
      item.ingredientId === ingredient.ingredientId ||
      normalizeIngredientName(item.name) === normalizeIngredientName(ingredient.name),
  );
  if (pantryMatch) return pantryMatch.category;
  return pantryCategoryForImportedIngredient(ingredient.name, ingredient.notes);
}

function findMergeableGroceryIndex(list: GroceryListItem[], ingredient: RecipeIngredient): number {
  const mergeKey = ingredientMergeKey(ingredient);
  return list.findIndex((row) => {
    const rowKey = row.ingredientId || normalizeIngredientName(row.name);
    if (rowKey !== mergeKey) return false;
    if (groceryDedupeKey(row.name, row.unit) === groceryDedupeKey(ingredient.name, ingredient.unit)) {
      return true;
    }
    return unitsAreConvertible(row.unit, ingredient.unit);
  });
}

function mergedQuantity(existing: GroceryListItem, ingredient: RecipeIngredient): number {
  if (groceryDedupeKey(existing.name, existing.unit) === groceryDedupeKey(ingredient.name, ingredient.unit)) {
    return roundQty(existing.quantity + ingredient.quantity);
  }
  const converted = convertQuantity(ingredient.quantity, ingredient.unit, existing.unit);
  if (converted === null) {
    return roundQty(existing.quantity + ingredient.quantity);
  }
  return roundQty(existing.quantity + converted);
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
    if (findMergeableGroceryIndex(previous, ingredient) >= 0) continue;
    if (findMergeableGroceryIndex(added, ingredient) >= 0) continue;

    const category = categoryForMissingIngredient(ingredient, pantry);
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
  const merged = [...previous];
  const added: GroceryListItem[] = [];

  for (const ingredient of missing) {
    const idx = findMergeableGroceryIndex(merged, ingredient);
    if (idx >= 0) {
      const existing = merged[idx];
      merged[idx] = {
        ...existing,
        quantity: mergedQuantity(existing, ingredient),
        sourceRecipeIds: existing.sourceRecipeIds.includes(recipeId)
          ? existing.sourceRecipeIds
          : [...existing.sourceRecipeIds, recipeId],
      };
      continue;
    }

    const category = categoryForMissingIngredient(ingredient, pantry);
    const item: GroceryListItem = {
      id: `groc-${ingredient.ingredientId}::${ingredient.unit}`,
      ingredientId: ingredient.ingredientId,
      name: ingredient.name,
      category,
      quantity: roundQty(ingredient.quantity),
      unit: ingredient.unit,
      checked: false,
      sourceRecipeIds: [recipeId],
    };
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
