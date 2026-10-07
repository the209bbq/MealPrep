/**
 * Request creator/channel avatars at ~2× display size (YouTube ggpht / yt3 URLs).
 */
export function sizedCreatorAvatarUrl(
  url: string | null | undefined,
  displayPx: number,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const target = Math.max(48, Math.min(512, Math.ceil(displayPx * 2)));

  if (trimmed.includes('ggpht.com') || trimmed.includes('yt3.')) {
    if (/=s\d+/i.test(trimmed)) {
      // Resize only the =sNNN token; suffixes like -c-k-c0x00ffffff-no-rj contain digits.
      return trimmed.replace(/=s\d+/i, `=s${target}`);
    }
    const join = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${join}s${target}`;
  }

  return trimmed;
}
