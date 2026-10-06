import {
  MEALDB_CATEGORY_ORDER_COLD_START,
  RECIPES_TAB_SURFACE,
  type MealDbCatalogCategory,
} from '../../config/recipesTabSurface';
import type { UserDietPrefs } from '../diet/types';
import { countStrongEvents, type EngagementIndexV2 } from '../recipeRanking/engagementIndex';
import { profilePriorForGroup } from '../recipeRanking/profilePrior';
import { recipeCategoryGroup } from '../seamlessFlow/categoryGroup';
import { createVisitRng, uniformJitter } from './seededRandom';
import {
  categoryImpressionsInWindow,
  categoryWasOpenedInVisit,
  type RecipesTabSurfaceEvent,
} from './surfaceEvents';
import type { RecipesTabVisitState } from './visitState';
import { isCategoryHiddenByDietMap, isCategoryHiddenByDislikes } from './categoryDiet';

export interface MealDbCategoryChip {
  category: MealDbCatalogCategory;
  position: number;
  score: number;
  thumbUrl: string | null;
}

export interface CategoryRotationInput {
  visitId: string;
  categories: readonly {
    category: MealDbCatalogCategory;
    thumbUrl: string | null;
    passingRecipeCount: number;
  }[];
  prefs: UserDietPrefs;
  householdSize: number;
  index: EngagementIndexV2;
  surfaceEvents: readonly RecipesTabSurfaceEvent[];
  visitState: RecipesTabVisitState;
  nowMs: number;
  hourLocal?: number;
}

function timeOfDayBoost(category: MealDbCatalogCategory, hour: number): number {
  if (category === 'Breakfast' && hour < 10) return 1;
  if (category === 'Dessert' && hour >= 18) return 1;
  if ((category === 'Starter' || category === 'Side') && hour >= 11 && hour < 14) return 0.5;
  return 0;
}

function categoryAffinity(
  category: MealDbCatalogCategory,
  index: EngagementIndexV2,
  prefs: UserDietPrefs,
  householdSize: number,
  nowMs: number,
): number {
  const group = recipeCategoryGroup({ category });
  const n = countStrongEvents(index, nowMs);
  const groupSum = index.tasteGroup[group] ?? 0;
  const learned01 = (Math.tanh(groupSum / 8) + 1) / 2;
  const priorRaw = profilePriorForGroup(prefs, group, 45, householdSize, category);
  const prior01 = Math.max(0, Math.min(1, 0.5 + priorRaw * 0.5));
  const k = 3;
  return (n * learned01 + k * prior01) / (n + k);
}

function coldStartRank(category: MealDbCatalogCategory): number {
  const idx = MEALDB_CATEGORY_ORDER_COLD_START.indexOf(category as (typeof MEALDB_CATEGORY_ORDER_COLD_START)[number]);
  return idx >= 0 ? idx : 999;
}

export function buildCategoryRotation(input: CategoryRotationInput): MealDbCategoryChip[] {
  const hour = input.hourLocal ?? new Date(input.nowMs).getHours();
  const rng = createVisitRng(`${input.visitId}:categories`);
  const lastFirst3 = input.visitState.lastFirst3Categories ?? [];
  const strongCount = countStrongEvents(input.index, input.nowMs);

  const visible = input.categories.filter((row) => {
    if (isCategoryHiddenByDietMap(row.category, input.prefs)) return false;
    if (isCategoryHiddenByDislikes(row.category, input.prefs)) return false;
    if (row.passingRecipeCount < 3) return false;
    return true;
  });

  const scored = visible.map((row) => {
    const affinity = categoryAffinity(row.category, input.index, input.prefs, input.householdSize, input.nowMs);
    const timeOfDay = timeOfDayBoost(row.category, hour);
    const impressions7d = categoryImpressionsInWindow(
      input.surfaceEvents,
      row.category,
      RECIPES_TAB_SURFACE.categoryImpressionFatigueHalfLifeDays,
      input.nowMs,
    );
    const novelty = Math.exp(-impressions7d / 5);
    const jitter = uniformJitter(rng, 0.05);
    const priorVisitId = input.visitState.priorVisitId ?? '';
    const fatigue =
      priorVisitId &&
      lastFirst3.includes(row.category) &&
      !categoryWasOpenedInVisit(input.surfaceEvents, priorVisitId, row.category)
        ? 0.1
        : 0;
    const catScore =
      0.6 * affinity + 0.15 * timeOfDay + 0.15 * novelty + jitter - fatigue;
    return { ...row, affinity, catScore };
  });

  scored.sort((a, b) => {
    const scoreDiff = b.catScore - a.catScore;
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    if (strongCount < 5) {
      return coldStartRank(a.category) - coldStartRank(b.category);
    }
    return scoreDiff;
  });

  if (strongCount >= 5) {
    const byAffinity = [...scored].sort((a, b) => b.affinity - a.affinity);
    const pinned = byAffinity.slice(0, 2).map((row) => row.category);
    const pinnedRows = scored.filter((row) => pinned.includes(row.category));
    const rest = scored.filter((row) => !pinned.includes(row.category));
    scored.splice(0, scored.length, ...pinnedRows, ...rest);
  }

  return scored.map((row, index) => ({
    category: row.category,
    thumbUrl: row.thumbUrl,
    position: index + 1,
    score: row.catScore,
  }));
}

export function first3CategoryNames(chips: readonly MealDbCategoryChip[]): string[] {
  return chips.slice(0, 3).map((chip) => chip.category);
}
