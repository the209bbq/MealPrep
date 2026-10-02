/**
 * Guest save nudge eligibility + dismiss cooldown.
 */
import assert from 'node:assert/strict';
import { GUEST_SAVE_NUDGE_CONFIG } from '../config/guestSaveNudge.ts';
import {
  guestHasMeaningfulKitchenData,
  isGuestSaveNudgeDismissCooldownActive,
  shouldShowGuestSaveNudge,
} from '../lib/guest/guestSaveNudgeEligibility.ts';

const now = 1_700_000_000_000;

assert.equal(GUEST_SAVE_NUDGE_CONFIG.eligibility.minPantryItems, 3);
assert.equal(GUEST_SAVE_NUDGE_CONFIG.eligibility.minMealPlanItems, 1);
assert.equal(GUEST_SAVE_NUDGE_CONFIG.dismissCooldownMs, 7 * 24 * 60 * 60 * 1000);

assert.equal(guestHasMeaningfulKitchenData({ pantryItemCount: 0, mealPlanCount: 0 }), false);
assert.equal(guestHasMeaningfulKitchenData({ pantryItemCount: 2, mealPlanCount: 0 }), false);
assert.equal(guestHasMeaningfulKitchenData({ pantryItemCount: 3, mealPlanCount: 0 }), true);
assert.equal(guestHasMeaningfulKitchenData({ pantryItemCount: 0, mealPlanCount: 1 }), true);

assert.equal(isGuestSaveNudgeDismissCooldownActive(null, now), false);
assert.equal(
  isGuestSaveNudgeDismissCooldownActive(now - GUEST_SAVE_NUDGE_CONFIG.dismissCooldownMs + 1, now),
  true,
);
assert.equal(
  isGuestSaveNudgeDismissCooldownActive(now - GUEST_SAVE_NUDGE_CONFIG.dismissCooldownMs, now),
  false,
);

const base = {
  demoMode: false,
  hasSession: false,
  kitchen: { pantryItemCount: 5, mealPlanCount: 0 },
  dismissedAtMs: null as number | null,
  hydrated: true,
  nowMs: now,
};

assert.equal(shouldShowGuestSaveNudge(base), true);
assert.equal(shouldShowGuestSaveNudge({ ...base, hasSession: true }), false);
assert.equal(shouldShowGuestSaveNudge({ ...base, demoMode: true }), false);
assert.equal(shouldShowGuestSaveNudge({ ...base, hydrated: false }), false);
assert.equal(
  shouldShowGuestSaveNudge({ ...base, kitchen: { pantryItemCount: 1, mealPlanCount: 0 } }),
  false,
);
assert.equal(
  shouldShowGuestSaveNudge({ ...base, dismissedAtMs: now - 60_000 }),
  false,
);

console.log('guest-save-nudge-check: ok');
