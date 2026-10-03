export type RecipeImportSourceType = 'youtube' | 'web' | 'tiktok' | 'instagram';

export interface RecipeImportIngredientDto {
  name: string;
  quantity: number;
  unit: string;
  note?: string;
}

export interface RecipeImportExtractedDto {
  title: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: RecipeImportIngredientDto[];
  steps: string[];
  is_recipe: boolean;
  confidence: number;
  source_url: string;
  source_type: RecipeImportSourceType;
  source_title?: string;
  youtube_channel_name?: string | null;
  metadata_refreshed_at?: string;
}

export interface RecipeImportSuccessResponse {
  recipe: RecipeImportExtractedDto;
  cached?: boolean;
}

export interface RecipeImportErrorEnvelope {
  error?: string;
  code?: string;
}
