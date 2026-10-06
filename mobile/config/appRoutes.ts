import type { Href } from 'expo-router';

/** Canonical in-app paths (use instead of string literals in navigation). */
export const APP_ROUTES = {
  home: '/' as Href,
  pantry: '/pantry' as Href,
  recipes: '/recipes' as Href,
  grocery: '/grocery' as Href,
  /** Legacy email links; screen redirects to home. */
  profile: '/profile' as Href,
  admin: '/admin' as Href,
  smartShop: '/smart-shop' as Href,
  discoverRecipes: '/discover-recipes' as Href,
  pantryStaples: '/pantry-staples' as Href,
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;

/** Post-auth email redirect (magic link / confirm). */
export const AUTH_EMAIL_REDIRECT_PATH = APP_ROUTES.home;

export const ACCOUNT_HEADER_COPY = {
  avatarAccessibilityLabelGuest: 'Sign in or open account',
  avatarAccessibilityLabelSignedIn: 'Open account',
} as const;
