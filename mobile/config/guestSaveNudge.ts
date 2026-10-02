/** Guest “save across devices” nudge — Home tab only; see `GuestSaveNudge` + eligibility helpers. */
export const GUEST_SAVE_NUDGE_CONFIG = {
  /** localStorage key for last dismiss timestamp (ms since epoch). */
  storageKey: 'mealprep.guestSaveNudge.dismissedAt',
  /** Hide the nudge for this long after the user taps dismiss (X). */
  dismissCooldownMs: 7 * 24 * 60 * 60 * 1000,
  eligibility: {
    /** Show once the guest has at least this many pantry items. */
    minPantryItems: 3,
    /** Show when the guest has at least one meal on the plan (saved meal). */
    minMealPlanItems: 1,
  },
  copy: {
    message: 'Save your pantry and meals across devices.',
    signInLabel: 'Sign in',
    dismissAccessibilityLabel: 'Dismiss save reminder',
  },
} as const;
