import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import { RECIPE_MATCHING, filterDefaultKitchenMatches } from '../../config/recipeMatching';
import { FUZZY_MATCH_THRESHOLD, PANTRY_STAPLES } from './config';
import { expandSynonymKeys, fuzzyNameScore, normalizeIngredientName, tokenizeIngredientName } from './normalize';

export interface MatchedIngredient {
  ingredient: RecipeIngredient;
  matchedPantryItem: PantryItem | null;
  matchReason: 'ingredient_id' | 'fuzzy_name' | 'staple';
  score: number;
}

export interface RecipePantryMatch {
  recipeId: string;
  recipeName: string;
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
  const tokenKeys = new Set([
    ...tokenizeIngredientName(name),
    ...tokenizeIngredientName(ingredientId.replace(/-/g, ' ')),
  ]);
  for (const staple of PANTRY_STAPLES) {
    const sNorm = normalizeIngredientName(staple);
    const sTokens = tokenizeIngredientName(staple);
    if (normalized === sNorm || idNorm === sNorm.replace(/\s+/g, '-')) return true;
    if (normalized.includes(sNorm) || idNorm.includes(sNorm.replace(/\s+/g, '-'))) return true;
    if (sTokens.every((t) => tokenKeys.has(t))) return true;
  }
  return false;
}

function pantryLookupKeys(item: PantryItem): string[] {
  const keys = new Set<string>();
  keys.add(item.ingredientId);
  keys.add(normalizeIngredientName(item.ingredientId.replace(/-/g, ' ')));
  for (const k of expandSynonymKeys(item.name)) keys.add(k);
  for (const k of expandSynonymKeys(item.ingredientId.replace(/-/g, ' '))) keys.add(k);
  return [...keys];
}

function ingredientLookupKeys(ing: RecipeIngredient): string[] {
  const keys = new Set<string>();
  keys.add(ing.ingredientId);
  keys.add(normalizeIngredientName(ing.ingredientId.replace(/-/g, ' ')));
  for (const k of expandSynonymKeys(ing.name)) keys.add(k);
  return [...keys];
}

function findPantryMatch(
  ingredient: RecipeIngredient,
  pantry: PantryItem[],
  usedPantryIds: Set<string>,
): { item: PantryItem | null; reason: MatchedIngredient['matchReason']; score: number } {
  if (isConfiguredStaple(ingredient.name, ingredient.ingredientId)) {
    return { item: null, reason: 'staple', score: 1 };
  }

  const ingKeys = ingredientLookupKeys(ingredient);
  for (const item of pantry) {
    if (usedPantryIds.has(item.id)) continue;
    if (item.ingredientId === ingredient.ingredientId) {
      return { item, reason: 'ingredient_id', score: 1 };
    }
    const pantryKeys = pantryLookupKeys(item);
    for (const ik of ingKeys) {
      for (const pk of pantryKeys) {
        if (ik && pk && (ik === pk || ik.includes(pk) || pk.includes(ik))) {
          return { item, reason: 'ingredient_id', score: 0.98 };
        }
      }
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

  for (const ingredient of recipe.ingredients) {
    const result = findPantryMatch(ingredient, pantry, usedPantryIds);
    if (result.item || result.reason === 'staple') {
      if (result.item) usedPantryIds.add(result.item.id);
      matched.push({
        ingredient,
        matchedPantryItem: result.item,
        matchReason: result.reason,
        score: result.score,
      });
    } else {
      missing.push(ingredient);
    }
  }

  const totalIngredients = recipe.ingredients.length;
  const matchedCount = matched.length;
  const missingCount = missing.length;
  const percentMatch =
    totalIngredients > 0 ? Math.round((matchedCount / totalIngredients) * 100) : 0;

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredients,
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
  const ranked = recipes.map((recipe) => scoreRecipeAgainstPantry(recipe, pantry));
  ranked.sort(compareRecipePantryMatches);
  const byRecipeId = new Map(ranked.map((m) => [m.recipeId, m]));
  return { byRecipeId, ranked };
}

export type RecipePantryFilterMode = 'all' | 'have_all' | 'missing_1_2' | 'best_match';

export interface FilterRankedMatchesOptions {
  /** Exclude recipes with no pantry ingredient matches (non-staple). */
  minMatchedCount?: number;
}

export function filterRankedMatches(
  ranked: RecipePantryMatch[],
  mode: RecipePantryFilterMode,
  minPercent: number,
  options?: FilterRankedMatchesOptions,
): RecipePantryMatch[] {
  const minMatched = options?.minMatchedCount ?? 0;
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
  const { ranked } = buildPantryMatchIndex(recipes, pantry);
  if (pantry.length === 0) return [];
  return filterDefaultKitchenMatches(ranked).slice(0, limit);
}
