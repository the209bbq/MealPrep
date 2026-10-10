import type { UserRole } from '../types/mealprep';

/** Paid tiers; see `config/familyPlans.ts` for future `family` placeholder. */
export const USER_PLANS = ['free', 'paid'] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const DEFAULT_USER_PLAN: UserPlan = 'free';

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: 'Free',
  paid: 'MealPlanatic Plus',
};

export const PLANS_COPY = {
  photoScanUpgradeTitle: 'Photo scanning is a Plus feature',
  photoScanUpgradeBody:
    'Upgrade to MealPlanatic Plus to scan pantry shelves, upload photos, and snap shelf tags in Smart Shop. Manual entry stays free.',
  photoScanProfileLoading: 'Loading your plan… try again in a moment.',
  photoScanProfileLoadingTitle: 'One moment',
  /** Badge on the scan card for a free account that still has free scans. */
  freeScansLeftBadge: (remaining: number) => `${remaining} free`,
  freeScansLeftNote: (remaining: number) =>
    remaining === 1
      ? 'You have 1 free scan left. After that, scanning is part of MealPlanatic Plus.'
      : `You have ${remaining} free scans left. After that, scanning is part of MealPlanatic Plus.`,
  freeScansUsedNote: 'That was your last free scan. Scanning is part of MealPlanatic Plus.',
} as const;

/**
 * One-time free shelf scans for a free account, so a new user can try the scanner before paying.
 * The server enforces the real number (secret PANTRY_FREE_TOTAL_SCANS, default 3); this copy is
 * only used to show how many are left. Receipts and price tags are Plus only.
 */
export const FREE_PHOTO_SCANS = 3;

/** Admins always have Plus photo-scan access (same as paid). */
export function hasPlusPhotoScanAccess(plan: UserPlan, role: UserRole): boolean {
  return role === 'admin' || plan === 'paid';
}

export function isUserPlan(value: string): value is UserPlan {
  return (USER_PLANS as readonly string[]).includes(value);
}
