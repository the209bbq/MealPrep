import { Platform } from 'react-native';
import { readJson, writeJson } from '../storage';

const DENIED_KEY = 'stores:geolocation:denied';

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt';

export function readStoresGeolocationDenied(): boolean {
  return readJson<boolean>(DENIED_KEY, false);
}

export function markStoresGeolocationDenied(): void {
  writeJson(DENIED_KEY, true);
}

/** Web: query Permissions API before calling getCurrentPosition. */
export async function queryStoresGeolocationPermission(): Promise<GeolocationPermissionState | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'prompt';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') {
      markStoresGeolocationDenied();
      return 'denied';
    }
    return 'prompt';
  } catch {
    return 'prompt';
  }
}
