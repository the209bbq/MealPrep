export type RecipeImportSourceType = 'youtube' | 'web';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

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

export function classifyRecipeImportUrl(urlString: string): RecipeImportSourceType | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (YOUTUBE_HOSTS.has(host)) return 'youtube';
  if (host.endsWith('.youtube.com')) return 'youtube';
  if (url.pathname.includes('/shorts/')) return 'youtube';
  return 'web';
}

export function canonicalYouTubeWatchUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    const v = url.searchParams.get('v');
    if (v) return `https://www.youtube.com/watch?v=${v}`;
  } catch {
    /* keep original */
  }
  return urlString;
}

export function urlHashKey(urlString: string): string {
  return urlString.trim().toLowerCase();
}
