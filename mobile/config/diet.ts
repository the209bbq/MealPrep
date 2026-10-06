import type { AllergenId, DietId } from '../lib/diet/types';
import { RECIPES_COPY } from './recipesCopy';

export const DIET_PREF_COPY = {
  sectionTitle: 'Diet & allergies',
  sectionBlurb: 'Optional. We estimate from ingredient names — not a substitute for reading labels.',
  dietsLabel: 'Diets',
  allergensLabel: 'Allergens to avoid',
  dislikesLabel: 'Dislikes',
  dislikesPlaceholder: 'Add an ingredient, then tap Add',
  dislikesAdd: 'Add',
  hideConflictsLabel: "Hide recipes that don't fit",
  hideConflictsHint: 'When on, lists skip recipes that conflict with your choices.',
  estimateDisclaimer: 'Check labels — estimate only',
  skipAtSignup: 'Skip for now',
  hiddenForAllergySettingsToast: 'Hidden because of your allergy settings',
  recipeOfflineUnavailableToast: RECIPES_COPY.recipeCard.offlineDetailsUnavailable,
} as const;

export const DIET_OPTIONS: { id: DietId; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'keto', label: 'Keto' },
];

export const ALLERGEN_OPTIONS: { id: AllergenId; label: string }[] = [
  { id: 'milk', label: 'Milk' },
  { id: 'egg', label: 'Egg' },
  { id: 'fish', label: 'Fish' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'tree_nuts', label: 'Tree nuts' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'wheat', label: 'Wheat' },
  { id: 'soy', label: 'Soy' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'gluten', label: 'Gluten' },
];

export const ALLERGEN_FREE_LABEL: Record<AllergenId, string> = {
  milk: 'dairy-free',
  egg: 'egg-free',
  fish: 'fish-free',
  shellfish: 'shellfish-free',
  tree_nuts: 'tree-nut-free',
  peanuts: 'peanut-free',
  wheat: 'wheat-free',
  soy: 'soy-free',
  sesame: 'sesame-free',
  gluten: 'gluten-free',
};

export const ALLERGEN_CONTAINS_LABEL: Record<AllergenId, string> = {
  milk: 'dairy',
  egg: 'egg',
  fish: 'fish',
  shellfish: 'shellfish',
  tree_nuts: 'tree nut',
  peanuts: 'peanut',
  wheat: 'wheat',
  soy: 'soy',
  sesame: 'sesame',
  gluten: 'gluten',
};
