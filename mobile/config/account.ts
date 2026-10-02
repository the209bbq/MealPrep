import { githubPagesLegalUrl } from './legalPages';

export const ACCOUNT_SHEET_COPY = {
  authTitle: 'Your account',
  accountTitle: 'Account',
  signInTab: 'Sign in',
  signUpTab: 'Create account',
  signOut: 'Sign out',
  deleteAccount: 'Delete account',
  deleteAccountConfirmTitle: 'Delete your account?',
  deleteAccountConfirmBody:
    'This permanently removes your pantry, recipes, grocery list, meal plan, and profile. Community store prices you shared may stay visible without your name. This cannot be undone.',
  deleteAccountConfirmAction: 'Yes, delete my account',
  deleteAccountCancel: 'Cancel',
  adminEntryLabel: 'Admin tools',
  postSignupTitle: 'Quick profile setup',
  postSignupSubtitle: 'Optional — you can change these anytime from your avatar.',
  postSignupSkip: 'Skip',
  postSignupSave: 'Save & continue',
  householdLabel: 'Household size',
  householdBlurb: 'Default servings when scaling recipes.',
  homeZipLabel: 'Home ZIP',
  homeZipBlurb: 'Used for nearby store search.',
  dietaryNotesLabel: 'Dietary notes',
  displayNameLabel: 'Display name',
  changePhoto: 'Change photo',
  removePhoto: 'Remove photo',
  guestAvatarLabel: 'Sign in or create account',
} as const;

export const LEGAL_LINKS = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || githubPagesLegalUrl('privacy'),
  terms: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || githubPagesLegalUrl('terms'),
} as const;

export const ACCOUNT_UPGRADE_COPY = {
  title: 'MealPlanatic Plus',
  freeBlurb: 'Manual pantry and recipes are free. Upgrade for photo scan and Smart Shop shelf tags.',
  paidBlurb: 'You have Plus — photo scan and shelf-tag capture are unlocked.',
  learnMoreLabel: 'Learn about Plus',
} as const;

export const POST_SIGNUP_SETUP_STORAGE_KEY = 'mealprep.postSignupProfileSetupDone';

/** Post-auth email redirect path segment (home). */
export const AUTH_EMAIL_REDIRECT_ROUTE = '/' as const;

/** Min/max household members for profile setup. */
export const HOUSEHOLD_SIZE_LIMITS = { min: 1, max: 12 } as const;
