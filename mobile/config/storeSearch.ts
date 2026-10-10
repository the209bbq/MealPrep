/** Nearby store discovery — Supabase catalog (Overpass disabled in client). */

export const STORE_SEARCH = {
  /** Public Overpass/Nominatim store search is off; data comes from Supabase `stores` + fallbacks. */
  overpassEnabled: false,
  /**
   * Rows requested from `nearby_stores` (the function caps at 200). The nearest 40 rows in a
   * town centre are mostly unbranded listings, so a small limit never reaches the supermarkets.
   */
  nearbyRpcLimit: 200,
  /** After the name filter, keep this many nearest recognised stores and this many nearest others. */
  nearbyKeepPerGroup: 30,
  oakdaleFallbackMaxKm: 60,
} as const;
