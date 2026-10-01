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
  if (!hasPlusPhotoScanAccess(input.plan, input.role)) return 'plan_blocked';
  return 'allowed';
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
