import type { AllergenId } from '../lib/diet/types';

/**
 * When a phrase matches (longest first), use only these allergens — skip generic keyword rules.
 */
export const ALLERGEN_PHRASE_OVERRIDES: { phrase: string; allergens: AllergenId[] }[] = [
  { phrase: 'cream of tartar', allergens: [] },
  { phrase: 'butternut squash', allergens: [] },
  { phrase: 'gluten free oats', allergens: [] },
  { phrase: 'gluten-free oats', allergens: [] },
  { phrase: 'peanut butter', allergens: ['peanuts'] },
  { phrase: 'almond butter', allergens: ['tree_nuts'] },
  { phrase: 'apple butter', allergens: [] },
  { phrase: 'cocoa butter', allergens: [] },
  { phrase: 'coconut cream', allergens: [] },
  { phrase: 'coconut milk', allergens: [] },
  { phrase: 'cashew milk', allergens: ['tree_nuts'] },
  { phrase: 'almond milk', allergens: ['tree_nuts'] },
  { phrase: 'rice milk', allergens: [] },
  { phrase: 'oat milk', allergens: [] },
  { phrase: 'soy milk', allergens: ['soy'] },
  { phrase: 'shea butter', allergens: [] },
  { phrase: 'eggplant', allergens: [] },
  { phrase: 'butternut', allergens: [] },
];

export const ALLERGEN_PHRASE_OVERRIDES_SORTED = [...ALLERGEN_PHRASE_OVERRIDES].sort(
  (a, b) => b.phrase.length - a.phrase.length,
);
