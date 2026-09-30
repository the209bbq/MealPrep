import { readJson, writeJson } from '../storage';

const KEYS = {
  zip: 'mealprep.smartShop.zip',
  savedStoreIds: 'mealprep.smartShop.savedStoreIds',
  coords: 'mealprep.smartShop.coords',
} as const;

export interface SavedCoords {
  lat: number;
  lng: number;
  updatedAt: string;
}

export function readSavedZip(): string {
  return readJson(KEYS.zip, '');
}

export function writeSavedZip(zip: string): void {
  writeJson(KEYS.zip, zip.trim());
}

export function readSavedStoreIds(): string[] {
  return readJson(KEYS.savedStoreIds, []);
}

export function writeSavedStoreIds(ids: string[]): void {
  writeJson(KEYS.savedStoreIds, ids);
}

export function readSavedCoords(): SavedCoords | null {
  return readJson<SavedCoords | null>(KEYS.coords, null);
}

export function writeSavedCoords(coords: SavedCoords | null): void {
  if (!coords) writeJson(KEYS.coords, null);
  else writeJson(KEYS.coords, coords);
}
