/** Local-only kitchen data for signed-out users (live Supabase apps). */
export const GUEST_OWNER_ID = 'guest-local';

export const GUEST_KITCHEN_STORAGE_KEYS = {
  pantry: 'mealprep.guest.pantry',
  grocery: 'mealprep.guest.grocery',
  mealPlan: 'mealprep.guest.mealPlan',
  recipes: 'mealprep.guest.recipes',
} as const;

export const GUEST_MODE_COPY = {
  pantryScanSignIn: 'Sign in to scan or upload pantry photos.',
  pantryScanSignInTitle: 'Photo scan',
  pantryScanSignInCta: 'Sign in',
  pantryScanAuthLoading: 'Checking your sign-in… try again in a moment.',
  pantryScanAuthLoadingTitle: 'One moment',
} as const;
