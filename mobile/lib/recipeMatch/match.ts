import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  KITCHEN_LIST_DEFAULT_MIN_PERCENT,
  RECIPE_MATCHING,
} from '../../config/recipeMatching';
import { FUZZY_MATCH_THRESHOLD, PANTRY_STAPLES } from '../../config/recipeMatchingConfig';
import { fuzzyNameScore, ingredientMatchScore, normalizeIngredientName } from './normalize';
import { findPantryItemsForIngredient, totalPantryQuantityInUnit } from './pantryStock';

export interface MatchedIngredient {
  ingredient: RecipeIngredient;
  matchedPantryItem: PantryItem | null;
  matchReason: 'ingredient_id' | 'fuzzy_name';
  score: number;
}

export interface RecipePantryMatch {
  recipeId: string;
  recipeName: string;
  /** Non-staple ingredients considered for match %. */
  totalIngredients: number;
  matchedCount: number;
  missingCount: number;
  percentMatch: number;
  matched: MatchedIngredient[];
  missing: RecipeIngredient[];
}

export interface PantryMatchIndex {
  byRecipeId: Map<string, RecipePantryMatch>;
  ranked: RecipePantryMatch[];
}

function isConfiguredStaple(name: string, ingredientId: string): boolean {
  const normalized = normalizeIngredientName(name);
  const idNorm = normalizeIngredientName(ingredientId.replace(/-/g, ' '));

  for (const staple of PANTRY_STAPLES) {
    const sNorm = normalizeIngredientName(staple);
    if (normalized === sNorm || idNorm === sNorm) return true;
  }
  return false;
}

function keysOverlap(ingredient: RecipeIngredient, item: PantryItem): boolean {
  const idAsName = item.ingredientId.replace(/-/g, ' ');
  return (
    ingredientMatchScore(ingredient.name, item.name) >= FUZZY_MATCH_THRESHOLD ||
    ingredientMatchScore(ingredient.name, idAsName) >= FUZZY_MATCH_THRESHOLD
  );
}

function findPantryMatch(
  ingredient: RecipeIngredient,
  pantry: PantryItem[],
  usedPantryIds: Set<string>,
): { item: PantryItem | null; reason: MatchedIngredient['matchReason']; score: number } {
  if (pantry.length === 0) {
    return { item: null, reason: 'fuzzy_name', score: 0 };
  }

  for (const item of pantry) {
    if (usedPantryIds.has(item.id)) continue;
    if (item.ingredientId === ingredient.ingredientId) {
      return { item, reason: 'ingredient_id', score: 1 };
    }
    if (keysOverlap(ingredient, item)) {
      const score = Math.max(
        ingredientMatchScore(ingredient.name, item.name),
        ingredientMatchScore(ingredient.name, item.ingredientId.replace(/-/g, ' ')),
        0.98,
      );
      return { item, reason: 'ingredient_id', score };
    }
  }

  let best: PantryItem | null = null;
  let bestScore = 0;
  for (const item of pantry) {
    if (usedPantryIds.has(item.id)) continue;
    const score = Math.max(
      fuzzyNameScore(ingredient.name, item.name),
      fuzzyNameScore(ingredient.name, item.ingredientId.replace(/-/g, ' ')),
      fuzzyNameScore(ingredient.ingredientId.replace(/-/g, ' '), item.name),
    );
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best && bestScore >= FUZZY_MATCH_THRESHOLD) {
    return { item: best, reason: 'fuzzy_name', score: bestScore };
  }

  return { item: null, reason: 'fuzzy_name', score: bestScore };
}

export function scoreRecipeAgainstPantry(recipe: Recipe, pantry: PantryItem[]): RecipePantryMatch {
  const usedPantryIds = new Set<string>();
  const matched: MatchedIngredient[] = [];
  const missing: RecipeIngredient[] = [];
  let scorableCount = 0;

  for (const ingredient of recipe.ingredients) {
    if (isConfiguredStaple(ingredient.name, ingredient.ingredientId)) {
      continue;
    }
    scorableCount += 1;

    const result = findPantryMatch(ingredient, pantry, usedPantryIds);
    if (result.item) {
      const pantryMatches = findPantryItemsForIngredient(ingredient, pantry);
      const have = totalPantryQuantityInUnit(pantryMatches, ingredient.unit);
      if (have !== null && have < ingredient.quantity) {
        const missingQty = Math.round((ingredient.quantity - have) * 100) / 100;
        missing.push({ ...ingredient, quantity: missingQty });
      } else {
        usedPantryIds.add(result.item.id);
        matched.push({
          ingredient,
          matchedPantryItem: result.item,
          matchReason: result.reason,
          score: result.score,
        });
      }
    } else {
      missing.push(ingredient);
    }
  }

  const matchedCount = matched.length;
  const missingCount = missing.length;
  const percentMatch =
    scorableCount > 0 && pantry.length > 0
      ? Math.round((matchedCount / scorableCount) * 100)
      : 0;

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredients: scorableCount,
    matchedCount,
    missingCount,
    percentMatch,
    matched,
    missing,
  };
}

export function compareRecipePantryMatches(a: RecipePantryMatch, b: RecipePantryMatch): number {
  if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
  if (b.percentMatch !== a.percentMatch) return b.percentMatch - a.percentMatch;
  if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
  return a.recipeName.localeCompare(b.recipeName);
}

export function buildPantryMatchIndex(recipes: Recipe[], pantry: PantryItem[]): PantryMatchIndex {
  if (pantry.length === 0) {
    const empty = recipes.map((recipe) => scoreRecipeAgainstPantry(recipe, pantry));
    const byRecipeId = new Map(empty.map((m) => [m.recipeId, m]));
    return { byRecipeId, ranked: [] };
  }

  const ranked = recipes.map((recipe) => scoreRecipeAgainstPantry(recipe, pantry));
  ranked.sort(compareRecipePantryMatches);
  const byRecipeId = new Map(ranked.map((m) => [m.recipeId, m]));
  return { byRecipeId, ranked };
}

export type RecipePantryFilterMode = 'all' | 'have_all' | 'missing_1_2' | 'best_match';

export interface FilterRankedMatchesOptions {
  /** Minimum non-staple pantry ingredient matches (default from recipeMatching config). */
  minMatchedCount?: number;
  /** When 0, returns no recipes (empty pantry). */
  pantryItemCount?: number;
}

export function filterRankedMatches(
  ranked: RecipePantryMatch[],
  mode: RecipePantryFilterMode,
  minPercent: number,
  options?: FilterRankedMatchesOptions,
): RecipePantryMatch[] {
  if (options?.pantryItemCount === 0) return [];

  const minMatched = options?.minMatchedCount ?? DEFAULT_MIN_MATCHED_INGREDIENTS;
  return ranked.filter((m) => {
    if (m.matchedCount < minMatched) return false;
    if (m.percentMatch < minPercent) return false;
    if (mode === 'have_all') return m.missingCount === 0;
    if (mode === 'missing_1_2') return m.missingCount >= 1 && m.missingCount <= 2;
    return true;
  });
}

export function topPantryRecipeRecommendations(
  recipes: Recipe[],
  pantry: PantryItem[],
  limit = RECIPE_MATCHING.homeRecommendationsLimit,
): RecipePantryMatch[] {
  if (pantry.length === 0) return [];
  const { ranked } = buildPantryMatchIndex(recipes, pantry);
  return filterRankedMatches(ranked, 'all', KITCHEN_LIST_DEFAULT_MIN_PERCENT, {
    minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
    pantryItemCount: pantry.length,
  }).slice(0, limit);
}
