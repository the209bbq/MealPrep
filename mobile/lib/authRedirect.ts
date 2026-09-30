import * as Linking from 'expo-linking';
import { getWebBasePath } from './webBasePath';

/** Redirect target for Supabase email links (magic link / confirm). Must match Auth URL config. */
export function getAuthRedirectUrl(path = '/admin'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${getWebBasePath()}${normalizedPath}`;
  }
  return Linking.createURL(normalizedPath.replace(/^\//, ''));
}
