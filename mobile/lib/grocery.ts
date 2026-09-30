import type { GroceryListItem, PantryItem, Recipe } from '../types/mealprep';

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

  return list.sort((a, b) => a.name.localeCompare(b.name));
}
