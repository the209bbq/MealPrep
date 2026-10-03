import type { ViralRecipesCategory } from '../../config/viralRecipes';

export interface ViralRecipeLinkItem {
  videoId: string;
  category: ViralRecipesCategory;
  title: string;
  thumbnailUrl: string;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  watchUrl: string;
  viewCount: number;
  publishedAt: string | null;
}

export interface ViralRecipesFetchResult {
  items: ViralRecipeLinkItem[];
  cached: boolean;
  category: ViralRecipesCategory;
}

export interface ViralRecipesErrorEnvelope {
  error?: string;
  code?: string;
}
