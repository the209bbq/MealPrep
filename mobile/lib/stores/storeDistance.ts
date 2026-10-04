import { haversineMiles } from '../../config/smartShop';
import type { StoreLocation } from '../deals/types';
import type { StoreRecord } from './types';

export function roundDistanceMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

export function formatDistanceMiles(miles: number): string {
  return `${roundDistanceMiles(miles).toFixed(1)} mi`;
}

export function distanceMilesBetween(
  origin: { lat: number; lng: number },
  store: Pick<StoreLocation, 'lat' | 'lng'>,
): number | undefined {
  if (store.lat == null || store.lng == null) return undefined;
  return roundDistanceMiles(haversineMiles(origin, { lat: store.lat, lng: store.lng }));
}

export function withDistanceFromOrigin<T extends Pick<StoreLocation, 'lat' | 'lng' | 'distanceMiles'>>(
  store: T,
  origin: { lat: number; lng: number },
): T {
  const computed = distanceMilesBetween(origin, store);
  if (computed == null) return store;
  return { ...store, distanceMiles: computed };
}

export function withDistancesFromOrigin<T extends Pick<StoreLocation, 'lat' | 'lng' | 'distanceMiles'>>(
  stores: T[],
  origin: { lat: number; lng: number },
): T[] {
  return stores.map((s) => withDistanceFromOrigin(s, origin));
}

export function sortStoresByDistanceMiles<T extends Pick<StoreLocation, 'distanceMiles' | 'name'>>(
  stores: T[],
): T[] {
  return [...stores].sort((a, b) => {
    const da = a.distanceMiles ?? 9999;
    const db = b.distanceMiles ?? 9999;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
}

export function applyOriginDistancesAndSort(
  stores: StoreRecord[],
  origin: { lat: number; lng: number },
): StoreRecord[] {
  return sortStoresByDistanceMiles(withDistancesFromOrigin(stores, origin));
}
