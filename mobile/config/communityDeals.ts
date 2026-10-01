/** Community-reported store deals (Supabase `store_deals`). */

export const COMMUNITY_DEALS = {
  /** How long regular (non-sale) reported prices stay in comparisons. */
  regularPriceValidDays: 30,
  /** Default `valid_until` for legacy deal posts when the date is blank. */
  defaultValidDays: 7,
  /** Hide a deal after this many distinct `expired` votes. */
  expiredVoteThreshold: 3,
  /** Minimum fuzzy score to match a grocery list item to a deal name. */
  fuzzyMatchMinScore: 0.88,
  migrationFilePath: 'mobile/supabase/migrations/20261001120000_store_community_deals.sql',
  migrationHint:
    'Community prices are not available yet. Ask the app owner to finish setup, then try again.',
} as const;
