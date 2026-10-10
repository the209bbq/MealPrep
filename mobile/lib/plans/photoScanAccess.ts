import { GUEST_MODE_COPY } from '../../config/guestMode';
import { hasPlusPhotoScanAccess, PLANS_COPY, type UserPlan } from '../../config/plans';
import {
  pantryPhotoScanGateState,
  type PantryPhotoScanGateInput,
} from '../guest/pantryPhotoScanGate';
import type { UserRole } from '../../types/mealprep';

export type PhotoScanAccessInput = PantryPhotoScanGateInput & {
  plan: UserPlan;
  role: UserRole;
  /** True once the signed-in user's profile row is loaded (live Supabase). Demo mode: always true. */
  profileReady: boolean;
  /**
   * One-time free shelf scans a free account still has. Leave unset (or 0) for scans that are
   * Plus only (receipts, price tags): the plan gate then applies as before.
   */
  freeScansRemaining?: number;
};

export type PhotoScanAccessState =
  | 'allowed'
  | 'auth_loading'
  | 'guest_blocked'
  | 'profile_loading'
  | 'plan_blocked';

export function photoScanAccessState(input: PhotoScanAccessInput): PhotoScanAccessState {
  if (input.demoMode) return 'allowed';
  const guestState = pantryPhotoScanGateState(input);
  if (guestState === 'auth_loading') return 'auth_loading';
  if (guestState === 'guest_blocked') return 'guest_blocked';
  if (!input.profileReady) return 'profile_loading';
  if (hasPlusPhotoScanAccess(input.plan, input.role)) return 'allowed';
  // A signed-in free account may use its one-time free scans; the server has the final say.
  if ((input.freeScansRemaining ?? 0) > 0) return 'allowed';
  return 'plan_blocked';
}

export function shouldBlockPhotoScanForPlan(input: PhotoScanAccessInput): boolean {
  return photoScanAccessState(input) === 'plan_blocked';
}

export function shouldDeferPhotoScanForProfile(input: PhotoScanAccessInput): boolean {
  return photoScanAccessState(input) === 'profile_loading';
}

export function photoScanAccessUserMessage(
  access: PhotoScanAccessState,
): { title: string; message: string } | null {
  switch (access) {
    case 'auth_loading':
      return {
        title: GUEST_MODE_COPY.pantryScanAuthLoadingTitle,
        message: GUEST_MODE_COPY.pantryScanAuthLoading,
      };
    case 'profile_loading':
      return {
        title: PLANS_COPY.photoScanProfileLoadingTitle,
        message: PLANS_COPY.photoScanProfileLoading,
      };
    case 'guest_blocked':
      return {
        title: GUEST_MODE_COPY.pantryScanSignInTitle,
        message: GUEST_MODE_COPY.pantryScanSignIn,
      };
    case 'plan_blocked':
      return {
        title: PLANS_COPY.photoScanUpgradeTitle,
        message: PLANS_COPY.photoScanUpgradeBody,
      };
    default:
      return null;
  }
}
