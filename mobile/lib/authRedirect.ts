import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

function webBasePath(): string {
  const baseUrl = Constants.expoConfig?.experiments?.baseUrl;
  if (typeof baseUrl === 'string' && baseUrl.length > 0) {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }
  return '';
}

/** Redirect target for Supabase email links (magic link / confirm). Must match Auth URL config. */
export function getAuthRedirectUrl(path = '/admin'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${webBasePath()}${normalizedPath}`;
  }
  return Linking.createURL(normalizedPath.replace(/^\//, ''));
}
