import * as Linking from 'expo-linking';
import { AUTH_EMAIL_REDIRECT_PATH } from '../config/appRoutes';
import { getWebBasePath } from './webBasePath';

/** Redirect target for Supabase email links (magic link / confirm). Must match Auth URL config. */
export function getAuthRedirectUrl(path: string = String(AUTH_EMAIL_REDIRECT_PATH)): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${getWebBasePath()}${normalizedPath}`;
  }
  return Linking.createURL(normalizedPath.replace(/^\//, ''));
}
