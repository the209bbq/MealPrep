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
    'Community deals table is missing. Run the SQL migration in the Supabase SQL editor (see mobile/supabase/migrations/20261001120000_store_community_deals.sql).',
} as const;
