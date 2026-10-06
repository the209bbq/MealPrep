import { Ionicons } from '../lib/icons/Ionicons';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GUEST_SAVE_NUDGE_CONFIG } from '../config/guestSaveNudge';
import { THEME } from '../config/appConfig';
import { useApp } from '../context/AppContext';
import { useHydrated } from '../hooks/useHydrated';
import { shouldShowGuestSaveNudge } from '../lib/guest/guestSaveNudgeEligibility';
import {
  readGuestSaveNudgeDismissedAt,
  writeGuestSaveNudgeDismissedAt,
} from '../lib/guest/guestSaveNudgeStorage';

const { copy } = GUEST_SAVE_NUDGE_CONFIG;

export function GuestSaveNudge({ className = 'mt-4' }: { className?: string }) {
  const { demoMode, session, pantry, mealPlan, openAuthSheet, authReady } = useApp();
  const hydrated = useHydrated();
  const [dismissedAtOverrideMs, setDismissedAtOverrideMs] = useState<number | null>(null);
  const dismissedAtMs =
    dismissedAtOverrideMs ?? (hydrated ? readGuestSaveNudgeDismissedAt() : null);

  const visible = authReady && shouldShowGuestSaveNudge({
    demoMode,
    hasSession: session != null,
    kitchen: { pantryItemCount: pantry.length, mealPlanCount: mealPlan.length },
    dismissedAtMs,
    hydrated,
  });

  const dismiss = useCallback(() => {
    const now = Date.now();
    writeGuestSaveNudgeDismissedAt(now);
    setDismissedAtOverrideMs(now);
  }, []);

  if (!visible) return null;

  return (
    <View
      className={`flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 ${className}`}
    >
      <Text className="min-w-0 flex-1 text-xs text-muted" numberOfLines={1}>
        {copy.message}
      </Text>
      <Pressable
        onPress={openAuthSheet}
        accessibilityRole="button"
        className="rounded-lg bg-primary px-2.5 py-1.5"
      >
        <Text className="text-xs font-bold text-on-primary">{copy.signInLabel}</Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={copy.dismissAccessibilityLabel}
        hitSlop={8}
        className="p-1"
      >
        <Ionicons name="close" size={18} color={THEME.muted} />
      </Pressable>
    </View>
  );
}
