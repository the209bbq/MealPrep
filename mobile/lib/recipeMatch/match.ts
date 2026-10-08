import type { PantryItem, Recipe, RecipeIngredient } from '../../types/mealprep';
import { isIngredientUnmeasurableForDeduction } from '../mealPlan/deductionIngredient';
import {
  DEFAULT_MIN_MATCHED_INGREDIENTS,
  KITCHEN_LIST_DEFAULT_MIN_PERCENT,
  RECIPE_MATCHING,
  RECIPES_TAB_PARTIAL_MATCH_LIMIT,
  RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT,
} from '../../config/recipeMatching';
import {
  FUZZY_MATCH_THRESHOLD,
  INGREDIENT_STRIP_TOKENS,
  PANTRY_STAPLES,
} from '../../config/recipeMatchingConfig';
import {
  fuzzyNameScore,
  ingredientMatchScore,
  normalizeIngredientName,
  tokenizeIngredientName,
} from './normalize';
import {
  fuzzyNameScoreWithPantryTokens,
  getPantryMatchContext,
  ingredientMatchScoreWithPantryTokens,
  type PantryMatchContext,
} from './pantryMatchContext';
import {
  findPantryItemsForIngredient,
  isEggComponentIngredient,
  isEggsPantryStapleRow,
  totalPantryQuantityInUnit,
} from './pantryStock';

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

function isWaterIngredient(name: string, ingredientId: string): boolean {
  const tokens = tokenizeIngredientName(name);
  const idTokens = tokenizeIngredientName(ingredientId.replace(/-/g, ' '));
  const hasWater = tokens.includes('water') || idTokens.includes('water');
  const iceOnly =
    (tokens.length === 1 && tokens[0] === 'ice') || (idTokens.length === 1 && idTokens[0] === 'ice');
  if (iceOnly) return true;
  if (!hasWater) return false;
  const strip = new Set<string>(INGREDIENT_STRIP_TOKENS);
  const waterModifiers = new Set(['hot', 'cold', 'warm', 'boiling', 'ice', 'iced', 'room', 'temperature']);
  const nonWater = tokens.filter(
    (t) => t !== 'water' && !strip.has(t) && !waterModifiers.has(t),
  );
  return nonWater.length === 0;
}

