import { SAVED_RECIPES } from '../../config/savedRecipes';
import { readJson, writeJson } from '../storage';
import type { SavedRecipeRecord } from './types';

export function readGuestSavedRecipes(): SavedRecipeRecord[] {
  return readJson<SavedRecipeRecord[]>(SAVED_RECIPES.guestStorageKey, []);
}

export function writeGuestSavedRecipes(records: SavedRecipeRecord[]): void {
  writeJson(SAVED_RECIPES.guestStorageKey, records);
}

export function clearGuestSavedRecipes(): void {
  writeGuestSavedRecipes([]);
}

export function upsertGuestSavedRecipe(record: SavedRecipeRecord): SavedRecipeRecord[] {
  const prev = readGuestSavedRecipes();
  const without = prev.filter((row) => row.refKey !== record.refKey);
  const next = [{ ...record, savedAt: record.savedAt || new Date().toISOString() }, ...without];
  writeGuestSavedRecipes(next);
  return next;
}

export function removeGuestSavedRecipe(refKey: string): SavedRecipeRecord[] {
  const next = readGuestSavedRecipes().filter((row) => row.refKey !== refKey);
  writeGuestSavedRecipes(next);
  return next;
}
