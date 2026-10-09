import { Pressable, Text, View } from 'react-native';
import { SEAMLESS_FLOW_COPY } from '../../config/seamlessFlow';

export interface CookConfirmBannerProps {
  title: string;
  onYes: () => void;
  onNotThisTime: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

export function CookConfirmBanner({
  title,
  onYes,
  onNotThisTime,
  onDismiss,
  busy = false,
}: CookConfirmBannerProps) {
  return (
    <View className="mt-4 rounded-[18px] border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[15px] font-bold text-ink">
          {SEAMLESS_FLOW_COPY.cookConfirmQuestion(title)}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="-mr-2 -mt-2 h-11 w-11 items-center justify-center"
        >
          <Text className="text-lg leading-none text-muted">×</Text>
        </Pressable>
      </View>
      <View className="mt-2 flex-row gap-2">
        <Pressable
          onPress={onYes}
          disabled={busy}
          className="min-h-[44px] flex-1 items-center justify-center rounded-full bg-primary px-3"
          style={({ pressed }) => ({ opacity: pressed || busy ? 0.85 : 1 })}
        >
          <Text className="text-sm font-bold text-on-primary">{SEAMLESS_FLOW_COPY.cookConfirmYes}</Text>
        </Pressable>
        <Pressable
          onPress={onNotThisTime}
          disabled={busy}
          className="min-h-[44px] flex-1 items-center justify-center rounded-full border border-border bg-card px-3"
          style={({ pressed }) => ({ opacity: pressed || busy ? 0.85 : 1 })}
        >
          <Text className="text-sm font-bold text-ink">{SEAMLESS_FLOW_COPY.cookConfirmNotThisTime}</Text>
        </Pressable>
      </View>
    </View>
  );
}
