import { isIngredientUnmeasurableForDeduction } from './deductionIngredient';
import { resolveRecipeServings } from '../profile/servings';
import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import type { MatchedIngredient, RecipePantryMatch } from '../recipeMatch/match';
import { unitKind } from '../units/conversion';
import {
  convertIngredientQuantity,
  ingredientUnitsConvertible,
} from '../units/ingredientUnitBridge';

export { isIngredientUnmeasurableForDeduction } from './deductionIngredient';

export function isPantryCatalogStapleRow(item: PantryItem): boolean {
  return item.ingredientId.startsWith('staple-');
}

export interface PantryDeductionLine {
  pantryItemId: string;
  ingredient: RecipeIngredient;
  deductQuantity: number;
  previous: PantryItem;
  /** When false, incompatible units — pantry row is left unchanged unless user removes manually. */
  quantityApplied: boolean;
}

export interface PantryDeductionResult {
  lines: PantryDeductionLine[];
  nextPantry: PantryItem[];
}

/**
 * Units counted in whole items (eggs, onions, cloves, cans...). Scaled deductions for these
 * round to whole numbers so the pantry never ends up with ½ an egg (FK3-2).
 */
const WHOLE_COUNT_UNITS = new Set([
  '',
  'each',
  'ea',
  'piece',
  'pieces',
  'item',
  'items',
  'whole',
  'large',
  'medium',
  'small',
  'egg',
  'eggs',
  'clove',
  'cloves',
  'head',
  'heads',
  'can',
  'cans',
  'jar',
  'jars',
  'bunch',
  'bunches',
  'slice',
  'slices',
  'stalk',
  'stalks',
]);

export function isWholeCountIngredientUnit(unit: string | null | undefined): boolean {
  return WHOLE_COUNT_UNITS.has((unit ?? '').trim().toLowerCase());
}

/**
 * Amount the Made-it flow deducts for one ingredient: scaled by household servings, with
 * whole-count units rounded to whole numbers (minimum 1 when the recipe uses any).
 * The review sheet shows this exact value, so review and deduction always match.
 */
export function scaledPantryDeductionQuantity(ingredient: RecipeIngredient, scale: number): number {
  const raw = ingredient.quantity * scale;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (isWholeCountIngredientUnit(ingredient.unit)) {
    return Math.max(1, Math.round(raw));
  }
  return roundQty(raw);
}

function recipeScale(
  recipe: Recipe,
  servingOverrides: Record<string, number>,
  householdSize?: number,
): number {
  const servings = resolveRecipeServings(recipe, servingOverrides, householdSize);
  return recipe.servings > 0 ? servings / recipe.servings : 1;
}

export function buildPantryDeductionLines(
  match: RecipePantryMatch,
  recipe: Recipe,
  servingOverrides: Record<string, number>,
  excludedPantryItemIds: Set<string>,
  householdSize?: number,
): PantryDeductionLine[] {
  const scale = recipeScale(recipe, servingOverrides, householdSize);
  const lines: PantryDeductionLine[] = [];

  for (const row of match.matched) {
    const pantryItem = row.matchedPantryItem;
    if (!pantryItem) continue;
    if (excludedPantryItemIds.has(pantryItem.id)) continue;
    if (isIngredientUnmeasurableForDeduction(row.ingredient)) continue;

    const deductQuantity = scaledPantryDeductionQuantity(row.ingredient, scale);
    if (deductQuantity <= 0) continue;

    const convertible = ingredientUnitsConvertible(
      row.ingredient.name,
      pantryItem.unit,
      row.ingredient.unit,
    );
    if (!convertible) continue;
    lines.push({
      pantryItemId: pantryItem.id,
      ingredient: row.ingredient,
      deductQuantity,
      previous: { ...pantryItem },
      quantityApplied: convertible,
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
    if (!line.quantityApplied) continue;

    const current = updates.get(line.pantryItemId) ?? pantry.find((item) => item.id === line.pantryItemId);
    if (!current) continue;

    const convertedDeduct = convertIngredientQuantity(
      line.deductQuantity,
      line.ingredient.unit,
      current.unit,
      line.ingredient.name,
    );

    if (convertedDeduct === null) {
      continue;
    }

    const pantryKind = unitKind(current.unit);
    const tracksQuantity = current.quantity > 0 && pantryKind !== null;

    if (!tracksQuantity) {
      continue;
    }

    const nextQty = roundQty(current.quantity - convertedDeduct);
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

export type MealMadeReviewRow = MatchedIngredient & {
  /** Exactly what Confirm will deduct, in the ingredient's unit. */
  deductQuantity: number;
};

/** Review rows with the same scaled/rounded amounts `buildPantryDeductionLines` will deduct. */
export function mealMadeReviewRowsWithDeductions(
  match: RecipePantryMatch,
  recipe: Recipe,
  servingOverrides: Record<string, number>,
  householdSize?: number,
): MealMadeReviewRow[] {
  const lines = buildPantryDeductionLines(match, recipe, servingOverrides, new Set(), householdSize);
  const byPantryId = new Map(lines.map((line) => [line.pantryItemId, line.deductQuantity]));
  return matchedRowsForReview(match)
    .filter((row) => byPantryId.has(row.matchedPantryItem!.id))
    .map((row) => ({ ...row, deductQuantity: byPantryId.get(row.matchedPantryItem!.id)! }));
}

export function matchedRowsForReview(match: RecipePantryMatch): MatchedIngredient[] {
  return match.matched.filter((row) => {
    const pantryItem = row.matchedPantryItem;
    if (!pantryItem) return false;
    if (isIngredientUnmeasurableForDeduction(row.ingredient)) return false;
    return ingredientUnitsConvertible(
      row.ingredient.name,
      pantryItem.unit,
      row.ingredient.unit,
    );
  });
}
