import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { RECIPES_COPY } from '../config/recipesCopy';
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
        <Text className="text-sm font-bold text-ink">{RECIPES_COPY.guestSaveNudge.title}</Text>
        <Text className="mt-1 text-xs leading-5 text-muted">{RECIPES_COPY.guestSaveNudge.body}</Text>
        <Text className="mt-2 text-xs font-bold text-primary">{RECIPES_COPY.guestSaveNudge.cta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
    </Pressable>
  );
}
