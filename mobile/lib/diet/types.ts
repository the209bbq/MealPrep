export type DietId = 'vegetarian' | 'vegan' | 'pescatarian' | 'keto';

export type AllergenId =
  | 'milk'
  | 'egg'
  | 'fish'
  | 'shellfish'
  | 'tree_nuts'
  | 'peanuts'
  | 'wheat'
  | 'soy'
  | 'sesame'
  | 'gluten';

export interface UserDietPrefs {
  diets: DietId[];
  allergens: AllergenId[];
  dislikes: string[];
  hideConflicts: boolean;
}

export interface RecipeDietTagResult {
  contains_allergens: AllergenId[];
  unknown_items: string[];
  diets_ok: DietId[];
  diets_fail: Partial<Record<DietId, string[]>>;
  dislikes_hit: string[];
  reasons: string[];
}