function isConfiguredStaple(name: string, ingredientId: string): boolean {
  if (isWaterIngredient(name, ingredientId)) return true;

  const normalized = normalizeIngredientName(name);
  const idNorm = normalizeIngredientName(ingredientId.replace(/-/g, ' '));

  for (const staple of PANTRY_STAPLES) {
    const sNorm = normalizeIngredientName(staple);
    if (normalized === sNorm || idNorm === sNorm) return true;
    const stapleTokens = tokenizeIngredientName(staple);
    const nameTokens = tokenizeIngredientName(name);
    if (
      stapleTokens.length === 1 &&
      nameTokens.length > 1 &&
      nameTokens[nameTokens.length - 1] === stapleTokens[0]
    ) {
      const extra = nameTokens.slice(0, -1);
      const strip = new Set<string>(INGREDIENT_STRIP_TOKENS);
      if (extra.every((t) => strip.has(t))) return true;
    }
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
  context: PantryMatchContext,
): { item: PantryItem | null; reason: MatchedIngredient['matchReason']; score: number } {
  if (pantry.length === 0) {
    return { item: null, reason: 'fuzzy_name', score: 0 };
  }

  // FK3-4: egg yolk / egg white use whole eggs from the pantry (same rule as pantryStock).
  if (isEggComponentIngredient(ingredient.name)) {
    for (const row of context.items) {
      const item = row.item;
      if (usedPantryIds.has(item.id)) continue;
      if (isEggsPantryStapleRow(item)) {
        return { item, reason: 'ingredient_id', score: 1 };
      }
    }
  }

  for (const row of context.items) {
    const item = row.item;
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
  for (const row of context.items) {
    const item = row.item;
    if (usedPantryIds.has(item.id)) continue;
    const score = fuzzyNameScoreWithPantryTokens(ingredient.name, row);
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

/**
 * Pantry matching for cook / Made-it deductions. Includes configured staples and
 * catalog staple pantry rows; skips unmeasurable lines (to taste, pinch, etc.).
 */
export function scoreRecipeForPantryDeduction(
  recipe: Recipe,
  pantry: PantryItem[],
  context?: PantryMatchContext,
): RecipePantryMatch {
  const matchContext = context ?? getPantryMatchContext(pantry);
  const usedPantryIds = new Set<string>();
  const matched: MatchedIngredient[] = [];
  const missing: RecipeIngredient[] = [];
  let scorableCount = 0;

  for (const ingredient of recipe.ingredients) {
    if (isIngredientUnmeasurableForDeduction(ingredient)) {
      continue;
    }
    scorableCount += 1;

    const result = findPantryMatch(ingredient, pantry, usedPantryIds, matchContext);
    if (result.item) {
      const pantryMatches = findPantryItemsForIngredient(ingredient, pantry);
      const have = totalPantryQuantityInUnit(pantryMatches, ingredient.unit, ingredient.name);
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

export function scoreRecipeAgainstPantry(
  recipe: Recipe,
  pantry: PantryItem[],
  context?: PantryMatchContext,
): RecipePantryMatch {
  const matchContext = context ?? getPantryMatchContext(pantry);
  const usedPantryIds = new Set<string>();
  const matched: MatchedIngredient[] = [];
  const missing: RecipeIngredient[] = [];
  let scorableCount = 0;

  for (const ingredient of recipe.ingredients) {
    if (isConfiguredStaple(ingredient.name, ingredient.ingredientId)) {
      continue;
    }
    scorableCount += 1;

    const result = findPantryMatch(ingredient, pantry, usedPantryIds, matchContext);
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

function pantryMatchFingerprint(recipe: Recipe): string {
  const parts = recipe.ingredients.map(
    (row) => `${row.name}:${row.quantity}:${row.unit ?? ''}`,
  );
  return `${recipe.id}|${recipe.name}|${parts.join(';')}`;
}

export function buildPantryMatchIndex(recipes: Recipe[], pantry: PantryItem[]): PantryMatchIndex {
  const context = getPantryMatchContext(pantry);
  if (pantry.length === 0) {
    const empty = recipes.map((recipe) => scoreRecipeAgainstPantry(recipe, pantry, context));
    const byRecipeId = new Map(empty.map((m) => [m.recipeId, m]));
    return { byRecipeId, ranked: [] };
  }

  const ranked = recipes.map((recipe) => scoreRecipeAgainstPantry(recipe, pantry, context));
  ranked.sort(compareRecipePantryMatches);
  const byRecipeId = new Map(ranked.map((m) => [m.recipeId, m]));
  return { byRecipeId, ranked };
}

/**
 * Reuse prior pantry scores when recipes are unchanged; score only new or updated rows.
 * Avoids re-scanning the full kitchen catalog on every MealDB cache tick.
 */
export function updatePantryMatchIndex(
  previous: PantryMatchIndex | null,
  previousFingerprints: ReadonlyMap<string, string> | null,
  recipes: Recipe[],
  pantry: PantryItem[],
): { index: PantryMatchIndex; fingerprints: Map<string, string> } {
  const context = getPantryMatchContext(pantry);
  const fingerprints = new Map<string, string>();
  const matches: RecipePantryMatch[] = [];

  for (const recipe of recipes) {
    const fingerprint = pantryMatchFingerprint(recipe);
    fingerprints.set(recipe.id, fingerprint);
    const priorFingerprint = previousFingerprints?.get(recipe.id);
    const priorMatch = previous?.byRecipeId.get(recipe.id);
    if (priorMatch && priorFingerprint === fingerprint) {
      matches.push(priorMatch);
      continue;
    }
    matches.push(scoreRecipeAgainstPantry(recipe, pantry, context));
  }

  if (pantry.length === 0) {
    const byRecipeId = new Map(matches.map((m) => [m.recipeId, m]));
    return { index: { byRecipeId, ranked: [] }, fingerprints };
  }

  const ranked = [...matches];
  ranked.sort(compareRecipePantryMatches);
  const byRecipeId = new Map(matches.map((m) => [m.recipeId, m]));
  return { index: { byRecipeId, ranked }, fingerprints };
}

export type RecipePantryFilterMode = 'all' | 'have_all' | 'missing_1_2' | 'best_match';

export interface FilterRankedMatchesOptions {
  /** Minimum non-staple pantry ingredient matches (default from recipeMatching config). */
  minMatchedCount?: number;
  /** When 0, returns no recipes (empty pantry). */
  pantryItemCount?: number;
}

function effectiveFilterMode(mode: RecipePantryFilterMode): Exclude<RecipePantryFilterMode, 'best_match'> {
  return mode === 'best_match' ? 'all' : mode;
}

export function filterRankedMatches(
  ranked: RecipePantryMatch[],
  mode: RecipePantryFilterMode,
  minPercent: number,
  options?: FilterRankedMatchesOptions,
): RecipePantryMatch[] {
  if (options?.pantryItemCount === 0) return [];

  const minMatched = options?.minMatchedCount ?? DEFAULT_MIN_MATCHED_INGREDIENTS;
  const filterMode = effectiveFilterMode(mode);
  return ranked.filter((m) => {
    if (m.matchedCount < minMatched) return false;
    if (m.percentMatch < minPercent) return false;
    if (filterMode === 'have_all') return m.missingCount === 0;
    if (filterMode === 'missing_1_2') return m.missingCount >= 1 && m.missingCount <= 2;
    return true;
  });
}

export interface FilterRankedMatchesWithFallbackResult {
  matches: RecipePantryMatch[];
  usedPartialFallback: boolean;
}

export interface FilterRankedMatchesWithFallbackOptions extends FilterRankedMatchesOptions {
  partialMinMatchedCount?: number;
  partialMatchMax?: number;
}

/** Applies default thresholds; if nothing passes, surfaces best partial pantry overlaps. */
export function filterRankedMatchesWithPartialFallback(
  ranked: RecipePantryMatch[],
  mode: RecipePantryFilterMode,
  minPercent: number,
  options?: FilterRankedMatchesWithFallbackOptions,
): FilterRankedMatchesWithFallbackResult {
  const strict = filterRankedMatches(ranked, mode, minPercent, options);
  if (strict.length > 0) {
    return { matches: strict, usedPartialFallback: false };
  }
  if (options?.pantryItemCount === 0) {
    return { matches: [], usedPartialFallback: false };
  }

  const partialMin = options?.partialMinMatchedCount ?? RECIPES_TAB_PARTIAL_MIN_MATCHED_COUNT;
  const partialMax = options?.partialMatchMax ?? RECIPES_TAB_PARTIAL_MATCH_LIMIT;
  const partial = filterRankedMatches(ranked, mode, 0, {
    ...options,
    minMatchedCount: partialMin,
  });

  return {
    matches: partial.slice(0, partialMax),
    usedPartialFallback: partial.length > 0,
  };
}

export function topPantryRecipeRecommendations(
  recipes: Recipe[],
  pantry: PantryItem[],
  limit = RECIPE_MATCHING.homeRecommendationsLimit,
  existingIndex?: PantryMatchIndex,
): RecipePantryMatch[] {
  if (pantry.length === 0) return [];
  const { ranked } = existingIndex ?? buildPantryMatchIndex(recipes, pantry);
  return filterRankedMatches(ranked, 'all', KITCHEN_LIST_DEFAULT_MIN_PERCENT, {
    minMatchedCount: DEFAULT_MIN_MATCHED_INGREDIENTS,
    pantryItemCount: pantry.length,
  }).slice(0, limit);
}
