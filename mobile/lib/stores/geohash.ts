const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Encode lat/lng to geohash at given character precision (5 ≈ 4.9 km). */
export function encodeGeohash(lat: number, lng: number, precision = 5): string {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch = (ch << 1) + 1;
        minLng = mid;
      } else {
        ch <<= 1;
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        minLat = mid;
      } else {
        ch <<= 1;
        maxLat = mid;
      }
    }
    isLng = !isLng;
    bit += 1;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function nearbyStoresCacheGeohash(lat: number, lng: number): string {
  return encodeGeohash(lat, lng, 5);
}
