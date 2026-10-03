/**
 * Recipe import from link (YouTube / web) — client config and copy.
 */

export const RECIPE_IMPORT = {
  enabled: true,
  /** Client fetch timeout; edge function budget is ~90s. */
  requestTimeoutMs: 95_000,
  proxyUrl: process.env.EXPO_PUBLIC_RECIPE_IMPORT_URL ?? '',
  rateLimitMessage: 'Too many imports — wait a minute and try again.',
  notConfiguredMessage:
    'Recipe import is not available on this app yet. Ask an admin to finish setup.',
  invalidUrlMessage: 'Paste a link to a recipe page or cooking video.',
  notRecipeMessage: 'We could not find a recipe at that link. Try a different URL.',
  importFailedMessage: 'Could not import that recipe right now. Check your connection and try again.',
  importBusyMessage: 'Import is busy right now. Try again in a moment.',
} as const;

export const RECIPE_IMPORT_COPY = {
  importButton: 'Import from link',
  importButtonAccessibility: 'Import recipe from a link',
  pastePlaceholder: 'Paste recipe or video link',
  pasteLabel: 'Recipe link',
  importCta: 'Import',
  importing: 'Reading recipe…',
  reviewTitle: 'Review before saving',
  reviewSubtitle: 'Edit anything that looks off, then save to your collection.',
  saveCta: 'Save recipe',
  saving: 'Saving…',
  cancel: 'Cancel',
  guestSignInMessage: 'Sign in to save imported recipes to your account.',
  guestSignInCta: 'Sign in',
  pasteFromClipboardCta: 'Paste',
  pasteFromClipboardAccessibility: 'Paste recipe link from clipboard',
  yourRecipeBadge: 'Your recipe',
  viewOriginal: 'View original',
  watchOnYouTube: 'Watch on YouTube',
  youtubeCredit: (channel: string) => `Recipe video by ${channel}`,
  youtubeCreditUnknown: 'Recipe video on YouTube',
  socialCaptionComingSoon:
    'TikTok/Instagram import is coming soon — paste the caption text instead',
  socialCaptionLabel: 'Caption text',
  socialCaptionPlaceholder: 'Paste the recipe caption from the post…',
  importFromCaptionCta: 'Import from caption',
  sourceLinkLabel: 'Source link',
  stepsTitle: 'Instructions',
  noSteps: 'No steps were found — check the original link.',
} as const;
