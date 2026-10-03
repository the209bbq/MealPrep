/**
 * Client-side URL classification for recipe import (keep in sync with supabase/functions/recipe-import/urlClassification.ts).
 */

export type RecipeImportUrlKind = 'youtube' | 'web' | 'tiktok' | 'instagram';

export function normalizeImportUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

export function classifyImportUrlForClient(urlString: string): RecipeImportUrlKind | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (YOUTUBE_HOSTS.has(host) || host.endsWith('.youtube.com') || url.pathname.includes('/shorts/')) {
    return 'youtube';
  }
  if (TIKTOK_HOSTS.has(host) || host.endsWith('.tiktok.com')) return 'tiktok';
  if (INSTAGRAM_HOSTS.has(host) || host.endsWith('.instagram.com')) return 'instagram';
  return 'web';
}

export function isSocialCaptionImportKind(kind: RecipeImportUrlKind | null): boolean {
  return kind === 'tiktok' || kind === 'instagram';
}
