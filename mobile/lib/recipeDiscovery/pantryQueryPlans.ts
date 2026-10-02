import { PANTRY_DISCOVERY_MAX_QUERIES } from '../../config/recipeMatching';
import { RECIPE_DISCOVERY_PARALLEL_SEARCHES } from '../../config/recipeDiscoveryClient';
import type { PantryItem } from '../../types/mealprep';
import { pantryIngredientSearchQueries } from './pantryQueries';

/** Max RecipeAPI list page to randomize within (keeps free-tier usage predictable). */
export const PANTRY_DISCOVERY_MAX_PAGE = 12;

export interface PantryDiscoverySearchPlan {
  search: string;
  ingredients: string;
  page: number;
  planKey: string;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash;
}

function rotate<T>(items: T[], startIndex: number): T[] {
  if (items.length === 0) return [];
  const start = ((startIndex % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function pageForPlan(seed: number, planIndex: number, planKey: string): number {
  if (seed === 0) return 1;
  const mixed = Math.abs(hashString(`${seed}:${planIndex}:${planKey}`));
  return 1 + (mixed % PANTRY_DISCOVERY_MAX_PAGE);
}

/**
 * Build varied RecipeAPI queries: rotate starting ingredient, pair/triple combinations,
 * and paginate with a refresh seed (not only the longest pantry names every time).
 */
export function buildRotatingPantrySearchPlans(
  pantry: PantryItem[],
  options?: { seed?: number; maxQueries?: number },
): PantryDiscoverySearchPlan[] {
  const seed = options?.seed ?? 0;
  const maxQueries = options?.maxQueries ?? Math.min(PANTRY_DISCOVERY_MAX_QUERIES, RECIPE_DISCOVERY_PARALLEL_SEARCHES);

  const allTerms = pantryIngredientSearchQueries(pantry, Math.max(maxQueries * 3, 12));
  if (allTerms.length === 0) return [];

  const rotated = rotate(allTerms, seed);
  const plans: PantryDiscoverySearchPlan[] = [];
  const seen = new Set<string>();

  function pushPlan(search: string, planIndex: number): void {
    const key = search.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    plans.push({
      search,
      ingredients: search,
      page: pageForPlan(seed, planIndex, key),
      planKey: key,
    });
  }

  let planIndex = 0;

  for (let i = 0; i < rotated.length && plans.length < maxQueries + 2; i += 1) {
    pushPlan(rotated[i], planIndex);
    planIndex += 1;
  }

  if (rotated.length >= 2) {
    for (let i = 0; i < rotated.length - 1 && plans.length < maxQueries + 4; i += 1) {
      const pair = `${rotated[i]} ${rotated[i + 1]}`;
      pushPlan(pair, planIndex);
      planIndex += 1;
    }
  }

  if (rotated.length >= 3) {
    const comboOffset = seed % Math.max(1, rotated.length - 2);
    const triple = `${rotated[comboOffset]} ${rotated[comboOffset + 1]} ${rotated[comboOffset + 2]}`;
    pushPlan(triple, planIndex);
    planIndex += 1;
  }

  return plans.slice(0, maxQueries);
}
