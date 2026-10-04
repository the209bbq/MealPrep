/** Nearby store discovery — Supabase catalog (Overpass disabled in client). */

export const STORE_SEARCH = {
  /** Public Overpass/Nominatim store search is off; data comes from Supabase `stores` + fallbacks. */
  overpassEnabled: false,
  nearbyRpcLimit: 40,
  oakdaleFallbackMaxKm: 60,
} as const;
