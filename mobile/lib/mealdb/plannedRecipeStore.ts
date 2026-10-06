import type { Recipe } from '../../types/mealprep';
import { readJson, writeJson } from '../storage';
import { MEALDB } from '../../config/mealdb';
import { isMealDbRecipeId } from './normalize';

const STORE_KEY = `${MEALDB.cacheKeyPrefix}:planned-recipes`;

type PlannedRecipeStore = Record<string, Recipe>;

function readStore(): PlannedRecipeStore {
  return readJson<PlannedRecipeStore>(STORE_KEY, {});
}

function writeStore(store: PlannedRecipeStore): void {
  writeJson(STORE_KEY, store);
}

/** Persist a Classic recipe snapshot so meal plan / grocery / cook flows work after catalog refresh. */
export function rememberPlannedMealDbRecipe(recipe: Recipe): void {
  if (!isMealDbRecipeId(recipe.id)) return;
  const store = readStore();
  store[recipe.id] = recipe;
  writeStore(store);
}

export function readRememberedMealDbRecipes(): Recipe[] {
  const store = readStore();
  return Object.values(store);
}

export function resetPlannedMealDbRecipeStoreForTests(): void {
  writeStore({});
}
