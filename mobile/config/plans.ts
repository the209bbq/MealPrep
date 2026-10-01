import type { UserRole } from '../types/mealprep';

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
} as const;

/** Admins always have Plus photo-scan access (same as paid). */
export function hasPlusPhotoScanAccess(plan: UserPlan, role: UserRole): boolean {
  return role === 'admin' || plan === 'paid';
}

export function isUserPlan(value: string): value is UserPlan {
  return (USER_PLANS as readonly string[]).includes(value);
}
