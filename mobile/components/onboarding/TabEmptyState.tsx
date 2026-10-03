import type { ComponentProps } from 'react';
import { Ionicons } from '../../lib/icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { HydrationSafeIonicon } from '../HydrationSafeIonicon';
import { ONBOARDING_COPY, type OnboardingTabEmptyId } from '../../config/onboarding';
import { THEME } from '../../config/appConfig';

type TabEmptyStateProps = {
  tab: OnboardingTabEmptyId;
  className?: string;
};

/** Shared empty state with one clear next action for new users. */
export function TabEmptyState({ tab, className = 'mt-4' }: TabEmptyStateProps) {
  const copy = ONBOARDING_COPY.emptyStates[tab];

  return (
    <View
      className={`items-center rounded-3xl border border-dashed border-border bg-card px-6 py-10 ${className}`}
      accessibilityRole="summary"
    >
      <View className="mb-4 rounded-full bg-primary-light p-4">
        <HydrationSafeIonicon name={copy.icon as ComponentProps<typeof Ionicons>['name']} size={40} color={THEME.primary} />
      </View>
      <Text className="text-center text-lg font-bold text-ink">{copy.title}</Text>
      <Text className="mt-2 text-center text-sm leading-6 text-muted">{copy.body}</Text>
      <Pressable
        onPress={() => router.push(copy.href)}
        accessibilityRole="button"
        className="mt-5 min-h-[48px] w-full max-w-xs items-center justify-center rounded-2xl bg-primary px-5 py-3"
      >
        <Text className="text-base font-bold text-on-primary">{copy.ctaLabel}</Text>
      </Pressable>
    </View>
  );
}
