export type RecipeImportSourceType =
  | 'youtube'
  | 'web'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'photo'
  | 'video';

export type RecipeImportRequestAction =
  | 'link'
  | 'confirm_youtube'
  | 'photo'
  | 'video'
  | 'screenshot'
  | 'text';

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
  social_author_name?: string | null;
  social_author_url?: string | null;
  author_public_recipe_url?: string | null;
}

export interface YoutubeImportSuggestionDto {
  watchUrl: string;
  videoId: string;
  channelTitle: string;
  title: string;
}

export type ImportFallbackStep = 'youtube_confirm' | 'video_upload' | 'screenshot' | 'paste_caption';

export interface RecipeImportFallbacksDto {
  steps: ImportFallbackStep[];
  youtubeSuggestion: YoutubeImportSuggestionDto | null;
  message: string;
}

export interface RecipeImportSuccessResponse {
  recipe: RecipeImportExtractedDto;
  cached?: boolean;
  confirmedYoutube?: boolean;
  autoResolvedViaYoutube?: { channelTitle: string; watchUrl: string };
}

export interface RecipeImportErrorEnvelope {
  error?: string;
  code?: string;
  fallbacks?: RecipeImportFallbacksDto;
}

export interface RecipeImportImagePayload {
  mimeType: string;
  data: string;
}
