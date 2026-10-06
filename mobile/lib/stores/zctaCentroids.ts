import { Platform } from 'react-native';
import { haversineMiles } from '../../config/smartShop';
import { webAssetPath } from '../webBasePath';
import type { GeocodedPoint } from './nominatim';

export type ZctaCentroidMap = Record<string, [number, number]>;

let loaded: ZctaCentroidMap | null = null;
let loadPromise: Promise<ZctaCentroidMap> | null = null;

async function fetchZctaJsonWeb(): Promise<ZctaCentroidMap> {
  const url = webAssetPath('/zcta-centroids.json');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ZCTA table (${res.status})`);
  }
  return (await res.json()) as ZctaCentroidMap;
}

/** Native and Node (tests / SSR): separate async chunk, not in web client entry/common. */
async function importZctaJsonBundled(): Promise<ZctaCentroidMap> {
  const mod: unknown = await import('../../data/zcta-centroids.json');
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: ZctaCentroidMap }).default;
  }
  return mod as ZctaCentroidMap;
}

async function loadZctaPayload(): Promise<ZctaCentroidMap> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return fetchZctaJsonWeb();
  }
  return importZctaJsonBundled();
}

/** Lazy-load Census ZCTA centroids (public domain). Not bundled into web client entry/common. */
export async function loadZctaCentroids(): Promise<ZctaCentroidMap> {
  if (loaded) return loaded;
  if (!loadPromise) {
    loadPromise = loadZctaPayload()
      .then((payload) => {
        loaded = payload;
        return payload;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
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

/** Nearest 5-digit ZCTA for device coordinates (bundled centroids; no network on web after first fetch). */
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
