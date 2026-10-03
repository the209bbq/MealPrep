import { sanitizeHttpUrl } from './safeHttpUrl';
import { youtubeVideoIdFromUrl } from './youtube';

export function youtubeHqDefaultThumbnailUrl(videoId: string): string {
  const id = videoId.trim();
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeThumbnailUrlFromWatchUrl(watchUrl: string | null | undefined): string | null {
  if (!watchUrl?.trim()) return null;
  const videoId = youtubeVideoIdFromUrl(watchUrl);
  if (!videoId) return null;
  return youtubeHqDefaultThumbnailUrl(videoId);
}

export function sanitizeRecipeImageUrl(url: string | null | undefined): string | null {
  return sanitizeHttpUrl(url);
}
