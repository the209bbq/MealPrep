import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ONBOARDING_COPY } from '../config/onboarding';
import { THEME } from '../config/appConfig';
import { TabEmptyState } from './onboarding/TabEmptyState';

interface RecipesEmptyStateProps {
  pantryEmpty: boolean;
}

export function RecipesEmptyState({ pantryEmpty }: RecipesEmptyStateProps) {
  if (pantryEmpty) {
    return <TabEmptyState tab="recipes" />;
  }

  return (
    <View className="mt-4 items-center rounded-3xl border border-dashed border-border bg-card px-6 py-10">
      <View className="mb-4 rounded-full bg-primary-light p-4">
        <Ionicons name="restaurant-outline" size={40} color={THEME.primary} />
      </View>
      <Text className="text-center text-lg font-bold text-ink">No strong matches yet</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-muted">
        Add a few staples or loosen filters (defaults: 50%+ match, at least 2 ingredients).
      </Text>
      <Pressable
        onPress={() => router.push('/pantry')}
        className="mt-5 min-h-[48px] items-center justify-center rounded-2xl border border-border bg-paper px-5 py-3"
      >
        <Text className="text-sm font-bold text-ink">{ONBOARDING_COPY.emptyStates.pantry.ctaLabel}</Text>
      </Pressable>
    </View>
  );
}
