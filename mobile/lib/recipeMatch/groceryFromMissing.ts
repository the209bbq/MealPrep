import type { GroceryListItem, PantryCategory, PantryItem, RecipeIngredient } from '../../types/mealprep';
import { createManualGroceryItem } from '../grocery';

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

function slugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'ingredient';
}

export function groceryItemsFromMissingIngredients(
  missing: RecipeIngredient[],
  recipeId: string,
  pantry: PantryItem[],
  previous: GroceryListItem[],
): GroceryListItem[] {
  const added: GroceryListItem[] = [];
  const existingKeys = new Set(previous.map((item) => `${item.ingredientId}::${item.unit}`));

  for (const ingredient of missing) {
    const key = `${ingredient.ingredientId}::${ingredient.unit}`;
    if (existingKeys.has(key)) continue;

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
    existingKeys.add(key);
  }

  return added;
}

export function mergeGroceryWithMissing(
  previous: GroceryListItem[],
  missing: RecipeIngredient[],
  recipeId: string,
  pantry: PantryItem[],
): GroceryListItem[] {
  const newItems = groceryItemsFromMissingIngredients(missing, recipeId, pantry, previous);
  if (newItems.length === 0) return previous;

  const merged = [...previous];
  for (const item of newItems) {
    const idx = merged.findIndex(
      (row) => row.ingredientId === item.ingredientId && row.unit === item.unit,
    );
    if (idx >= 0) {
      const existing = merged[idx];
      merged[idx] = {
        ...existing,
        quantity: roundQty(existing.quantity + item.quantity),
        sourceRecipeIds: existing.sourceRecipeIds.includes(recipeId)
          ? existing.sourceRecipeIds
          : [...existing.sourceRecipeIds, recipeId],
      };
    } else {
      merged.push(item);
    }
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function addMissingRecipeIngredientsToGrocery(input: {
  missing: RecipeIngredient[];
  recipeId: string;
  pantry: PantryItem[];
  previous: GroceryListItem[];
}): GroceryListItem[] {
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
