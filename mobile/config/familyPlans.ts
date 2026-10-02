import type { UserPlan } from './plans';

/**
 * Placeholder for future household / family subscription tiers.
 * No UI yet — import this hook when billing supports shared plans.
 */
export type FamilyPlanTier = UserPlan | 'family';

export const FAMILY_PLANS_CONFIG = {
  /** Reserved plan slug for a future family SKU (not in USER_PLANS yet). */
  familyPlanPlaceholder: 'family' as const satisfies FamilyPlanTier,
  /** Household size on the profile may later map to shared kitchen seats. */
  usesHouseholdSizeForSeats: true,
} as const;

export function isFamilyPlanPlaceholder(plan: string): plan is 'family' {
  return plan === FAMILY_PLANS_CONFIG.familyPlanPlaceholder;
}
