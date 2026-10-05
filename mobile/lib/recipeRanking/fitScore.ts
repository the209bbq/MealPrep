import type { RecipesTabFilterState } from '../../config/recipesTabFilters';
import { calculateRecipeCostPerServing } from '../costPerServing';
import type { RecipeCostPricingContext } from '../costPerServing/types';
import type { RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import {
  FIT_WEIGHT_BUDGET,
  FIT_WEIGHT_PANTRY,
  FIT_WEIGHT_SERVINGS,
  FIT_WEIGHT_TIME,
} from './weights';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function targetMinutesFromFilters(filters: RecipesTabFilterState): number {
  if (filters.time === 'any') return 45;
  return Number.parseInt(filters.time, 10);
}

export function scorePantryFit(match: RecipePantryMatch): number {
  return clampScore(match.percentMatch);
}

export function scoreTimeFit(minutes: number, filters: RecipesTabFilterState): number {
  const target = targetMinutesFromFilters(filters);
  const safeMinutes = Math.max(1, minutes);
  if (safeMinutes <= target) return 100;
  const over = safeMinutes - target;
  return clampScore(100 - over * 2.5);
}

export function scoreBudgetFit(
  recipe: Recipe,
  pricing: RecipeCostPricingContext,
  cache: Map<string, number | null>,
): number {
  let cost = cache.get(recipe.id);
  if (cost === undefined) {
    cost = calculateRecipeCostPerServing(recipe, pricing).costPerServing;
    cache.set(recipe.id, cost);
  }
  if (cost == null) return 55;
  if (cost <= 2.5) return 100;
  if (cost >= 14) return 5;
  const span = 14 - 2.5;
  return clampScore(100 - ((cost - 2.5) / span) * 95);
}

export function scoreServingsFit(recipeServings: number, householdSize: number): number {
  const servings = Math.max(1, recipeServings);
  const target = Math.max(1, householdSize);
  const diff = Math.abs(servings - target);
  if (diff === 0) return 100;
  if (diff === 1) return 88;
  if (diff === 2) return 72;
  if (diff <= 4) return 50;
  return 30;
}

export function scoreRecipeFit(
  recipe: Recipe,
  match: RecipePantryMatch,
  householdSize: number,
  filters: RecipesTabFilterState,
  pricing: RecipeCostPricingContext,
  costCache: Map<string, number | null>,
): number {
  const pantry = scorePantryFit(match);
  const time = scoreTimeFit(recipe.minutes, filters);
  const budget = scoreBudgetFit(recipe, pricing, costCache);
  const servings = scoreServingsFit(recipe.servings, householdSize);
  return clampScore(
    pantry * FIT_WEIGHT_PANTRY +
      time * FIT_WEIGHT_TIME +
      budget * FIT_WEIGHT_BUDGET +
      servings * FIT_WEIGHT_SERVINGS,
  );
}
