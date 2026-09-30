import Constants from 'expo-constants';

/** GitHub Pages subpath from `app.json` → `experiments.baseUrl` (no trailing slash). */
export function getWebBasePath(): string {
  const baseUrl = Constants.expoConfig?.experiments?.baseUrl;
  if (typeof baseUrl === 'string' && baseUrl.length > 0) {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }
  return '';
}

/** Absolute site path for a file under the Expo web base (e.g. `/MealPrep/app/manifest.webmanifest`). */
export function webAssetPath(relativePath: string): string {
  const base = getWebBasePath();
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${normalized}`;
}
