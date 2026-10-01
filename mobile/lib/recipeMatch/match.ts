import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  DEFAULT_MIN_PANTRY_MATCH_PERCENT,
} from '../../config/recipeMatching';
import { FUZZY_MATCH_THRESHOLD, PANTRY_STAPLES } from './config';
import { expandSynonymKeys, fuzzyNameScore, normalizeIngredientName, tokenizeIngredientName } from './normalize';

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
  const tokens = new Set([
    ...tokenizeIngredientName(name),
    ...tokenizeIngredientName(ingredientId.replace(/-/g, ' ')),
  ]);

  for (const staple of PANTRY_STAPLES) {
    const sNorm = normalizeIngredientName(staple);
    if (normalized === sNorm || idNorm === sNorm.replace(/\s+/g, '-')) return true;

    const stapleTokens = tokenizeIngredientName(staple);
    if (stapleTokens.length === 0) continue;

    if (stapleTokens.length === 1) {
      const token = stapleTokens[0];
      if (tokens.has(token)) return true;
      continue;
    }

    if (stapleTokens.every((t) => tokens.has(t))) return true;
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

function keysOverlap(ingKeys: string[], pantryKeys: string[]): boolean {
  for (const ik of ingKeys) {
    if (!ik) continue;
    const ikTokens = ik.includes(' ') ? ik.split(' ') : tokenizeIngredientName(ik);
    for (const pk of pantryKeys) {
      if (!pk) continue;
      if (ik === pk) return true;
      const pkTokens = pk.includes(' ') ? pk.split(' ') : tokenizeIngredientName(pk);
      if (ikTokens.length >= 2 || pkTokens.length >= 2) {
        const ikSet = new Set(ikTokens);
        const shared = pkTokens.filter((t) => ikSet.has(t));
        if (shared.length >= 2) return true;
        if (ikTokens.length >= 2 && shared.length === ikTokens.length) return true;
        if (pkTokens.length >= 2 && shared.length === pkTokens.length) return true;
      } else if (ikTokens.length === 1 && pkTokens.length === 1 && ikTokens[0] === pkTokens[0]) {
        return true;
      }
    }
  }
  return false;
}

function findPantryMatch(
  ingredient: RecipeIngredient,
  pantry: PantryItem[],
  usedPantryIds: Set<string>,
): { item: PantryItem | null; reason: MatchedIngredient['matchReason']; score: number } {
  if (pantry.length === 0) {
    return { item: null, reason: 'fuzzy_name', score: 0 };
  }

  const ingKeys = ingredientLookupKeys(ingredient);
  for (const item of pantry) {
    if (usedPantryIds.has(item.id)) continue;
    if (item.ingredientId === ingredient.ingredientId) {
      return { item, reason: 'ingredient_id', score: 1 };
    }
    const pantryKeys = pantryLookupKeys(item);
    if (keysOverlap(ingKeys, pantryKeys)) {
      return { item, reason: 'ingredient_id', score: 0.98 };
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
      usedPantryIds.add(result.item.id);
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
  limit = 3,
): RecipePantryMatch[] {
  if (pantry.length === 0) return [];
  const { ranked } = buildPantryMatchIndex(recipes, pantry);
  return filterRankedMatches(ranked, 'all', DEFAULT_MIN_PANTRY_MATCH_PERCENT, {
    minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
    pantryItemCount: pantry.length,
  }).slice(0, limit);
}
