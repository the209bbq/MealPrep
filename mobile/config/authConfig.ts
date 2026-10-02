/** Auth UI feature flags (Supabase OTP / magic-link code paths stay in AppContext). */
export const AUTH_CONFIG = {
  magicLinkEnabled: false,
} as const;

const AUTH_CARD_BLURB_WITH_MAGIC_LINK =
  'Sign in with your email and password, or get a one-tap sign-in link by email.';

const AUTH_CARD_BLURB_PASSWORD_ONLY = 'Sign in with your email and password.';

export const AUTH_MAGIC_LINK_COPY = {
  buttonLabel: 'Email magic link',
  successMessage: 'Magic link sent — check your email.',
} as const;

export function isMagicLinkSignInEnabled(): boolean {
  return AUTH_CONFIG.magicLinkEnabled;
}

export function getAuthCardBlurb(): string {
  return isMagicLinkSignInEnabled() ? AUTH_CARD_BLURB_WITH_MAGIC_LINK : AUTH_CARD_BLURB_PASSWORD_ONLY;
}
