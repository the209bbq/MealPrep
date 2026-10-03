/**
 * Client-side URL classification for recipe import (keep in sync with supabase/functions/recipe-import/urlClassification.ts).
 */

export type RecipeImportUrlKind =
  | 'youtube'
  | 'web'
  | 'tiktok'
  | 'instagram'
  | 'facebook';

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

const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.watch',
  'www.fb.watch',
]);

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
  if (FACEBOOK_HOSTS.has(host) || host.endsWith('.facebook.com') || host === 'fb.watch') {
    return 'facebook';
  }
  return 'web';
}

export function isManualCaptionImportKind(kind: RecipeImportUrlKind | null): boolean {
  return kind === 'instagram' || kind === 'facebook';
}

/** @deprecated use isManualCaptionImportKind — TikTok uses auto caption server-side */
export function isSocialCaptionImportKind(kind: RecipeImportUrlKind | null): boolean {
  return kind === 'tiktok' || isManualCaptionImportKind(kind);
}
