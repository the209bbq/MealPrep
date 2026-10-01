import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GUEST_MODE_COPY } from '../config/guestMode';
import { THEME } from '../config/appConfig';
import { useApp } from '../context/AppContext';

export function GuestSaveNudge({ className = 'mt-4' }: { className?: string }) {
  const { demoMode, session } = useApp();
  if (demoMode || session) return null;

  return (
    <Pressable
      onPress={() => router.push('/admin')}
      className={`flex-row items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 ${className}`}
      accessibilityRole="button"
    >
      <Ionicons name="cloud-upload-outline" size={22} color={THEME.primary} />
      <View className="flex-1">
        <Text className="text-sm font-bold text-ink">{GUEST_MODE_COPY.saveNudgeTitle}</Text>
        <Text className="mt-1 text-xs leading-5 text-muted">{GUEST_MODE_COPY.saveNudgeBody}</Text>
        <Text className="mt-2 text-xs font-bold text-emerald">{GUEST_MODE_COPY.saveNudgeCta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
    </Pressable>
  );
}
