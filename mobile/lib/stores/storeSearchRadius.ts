import { milesToMeters } from '../../config/smartShop';

/** ZIP-origin nearby store search radius (meters). */
export const STORES_ZIP_SEARCH_RADIUS_M = 24_000;

/** GPS-origin nearby store search radius (meters). */
export const STORES_GPS_SEARCH_RADIUS_M = 16_000;

export function nearbyStoreSearchRadiusMeters(options: {
  isGpsOrigin?: boolean;
  radiusMultiplier?: number;
}): number {
  const base = options.isGpsOrigin ? STORES_GPS_SEARCH_RADIUS_M : STORES_ZIP_SEARCH_RADIUS_M;
  const mult = options.radiusMultiplier === 2 ? 2 : 1;
  return base * mult;
}

export function nearbyStoreSearchRadiusMiles(options: {
  isGpsOrigin?: boolean;
  radiusMultiplier?: number;
}): number {
  return nearbyStoreSearchRadiusMeters(options) / milesToMeters(1);
}
