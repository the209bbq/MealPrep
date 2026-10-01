import { CATEGORY_LABELS } from '../config/appConfig';
import type { GroceryListItem, PantryCategory, PantryItem, Recipe } from '../types/mealprep';
import { isGroceryDismissed } from './grocery/dismissals';
import {
  findPantryItemsForIngredient,
  totalPantryQuantityInUnit,
} from './recipeMatch/pantryStock';
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

  const manualItems = previous.filter((item) => isManualGroceryItem(item));

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
