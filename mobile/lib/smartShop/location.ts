import { Platform } from 'react-native';
import * as ExpoLocation from 'expo-location';

export interface ResolvedLocation {
  lat: number;
  lng: number;
  source: 'gps' | 'saved';
}

export async function requestDeviceLocation(): Promise<ResolvedLocation | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            source: 'gps',
          });
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
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    source: 'gps',
  };
}

export function isValidUsZip(zip: unknown): boolean {
  if (typeof zip !== 'string') return false;
  const trimmed = zip.trim();
  if (!trimmed) return false;
  return /^\d{5}(-\d{4})?$/.test(trimmed);
}

export function normalizeUsZipInput(zip: unknown): string {
  if (typeof zip !== 'string') return '';
  return zip.trim();
}
