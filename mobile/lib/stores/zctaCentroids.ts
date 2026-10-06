import { Platform } from 'react-native';
import { haversineMiles } from '../../config/smartShop';
import { webAssetPath } from '../webBasePath';
import type { GeocodedPoint } from './nominatim';

export type ZctaCentroidMap = Record<string, [number, number]>;

let loaded: ZctaCentroidMap | null = null;
let loadPromise: Promise<ZctaCentroidMap> | null = null;

async function readZctaJsonFromDisk(): Promise<ZctaCentroidMap> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(dir, '../../public/zcta-centroids.json');
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text) as ZctaCentroidMap;
}

async function fetchZctaJsonWeb(): Promise<ZctaCentroidMap> {
  const url = webAssetPath('/zcta-centroids.json');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ZCTA table (${res.status})`);
  }
  return (await res.json()) as ZctaCentroidMap;
}

async function importZctaJsonNative(): Promise<ZctaCentroidMap> {
  const payload = (await import('../../data/zcta-centroids.json')) as
    | ZctaCentroidMap
    | { default: ZctaCentroidMap };
  if (payload && typeof payload === 'object' && 'default' in payload && payload.default) {
    return payload.default;
  }
  return payload as ZctaCentroidMap;
}

async function loadZctaPayload(): Promise<ZctaCentroidMap> {
  if (typeof window === 'undefined') {
    return readZctaJsonFromDisk();
  }
  if (Platform.OS === 'web') {
    return fetchZctaJsonWeb();
  }
  return importZctaJsonNative();
}

/** Lazy-load Census ZCTA centroids (public domain). Not bundled into web entry/common. */
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
