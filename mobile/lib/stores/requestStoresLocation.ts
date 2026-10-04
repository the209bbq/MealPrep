import { Platform } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { roundCoordsForPrivacy } from './geoPrivacy';

export interface StoresResolvedLocation {
  lat: number;
  lng: number;
  source: 'gps' | 'saved';
}

/** Device location for Stores tab (rounded; never returns raw GPS). */
export async function requestStoresDeviceLocation(): Promise<StoresResolvedLocation | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const rounded = roundCoordsForPrivacy(pos.coords.latitude, pos.coords.longitude);
          resolve({ ...rounded, source: 'gps' });
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600_000 },
      );
    });
  }

  const permission = await ExpoLocation.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Balanced,
  });
  const rounded = roundCoordsForPrivacy(position.coords.latitude, position.coords.longitude);
  return { ...rounded, source: 'gps' };
}
