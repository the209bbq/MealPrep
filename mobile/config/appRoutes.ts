import type { Href } from 'expo-router';

/** Canonical in-app paths (use instead of string literals in navigation). */
export const APP_ROUTES = {
  home: '/' as Href,
  pantry: '/pantry' as Href,
  recipes: '/recipes' as Href,
  grocery: '/grocery' as Href,
  profile: '/profile' as Href,
  admin: '/admin' as Href,
  smartShop: '/smart-shop' as Href,
  discoverRecipes: '/discover-recipes' as Href,
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;

/** Post-auth email redirect (magic link / confirm). */
export const AUTH_EMAIL_REDIRECT_PATH = APP_ROUTES.profile;

export const AUTH_HEADER_COPY = {
  signInLabel: 'Sign in',
  signInAccessibilityLabel: 'Sign in to your account',
} as const;
