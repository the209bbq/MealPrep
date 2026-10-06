import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { PantryItem } from '../../types/mealprep';
import {
  compareRecipePantryMatches,
  scoreRecipeAgainstPantry,
} from '../recipeMatch';
import { getPantryMatchContext } from '../recipeMatch/pantryMatchContext';
import { mealDbMealToAppRecipe } from './normalize';
import type { MealDbMealDetail } from './types';

export function insertKitchenRowByPantryMatch(
  rows: readonly RecipesTabRow[],
  row: RecipesTabRow,
): RecipesTabRow[] {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const candidate = rows[mid]!;
    if (compareRecipePantryMatches(row.match, candidate.match) < 0) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  const next = rows.slice();
  next.splice(lo, 0, row);
  return next;
}

/** Score meals once and keep rows sorted without re-scanning the full list on each arrival. */
export class MealDbCatalogRowBuilder {
  private rows: RecipesTabRow[] = [];
  private readonly pantry: PantryItem[];
  private readonly context: ReturnType<typeof getPantryMatchContext>;

  constructor(pantry: PantryItem[]) {
    this.pantry = pantry;
    this.context = getPantryMatchContext(pantry);
  }

  getRows(): RecipesTabRow[] {
    return this.rows;
  }

  appendMeal(meal: MealDbMealDetail): RecipesTabRow[] {
    const recipe = mealDbMealToAppRecipe(meal);
    const row: RecipesTabRow = {
      kind: 'kitchen',
      recipe,
      match: scoreRecipeAgainstPantry(recipe, this.pantry, this.context),
    };
    this.rows = insertKitchenRowByPantryMatch(this.rows, row);
    return this.rows;
  }
}
