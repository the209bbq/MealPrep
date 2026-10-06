import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { RecipePantryMatch } from '../recipeMatch';
import type { PantryItem, Recipe } from '../../types/mealprep';
import { compareRecipePantryMatches, scoreRecipeAgainstPantry } from '../recipeMatch';
import { mealDbMealPageUrl } from '../../config/mealdb';
import { mealDbMealToAppRecipe } from './normalize';
import { mealDbRecipeId } from './slug';
import type { MealDbFilterMealSummary, MealDbMealDetail } from './types';

export function pendingPantryMatchForRecipe(recipe: Recipe): RecipePantryMatch {
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredients: 0,
    matchedCount: 0,
    missingCount: 0,
    percentMatch: 0,
    matched: [],
    missing: [],
  };
}

export function mealDbStubRecipeFromFilterSummary(
  summary: MealDbFilterMealSummary,
  category: MealDbCatalogCategory,
): Recipe {
  const idMeal = summary.idMeal.trim();
  return {
    id: mealDbRecipeId(idMeal),
    name: summary.strMeal.trim() || 'Recipe',
    tag: category,
    description: `${category} recipe from TheMealDB.`,
    servings: 4,
    minutes: 45,
    ingredients: [],
    steps: [],
    isMaster: true,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    createdAt: new Date(0).toISOString(),
    imageUrl: summary.strMealThumb?.trim() || null,
    sourceUrl: mealDbMealPageUrl(idMeal),
    sourceType: 'themealdb',
    sourceTitle: 'TheMealDB',
    prepMinutes: null,
    cookMinutes: null,
  };
}

export function recipesTabRowsFromFilterSummaries(
  summaries: readonly MealDbFilterMealSummary[],
  category: MealDbCatalogCategory,
): RecipesTabRow[] {
  return summaries.map((summary) => {
    const recipe = mealDbStubRecipeFromFilterSummary(summary, category);
    return {
      kind: 'kitchen',
      recipe,
      match: pendingPantryMatchForRecipe(recipe),
      pantryMatchPending: true,
    };
  });
}

export function mergeMealDetailIntoCategoryRows(
  rows: RecipesTabRow[],
  meal: MealDbMealDetail,
  pantry: PantryItem[],
): RecipesTabRow[] {
  const recipe = mealDbMealToAppRecipe(meal);
  let found = false;
  const next = rows.map((row) => {
    if (row.kind !== 'kitchen' || row.recipe.id !== recipe.id) return row;
    found = true;
    return {
      kind: 'kitchen' as const,
      recipe,
      match: scoreRecipeAgainstPantry(recipe, pantry),
      pantryMatchPending: false,
      pantryMatchFailed: false,
    };
  });
  if (!found) {
    next.push({
      kind: 'kitchen',
      recipe,
      match: scoreRecipeAgainstPantry(recipe, pantry),
      pantryMatchPending: false,
      pantryMatchFailed: false,
    });
  }
  next.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return next;
}

export function markKitchenRowLookupFailed(rows: RecipesTabRow[], idMeal: string): RecipesTabRow[] {
  const recipeId = mealDbRecipeId(idMeal.trim());
  return rows.map((row) => {
    if (row.kind !== 'kitchen' || row.recipe.id !== recipeId) return row;
    return {
      ...row,
      pantryMatchPending: false,
      pantryMatchFailed: true,
    };
  });
}

export function rowsFromMealDetails(
  meals: readonly MealDbMealDetail[],
  pantry: PantryItem[],
): RecipesTabRow[] {
  const rows: RecipesTabRow[] = meals.map((meal) => {
    const recipe = mealDbMealToAppRecipe(meal);
    return {
      kind: 'kitchen',
      recipe,
      match: scoreRecipeAgainstPantry(recipe, pantry),
      pantryMatchPending: false,
    };
  });
  rows.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return rows;
}
