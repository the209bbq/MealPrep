import { CATEGORY_LABELS } from '../config/appConfig';
import type { GroceryListItem, PantryCategory, PantryItem, Recipe } from '../types/mealprep';

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
  return item.ingredientId.startsWith('manual-');
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

export function buildGroceryList(
  recipes: Recipe[],
  selectedRecipeIds: string[],
  pantry: PantryItem[],
  servingOverrides: Record<string, number>,
  previous: GroceryListItem[],
): GroceryListItem[] {
  const needed = new Map<string, { name: string; unit: string; quantity: number; recipeIds: string[]; category: GroceryListItem['category'] }>();

  for (const recipe of recipes) {
    if (!selectedRecipeIds.includes(recipe.id)) continue;
    const servings = servingOverrides[recipe.id] ?? recipe.servings;
    const scale = recipe.servings > 0 ? servings / recipe.servings : 1;
    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.ingredientId}::${ingredient.unit}`;
      const current = needed.get(key);
      const qty = ingredient.quantity * scale;
      if (current) {
        current.quantity += qty;
        if (!current.recipeIds.includes(recipe.id)) current.recipeIds.push(recipe.id);
      } else {
        const pantryMatch = pantry.find((item) => item.ingredientId === ingredient.ingredientId);
        needed.set(key, {
          name: ingredient.name,
          unit: ingredient.unit,
          quantity: qty,
          recipeIds: [recipe.id],
          category: pantryMatch?.category ?? 'dry_goods',
        });
      }
    }
  }

  const pantryByIngredient = new Map<string, number>();
  for (const item of pantry) {
    pantryByIngredient.set(item.ingredientId, (pantryByIngredient.get(item.ingredientId) ?? 0) + item.quantity);
  }

  const checked = new Map(previous.map((item) => [item.ingredientId + '::' + item.unit, item.checked]));

  const manualItems = previous.filter((item) => isManualGroceryItem(item));

  const list: GroceryListItem[] = [];
  for (const [key, value] of needed) {
    const ingredientId = key.split('::')[0] ?? key;
    const have = pantryByIngredient.get(ingredientId) ?? 0;
    const remaining = roundQty(Math.max(0, value.quantity - have));
    if (remaining <= 0) continue;
    list.push({
      id: `groc-${key}`,
      ingredientId,
      name: value.name,
      category: value.category,
      quantity: remaining,
      unit: value.unit,
      checked: checked.get(key) ?? false,
      sourceRecipeIds: value.recipeIds,
    });
  }

  const recipeItems = list.sort((a, b) => a.name.localeCompare(b.name));
  const manuals = manualItems.sort((a, b) => a.name.localeCompare(b.name));
  return [...recipeItems, ...manuals];
}

export function createManualGroceryItem(input: {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
}): GroceryListItem {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return {
    id: `manual-${Date.now()}-${slug}`,
    ingredientId: `manual-${slug}-${Date.now()}`,
    name: input.name.trim(),
    category: input.category,
    quantity: input.quantity,
    unit: input.unit.trim() || 'each',
    checked: false,
    sourceRecipeIds: [],
  };
}
