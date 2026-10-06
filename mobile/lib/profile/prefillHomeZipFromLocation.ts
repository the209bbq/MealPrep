import { Platform } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { queryStoresGeolocationPermissionForPlatform } from '../stores/storesGeolocation';
import { requestStoresDeviceLocation } from '../stores/requestStoresLocation';
export type HomeLocationPrefill = {
  zip?: string;
  lat: number;
  lng: number;
};

/** When location permission is already granted, resolve ZIP (and coords) without prompting. */
export async function prefillHomeZipFromGrantedLocation(): Promise<HomeLocationPrefill | null> {
  const permission = await queryStoresGeolocationPermissionForPlatform();
  if (permission !== 'granted') return null;

  const resolved = await requestStoresDeviceLocation();
  if (!resolved) return null;

  let zip: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      const places = await ExpoLocation.reverseGeocodeAsync({
        latitude: resolved.lat,
        longitude: resolved.lng,
      });
      const postal = places[0]?.postalCode?.trim() ?? '';
      if (/^\d{5}/.test(postal)) {
        zip = postal.slice(0, 5);
      }
    } catch {
      // No ZCTA lookup outside Stores tab — coords only when reverse geocode fails.
    }
  }
  return { lat: resolved.lat, lng: resolved.lng, zip };
}
