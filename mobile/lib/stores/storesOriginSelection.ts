import { STORES_TAB_DEFAULT_ZIP } from '../../config/storesTab';
import type { UserProfile } from '../../types/mealprep';
import { isValidUsZip, normalizeUsZipInput } from '../smartShop/usZip';
import { coordsForStoreSearch } from '../smartShop/coordsResolve';
import { readSavedCoords, readSavedZip } from '../smartShop/storage';
import { readJson, writeJson } from '../storage';

export type StoresGeoPermissionState = 'granted' | 'denied' | 'prompt';

const ORIGIN_MODE_KEY = 'stores:originMode';

export type StoresOriginMode = 'gps' | 'zip';

export function readStoresOriginMode(): StoresOriginMode | null {
  const raw = readJson<string | null>(ORIGIN_MODE_KEY, null);
  if (raw === 'gps' || raw === 'zip') return raw;
  return null;
}

export function writeStoresOriginMode(mode: StoresOriginMode): void {
  writeJson(ORIGIN_MODE_KEY, mode);
}

/** ZIP shown in inputs; prefers local saved ZIP when profile sync is behind. */
export function resolveInitialStoresZipInput(profile: UserProfile): string {
  const saved = normalizeUsZipInput(readSavedZip());
  const profileZip = normalizeUsZipInput(profile.homeZip ?? '');
  if (isValidUsZip(saved) && isValidUsZip(profileZip) && saved !== profileZip) {
    return saved.slice(0, 5);
  }
  if (isValidUsZip(profileZip)) return profileZip.slice(0, 5);
  if (isValidUsZip(saved)) return saved.slice(0, 5);
  return STORES_TAB_DEFAULT_ZIP;
}

export function effectiveStoresSearchZip(profile: UserProfile, zipInput: string): string {
  if (isValidUsZip(zipInput)) return zipInput.trim().slice(0, 5);
  return resolveInitialStoresZipInput(profile);
}

/** User explicitly chose ZIP search (saved via Stores tab). */
export function storesPrefersManualZip(): boolean {
  return readStoresOriginMode() === 'zip';
}

export function storesHasGpsOriginSaved(profile: UserProfile): boolean {
  if (readStoresOriginMode() === 'zip') return false;
  if (readSavedCoords()) return true;
  const profileZip = (profile.homeZip ?? '').trim();
  if (profileZip) return false;
  if (profile.homeLat != null && profile.homeLng != null) return true;
  return false;
}

export function resolveStoresSearchCoords(
  profile: UserProfile,
  _searchZip: string,
): { lat: number; lng: number } | undefined {
  const mode = readStoresOriginMode();
  const savedCoords = readSavedCoords();

  if (mode === 'zip') {
    return undefined;
  }

  if (mode === 'gps') {
    if (savedCoords) {
      return { lat: savedCoords.lat, lng: savedCoords.lng };
    }
    return coordsForStoreSearch({
      savedCoords: null,
      profileZip: profile.homeZip,
      savedZip: readSavedZip(),
      profileLat: profile.homeLat,
      profileLng: profile.homeLng,
    });
  }

  if (savedCoords) {
    return { lat: savedCoords.lat, lng: savedCoords.lng };
  }

  const savedZip = normalizeUsZipInput(readSavedZip());
  const profileZip = normalizeUsZipInput(profile.homeZip ?? '');
  const zipForCoords = isValidUsZip(profileZip) ? profileZip : savedZip;

  return coordsForStoreSearch({
    savedCoords: null,
    profileZip: zipForCoords,
    savedZip,
    profileLat: profile.homeLat,
    profileLng: profile.homeLng,
  });
}

export function shouldShowStoresLocationPrePrompt(input: {
  hydrated: boolean;
  geoPermission: StoresGeoPermissionState | null;
  geolocationDeniedLocal: boolean;
  prefersManualZip: boolean;
  hasGpsOriginSaved: boolean;
}): boolean {
  if (!input.hydrated) return false;
  if (input.prefersManualZip) return false;
  if (input.hasGpsOriginSaved) return false;
  if (input.geolocationDeniedLocal || input.geoPermission === 'denied') return false;
  if (input.geoPermission === 'granted') return false;
  if (input.geoPermission === 'prompt') return true;
  return false;
}

export function shouldAutoLocateStoresOnOpen(input: {
  hydrated: boolean;
  geoPermission: StoresGeoPermissionState | null;
  geolocationDeniedLocal: boolean;
  prefersManualZip: boolean;
  autoLocateAlreadyAttempted: boolean;
}): boolean {
  if (!input.hydrated || input.autoLocateAlreadyAttempted) return false;
  if (input.prefersManualZip) return false;
  if (input.geolocationDeniedLocal || input.geoPermission === 'denied') return false;
  return input.geoPermission === 'granted';
}
