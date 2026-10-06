import appJson from '../../app.json';
import { haversineMiles } from '../../config/smartShop';
import type { GeocodedPoint } from './nominatim';

export type ZctaCentroidMap = Record<string, [number, number]>;

let loaded: ZctaCentroidMap | null = null;
let loadPromise: Promise<ZctaCentroidMap> | null = null;

function zctaPublicUrl(): string {
  const baseUrl = appJson.expo?.experiments?.baseUrl;
  const base =
    typeof baseUrl === 'string' && baseUrl.length > 0
      ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl)
      : '';
  return `${base}/zcta-centroids.json`;
}

async function loadZctaPayload(): Promise<ZctaCentroidMap> {
  const url = zctaPublicUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ZCTA table (${res.status})`);
  }
  return (await res.json()) as ZctaCentroidMap;
}

/** Lazy-load ZCTA centroids from static JSON (not in web entry/common). */
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
