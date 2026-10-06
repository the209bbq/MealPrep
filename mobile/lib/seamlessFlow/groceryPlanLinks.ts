import type {
  GroceryListItem,
  GroceryPlannedMealLink,
  PantryItem,
  RecipeIngredient,
} from '../../types/mealprep';
import { normalizeIngredientName } from '../recipeMatch/normalize';
import { mergeGroceryWithMissing } from '../recipeMatch/groceryFromMissing';

function mergePlannedLinks(
  existing: GroceryPlannedMealLink[],
  link: GroceryPlannedMealLink,
): GroceryPlannedMealLink[] {
  if (existing.some((row) => row.mealPlanItemId === link.mealPlanItemId)) {
    return existing;
  }
  return [...existing, link];
}

function missingKeys(missing: RecipeIngredient[]): Set<string> {
  return new Set(missing.map((ing) => `${normalizeIngredientName(ing.name)}::${ing.unit.trim().toLowerCase()}`));
}

function rowTouchesMissing(row: GroceryListItem, keys: Set<string>): boolean {
  const key = `${normalizeIngredientName(row.name)}::${row.unit.trim().toLowerCase()}`;
  return keys.has(key);
}

export function mergeMissingIntoGroceryWithPlanLink(input: {
  missing: RecipeIngredient[];
  recipeId: string;
  pantry: PantryItem[];
  previous: GroceryListItem[];
  link: GroceryPlannedMealLink;
  groceryDismissals?: Set<string>;
}): { items: GroceryListItem[]; added: GroceryListItem[] } {
  const base = mergeGroceryWithMissing(
    input.previous,
    input.missing,
    input.recipeId,
    input.pantry,
    { groceryDismissals: input.groceryDismissals },
  );
  const keys = missingKeys(input.missing);

  const attachLink = (row: GroceryListItem): GroceryListItem => {
    if (!row.sourceRecipeIds.includes(input.recipeId)) return row;
    if (!rowTouchesMissing(row, keys)) return row;
    return {
      ...row,
      origin: 'plan',
      plannedMealLinks: mergePlannedLinks(row.plannedMealLinks, input.link),
    };
  };

  return {
    items: base.items.map(attachLink),
    added: base.added.map(attachLink),
  };
}
