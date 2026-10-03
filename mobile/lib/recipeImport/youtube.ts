function canonicalYouTubeWatchUrl(urlString: string): string {
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

/** 30 days — YouTube channel/title metadata must be refreshed (matches import URL cache TTL). */
export const YOUTUBE_SOURCE_METADATA_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function youtubeVideoIdFromUrl(url: string): string | null {
  try {
    const canonical = canonicalYouTubeWatchUrl(url);
    const parsed = new URL(canonical);
    const v = parsed.searchParams.get('v');
    if (v && /^[\w-]{6,}$/.test(v)) return v;
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id) return id;
    }
    const shorts = parsed.pathname.match(/\/shorts\/([\w-]+)/);
    if (shorts?.[1]) return shorts[1];
  } catch {
    return null;
  }
  return null;
}

export function isYoutubeSourceMetadataFresh(refreshedAt: string | undefined | null): boolean {
  if (!refreshedAt) return false;
  const at = Date.parse(refreshedAt);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < YOUTUBE_SOURCE_METADATA_TTL_MS;
}
