import type {
  RecipeApiCuisine,
  RecipeApiDietaryTag,
  RecipeApiDifficulty,
  RecipeApiMealType,
  RecipeDiscoverySearchFilters,
} from './types';

/** True when the user has started a discover search (not the default empty catalog). */
export function isActiveRecipeDiscoverySearch(filters: RecipeDiscoverySearchFilters): boolean {
  if (filters.search?.trim()) return true;
  if (filters.cuisine) return true;
  if (filters.difficulty) return true;
  if (filters.mealType) return true;
  if (filters.dietaryTag) return true;
  if (filters.maxTotalMinutes != null && filters.maxTotalMinutes > 0) return true;
  return false;
}

export const RECIPE_DISCOVERY_CUISINES: { value: RecipeApiCuisine; label: string }[] = [
  { value: 'american', label: 'American' },
  { value: 'italian', label: 'Italian' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'thai', label: 'Thai' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'french', label: 'French' },
  { value: 'greek', label: 'Greek' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'turkish', label: 'Turkish' },
];

export const RECIPE_DISCOVERY_DIFFICULTIES: { value: RecipeApiDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const RECIPE_DISCOVERY_MEAL_TYPES: { value: RecipeApiMealType; label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'starter', label: 'Starter' },
  { value: 'soup', label: 'Soup' },
  { value: 'side_dish', label: 'Side' },
];

export const RECIPE_DISCOVERY_DIETARY: { value: RecipeApiDietaryTag; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten free' },
  { value: 'dairy_free', label: 'Dairy free' },
];

export const RECIPE_DISCOVERY_MAX_MINUTES = [30, 45, 60, 90] as const;
