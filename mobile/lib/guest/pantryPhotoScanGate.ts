/**
 * Pantry / shelf photo scan sign-in gate (web + native).
 * Guests are blocked only after auth has finished loading and there is no session.
 */

export type PantryPhotoScanGateInput = {
  demoMode: boolean;
  authReady: boolean;
  hasSession: boolean;
};

export type PantryPhotoScanGateState = 'allowed' | 'auth_loading' | 'guest_blocked';

export function pantryPhotoScanGateState(input: PantryPhotoScanGateInput): PantryPhotoScanGateState {
  if (input.demoMode) return 'allowed';
  if (!input.authReady) return 'auth_loading';
  if (!input.hasSession) return 'guest_blocked';
  return 'allowed';
}

export function shouldBlockGuestPantryPhotoScan(input: PantryPhotoScanGateInput): boolean {
  return pantryPhotoScanGateState(input) === 'guest_blocked';
}

export function shouldDeferPantryPhotoScanForAuth(input: PantryPhotoScanGateInput): boolean {
  return pantryPhotoScanGateState(input) === 'auth_loading';
}
