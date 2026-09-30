import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PANTRY_SCAN_TIP } from '../config/pantryStorage';
import { readJson, writeJson } from '../lib/storage';

interface PantryScanTipProps {
  className?: string;
}

export function PantryScanTip({ className = '' }: PantryScanTipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = readJson<boolean>(PANTRY_SCAN_TIP.dismissStorageKey, false);
    setVisible(!dismissed);
  }, []);

  function dismiss() {
    writeJson(PANTRY_SCAN_TIP.dismissStorageKey, true);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <View className={`rounded-xl border border-emerald/30 bg-emerald-light/40 px-3 py-2 ${className}`}>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-xs leading-5 text-emerald-dark">{PANTRY_SCAN_TIP.message}</Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss scan tip"
          hitSlop={8}
        >
          <Text className="text-xs font-bold text-emerald-dark">Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
