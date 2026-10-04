/** TheMealDB API JSON shapes (v1). */

export interface MealDbFilterMealSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
}

export interface MealDbMealDetail {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null;
  strYoutube: string | null;
  strSource: string | null;
  [key: `strIngredient${number}`]: string | null | undefined;
  [key: `strMeasure${number}`]: string | null | undefined;
}

export interface MealDbMealsResponse {
  meals: MealDbMealDetail[] | null;
}

export interface MealDbFilterResponse {
  meals: MealDbFilterMealSummary[] | null;
}
