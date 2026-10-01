/** Community-reported store deals (Supabase `store_deals`). */

export const COMMUNITY_DEALS = {
  /** Default `valid_until` when the user leaves the date blank. */
  defaultValidDays: 7,
  /** Hide a deal after this many distinct `expired` votes. */
  expiredVoteThreshold: 3,
  /** Minimum fuzzy score to match a grocery list item to a deal name. */
  fuzzyMatchMinScore: 0.88,
  migrationFilePath: 'mobile/supabase/migrations/20261001120000_store_community_deals.sql',
  migrationHint:
    'Community deals aren’t available yet. Ask an admin to finish setup.',
} as const;
