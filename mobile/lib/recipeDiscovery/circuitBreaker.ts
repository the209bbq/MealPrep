import { readJson, writeJson } from '../storage';

const STORAGE_KEY = 'mealprep.recipeDiscovery.circuitOpenUntil';

/** How long to block RecipeAPI calls after quota / 429 (config). */
export const RECIPE_DISCOVERY_CIRCUIT_BREAKER_MS = 60 * 60 * 1000;

export function isRecipeDiscoveryCircuitOpen(now = Date.now()): boolean {
  const openUntil = readJson<number | null>(STORAGE_KEY, null);
  return openUntil != null && openUntil > now;
}

export function openRecipeDiscoveryCircuit(now = Date.now()): void {
  writeJson(STORAGE_KEY, now + RECIPE_DISCOVERY_CIRCUIT_BREAKER_MS);
}

export function clearRecipeDiscoveryCircuit(): void {
  writeJson(STORAGE_KEY, null);
}
