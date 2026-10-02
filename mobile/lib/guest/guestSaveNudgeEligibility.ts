import { GUEST_SAVE_NUDGE_CONFIG } from '../../config/guestSaveNudge';

export type GuestSaveNudgeKitchenSnapshot = {
  pantryItemCount: number;
  mealPlanCount: number;
};

export function guestHasMeaningfulKitchenData(snapshot: GuestSaveNudgeKitchenSnapshot): boolean {
  const { minPantryItems, minMealPlanItems } = GUEST_SAVE_NUDGE_CONFIG.eligibility;
  return snapshot.pantryItemCount >= minPantryItems || snapshot.mealPlanCount >= minMealPlanItems;
}

export function isGuestSaveNudgeDismissCooldownActive(
  dismissedAtMs: number | null,
  nowMs = Date.now(),
): boolean {
  if (dismissedAtMs == null) return false;
  return nowMs - dismissedAtMs < GUEST_SAVE_NUDGE_CONFIG.dismissCooldownMs;
}

export function shouldShowGuestSaveNudge(input: {
  demoMode: boolean;
  hasSession: boolean;
  kitchen: GuestSaveNudgeKitchenSnapshot;
  dismissedAtMs: number | null;
  hydrated: boolean;
  nowMs?: number;
}): boolean {
  if (!input.hydrated) return false;
  if (input.demoMode || input.hasSession) return false;
  if (!guestHasMeaningfulKitchenData(input.kitchen)) return false;
  if (isGuestSaveNudgeDismissCooldownActive(input.dismissedAtMs, input.nowMs)) return false;
  return true;
}
