import { readJson, writeJson } from '../storage';
import type { AllergenId, DietId, UserDietPrefs } from './types';

export const DIET_PREFS_STORAGE_KEY = 'mealprep.userDietPrefs';

export const DEFAULT_USER_DIET_PREFS: UserDietPrefs = {
  diets: [],
  allergens: [],
  dislikes: [],
  hideConflicts: true,
};

const DIET_SET = new Set<DietId>(['vegetarian', 'vegan', 'pescatarian', 'keto']);
const ALLERGEN_SET = new Set<AllergenId>([
  'milk',
  'egg',
  'fish',
  'shellfish',
  'tree_nuts',
  'peanuts',
  'wheat',
  'soy',
  'sesame',
  'gluten',
]);

export function normalizeUserDietPrefs(raw: Partial<UserDietPrefs> | null | undefined): UserDietPrefs {
  const diets = (raw?.diets ?? []).filter((d): d is DietId => DIET_SET.has(d as DietId));
  const allergens = (raw?.allergens ?? []).filter((a): a is AllergenId => ALLERGEN_SET.has(a as AllergenId));
  const dislikes = (raw?.dislikes ?? [])
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 40);
  return {
    diets,
    allergens,
    dislikes,
    hideConflicts: raw?.hideConflicts ?? true,
  };
}

export function readLocalUserDietPrefs(): UserDietPrefs {
  return normalizeUserDietPrefs(readJson(DIET_PREFS_STORAGE_KEY, DEFAULT_USER_DIET_PREFS));
}

export function writeLocalUserDietPrefs(prefs: UserDietPrefs): void {
  writeJson(DIET_PREFS_STORAGE_KEY, normalizeUserDietPrefs(prefs));
}
