/** Local-only kitchen data for signed-out users (live Supabase apps). */
export const GUEST_OWNER_ID = 'guest-local';

export const GUEST_KITCHEN_STORAGE_KEYS = {
  pantry: 'mealprep.guest.pantry',
  grocery: 'mealprep.guest.grocery',
} as const;

export const GUEST_MODE_COPY = {
  saveNudgeTitle: 'Save across devices',
  saveNudgeBody: 'Sign in anytime to sync your pantry and grocery list to your account. Your list stays on this device until then.',
  saveNudgeCta: 'Sign in',
  pantryScanSignIn: 'Sign in to scan with your camera.',
  pantryScanSignInTitle: 'Camera scan',
  recipeSearchUnavailable: 'Recipe search is unavailable right now. Check your connection or try again shortly.',
} as const;
