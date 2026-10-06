import { ACCOUNT_HEADER_COPY } from '../../config/appRoutes';

export type AccountHeaderChromeInput = {
  demoMode: boolean;
  hydrated: boolean;
  authReady: boolean;
  signedIn: boolean;
};

/** Accessibility label for the header account control (SSR-safe until auth is known). */
export function resolveAccountHeaderAccessibilityLabel(input: AccountHeaderChromeInput): string {
  const accountChromeReady = input.demoMode || input.authReady;
  const showGuestSignInLabel = input.hydrated && accountChromeReady && !input.signedIn;
  if (showGuestSignInLabel) {
    return ACCOUNT_HEADER_COPY.avatarAccessibilityLabelGuest;
  }
  if (input.signedIn) {
    return ACCOUNT_HEADER_COPY.avatarAccessibilityLabelSignedIn;
  }
  return ACCOUNT_HEADER_COPY.avatarAccessibilityLabelNeutral;
}
