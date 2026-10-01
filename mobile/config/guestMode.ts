/** Local-only kitchen data for signed-out users (live Supabase apps). */
export const GUEST_OWNER_ID = 'guest-local';

export const GUEST_KITCHEN_STORAGE_KEYS = {
  pantry: 'mealprep.guest.pantry',
  grocery: 'mealprep.guest.grocery',
} as const;

export const GUEST_MODE_COPY = {
  pantryScanSignIn: 'Sign in to scan with your camera.',
  pantryScanSignInTitle: 'Camera scan',
} as const;
