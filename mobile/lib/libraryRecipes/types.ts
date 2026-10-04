export type LibraryRecipeStatus = 'draft' | 'published' | 'rejected';

export interface LibraryRecipeIngredientRow {
  name: string;
  quantity: number;
  unit: string;
  note?: string | null;
}

export interface LibraryRecipeRow {
  id: string;
  slug: string;
  title: string;
  dish_name: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: LibraryRecipeIngredientRow[];
  steps: string[];
  tags: string[] | null;
  cuisine: string | null;
  image_url: string | null;
  status: LibraryRecipeStatus;
  review_notes: string | null;
  model: string | null;
  generation_usage?: Record<string, unknown> | null;
  created_at: string;
}
