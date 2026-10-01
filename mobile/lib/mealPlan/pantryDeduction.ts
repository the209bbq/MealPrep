import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import type { MatchedIngredient, RecipePantryMatch } from '../recipeMatch/match';

export interface PantryDeductionLine {
  pantryItemId: string;
  ingredient: RecipeIngredient;
  deductQuantity: number;
  previous: PantryItem;
}

export interface PantryDeductionResult {
  lines: PantryDeductionLine[];
  nextPantry: PantryItem[];
}

function unitsCompatible(pantryUnit: string, recipeUnit: string): boolean {
  const a = pantryUnit.trim().toLowerCase();
  const b = recipeUnit.trim().toLowerCase();
  if (!a || !b) return true;
  if (a === b) return true;
  if (a === 'each' || b === 'each') return true;
  return false;
}

function recipeScale(recipe: Recipe, servingOverrides: Record<string, number>): number {
  const servings = servingOverrides[recipe.id] ?? recipe.servings;
  return recipe.servings > 0 ? servings / recipe.servings : 1;
}

export function buildPantryDeductionLines(
  match: RecipePantryMatch,
  recipe: Recipe,
  servingOverrides: Record<string, number>,
  excludedPantryItemIds: Set<string>,
): PantryDeductionLine[] {
  const scale = recipeScale(recipe, servingOverrides);
  const lines: PantryDeductionLine[] = [];

  for (const row of match.matched) {
    const pantryItem = row.matchedPantryItem;
    if (!pantryItem) continue;
    if (excludedPantryItemIds.has(pantryItem.id)) continue;

    const deductQuantity = roundQty(row.ingredient.quantity * scale);
    if (deductQuantity <= 0) continue;

    lines.push({
      pantryItemId: pantryItem.id,
      ingredient: row.ingredient,
      deductQuantity,
      previous: { ...pantryItem },
    });
  }

  return lines;
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100;
}

export function applyPantryDeductions(pantry: PantryItem[], lines: PantryDeductionLine[]): PantryDeductionResult {
  const removedIds = new Set<string>();
  const updates = new Map<string, PantryItem>();

  for (const line of lines) {
    const current = updates.get(line.pantryItemId) ?? pantry.find((item) => item.id === line.pantryItemId);
    if (!current) continue;

    const tracksQuantity =
      current.quantity > 0 && unitsCompatible(current.unit, line.ingredient.unit);

    if (!tracksQuantity) {
      removedIds.add(line.pantryItemId);
      updates.delete(line.pantryItemId);
      continue;
    }

    const nextQty = roundQty(current.quantity - line.deductQuantity);
    if (nextQty <= 0) {
      removedIds.add(line.pantryItemId);
      updates.delete(line.pantryItemId);
    } else {
      updates.set(line.pantryItemId, {
        ...current,
        quantity: nextQty,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const nextPantry = pantry
    .filter((item) => !removedIds.has(item.id))
    .map((item) => updates.get(item.id) ?? item);

  return { lines, nextPantry };
}

export function restorePantryFromDeductions(pantry: PantryItem[], lines: PantryDeductionLine[]): PantryItem[] {
  const byId = new Map(pantry.map((item) => [item.id, item]));

  for (const line of lines) {
    byId.set(line.previous.id, { ...line.previous });
  }

  const ids = new Set([...pantry.map((p) => p.id), ...lines.map((l) => l.previous.id)]);
  return [...ids].map((id) => byId.get(id)).filter((item): item is PantryItem => Boolean(item));
}

export function matchedRowsForReview(match: RecipePantryMatch): MatchedIngredient[] {
  return match.matched.filter((row) => row.matchedPantryItem);
}
