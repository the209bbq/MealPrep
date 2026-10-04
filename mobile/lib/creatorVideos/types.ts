import type { CreatorRecipesBrowseMode } from '../../config/creatorRecipes';

export interface CreatorListItem {
  id: string;
  youtubeChannelId: string;
  displayName: string;
  handle: string | null;
  channelUrl: string;
  avatarUrl: string | null;
  subscriberCount: number;
  rank: number | null;
  fit: string;
  source: string | null;
}

export interface CreatorVideoItem {
  videoId: string;
  channelId: string;
  creatorName: string;
  creatorHandle: string | null;
  creatorAvatarUrl: string | null;
  channelUrl: string;
  title: string;
  descriptionSnippet: string | null;
  thumbnailUrl: string;
  publishedAt: string | null;
  viewCount: number;
  likeCount: number;
  durationSeconds: number | null;
  isShort: boolean;
  watchUrl: string;
}

export interface CreatorVideosFeedResult {
  mode: CreatorRecipesBrowseMode;
  videos: CreatorVideoItem[];
}

export interface CreatorVideosErrorEnvelope {
  error?: string;
  code?: string;
}
