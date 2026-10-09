import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PANTRY_SCAN_TIP } from '../config/pantryStorage';
import { useHydrated } from '../hooks/useHydrated';
import { readJson, writeJson } from '../lib/storage';

interface PantryScanTipProps {
  className?: string;
}

export function PantryScanTip({ className = '' }: PantryScanTipProps) {
  const hydrated = useHydrated();
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const dismissedInStorage = hydrated ? readJson<boolean>(PANTRY_SCAN_TIP.dismissStorageKey, false) : false;
  const visible = hydrated && !dismissedLocally && !dismissedInStorage;

  function dismiss() {
    writeJson(PANTRY_SCAN_TIP.dismissStorageKey, true);
    setDismissedLocally(true);
  }

  if (!visible) return null;

  return (
    <View className={`rounded-[18px] border border-primary/30 bg-primary-light/40 px-4 py-2 ${className}`}>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 py-2 text-sm leading-5 text-primary-dark">{PANTRY_SCAN_TIP.message}</Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss scan tip"
          className="min-h-[44px] items-center justify-center px-1"
        >
          <Text className="text-sm font-bold text-primary-dark">Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
