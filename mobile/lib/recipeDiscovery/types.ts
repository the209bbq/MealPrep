/** RecipeAPI.io shapes (https://recipeapi.io/docs/resources/recipes) */

export type RecipeApiDifficulty = 'easy' | 'medium' | 'hard';

export type RecipeApiCuisine =
  | 'american'
  | 'chinese'
  | 'french'
  | 'greek'
  | 'italian'
  | 'japanese'
  | 'mexican'
  | 'portuguese'
  | 'spanish'
  | 'thai'
  | 'turkish';

export type RecipeApiMealType =
  | 'starter'
  | 'main'
  | 'dessert'
  | 'appetizer'
  | 'breakfast'
  | 'brunch'
  | 'snack'
  | 'side_dish'
  | 'soup'
  | 'drink'
  | 'sauce';

export type RecipeApiDietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'halal'
  | 'kosher';

export interface RecipeApiIngredient {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  optional: boolean;
}

export interface RecipeApiRecipe {
  id: number;
  name: string;
  description: string;
  difficulty: RecipeApiDifficulty;
  meal_type: string;
  cuisine: string;
  dietary_tags: string[];
  servings: number;
  prep_time: number;
  cook_time: number;
  calories_per_serving: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  instructions: string[];
  ingredients: RecipeApiIngredient[];
}

export interface RecipeApiListMeta {
  current_page: number;
  last_page: number;
  path: string;
  per_page: number;
  total: number;
  language: string;
}

export interface RecipeApiListResponse {
  data: RecipeApiRecipe[];
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: RecipeApiListMeta;
}

export interface RecipeApiDetailResponse {
  data: RecipeApiRecipe;
  meta: { language: string };
}

export interface RecipeApiErrorEnvelope {
  error?: { code?: string; message?: string };
}

export interface RecipeDiscoverySearchFilters {
  search?: string;
  /** RecipeAPI.io ingredient filter (comma-separated or single term). */
  ingredients?: string;
  cuisine?: RecipeApiCuisine;
  mealType?: RecipeApiMealType;
  difficulty?: RecipeApiDifficulty;
  dietaryTag?: RecipeApiDietaryTag;
  /** Upper bound on prep + cook time (minutes), applied via API time filters when set. */
  maxTotalMinutes?: number;
  page?: number;
  perPage?: number;
}

export type RecipeDiscoveryListItem = RecipeApiRecipe & { isDemoSample?: boolean };
