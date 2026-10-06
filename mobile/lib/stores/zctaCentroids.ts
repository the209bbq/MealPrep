import { haversineMiles } from '../../config/smartShop';
import type { GeocodedPoint } from './nominatim';

export type ZctaCentroidMap = Record<string, [number, number]>;

let loaded: ZctaCentroidMap | null = null;
let loadPromise: Promise<ZctaCentroidMap> | null = null;

/** Lazy-load bundled Census ZCTA centroids (public domain). */
export async function loadZctaCentroids(): Promise<ZctaCentroidMap> {
  if (loaded) return loaded;
  if (!loadPromise) {
    loadPromise = Promise.resolve()
      .then(() => {
        const payload = require('../../data/zcta-centroids.json') as ZctaCentroidMap;
        loaded = payload;
        return payload;
      })
      .catch(() => {
        loaded = {};
        return loaded;
      });
  }
  return loadPromise;
}

export async function lookupZctaCentroid(zip: string): Promise<GeocodedPoint | null> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return null;
  const map = await loadZctaCentroids();
  const row = map[normalized];
  if (!row) return null;
  const [lat, lng] = row;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Nearest 5-digit ZCTA for device coordinates (bundled centroids; no network). */
export async function nearestZctaZip(lat: number, lng: number): Promise<string | null> {
  const map = await loadZctaCentroids();
  let bestZip: string | null = null;
  let bestDist = Infinity;
  for (const [zip, [zLat, zLng]] of Object.entries(map)) {
    if (!Number.isFinite(zLat) || !Number.isFinite(zLng)) continue;
    const dist = haversineMiles({ lat, lng }, { lat: zLat, lng: zLng });
    if (dist < bestDist) {
      bestDist = dist;
      bestZip = zip;
    }
  }
  return bestZip;
}
