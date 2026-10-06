/**
 * Optional off-platform recipe sites for curated creators (not stored in Supabase).
 * Keys are YouTube channel IDs.
 */
export type CreatorWebsiteConfig = {
  url: string;
  /** Host or short label shown after "Full recipes at". */
  displayHost: string;
};

export const CREATOR_WEBSITE_BY_CHANNEL_ID: Readonly<Record<string, CreatorWebsiteConfig>> = {
  UCx2cbCojhLK2QFIhwjNQYgA: {
    url: 'https://kevmoskitchen.com',
    displayHost: 'kevmoskitchen.com',
  },
};

export function creatorWebsiteForChannel(
  youtubeChannelId: string | null | undefined,
): CreatorWebsiteConfig | null {
  if (!youtubeChannelId) return null;
  return CREATOR_WEBSITE_BY_CHANNEL_ID[youtubeChannelId] ?? null;
}
