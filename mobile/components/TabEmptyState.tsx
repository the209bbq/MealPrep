import type { ComponentProps } from 'react';
import { Ionicons } from '../lib/icons/Ionicons';
import { Text, View } from 'react-native';
import { HydrationSafeIonicon } from './HydrationSafeIonicon';
import { TAB_EMPTY_COPY, type TabEmptyCopyId } from '../config/tabEmptyCopy';
import { THEME } from '../config/appConfig';

type TabEmptyStateProps = {
  tab: TabEmptyCopyId;
  className?: string;
};

export function TabEmptyState({ tab, className = 'mt-4' }: TabEmptyStateProps) {
  const copy = TAB_EMPTY_COPY[tab];

  return (
    <View
      className={`items-center rounded-3xl border border-dashed border-border bg-card px-6 py-10 ${className}`}
      accessibilityRole="summary"
    >
      <View className="mb-4 rounded-full bg-primary-light p-4">
        <HydrationSafeIonicon
          name={copy.icon as ComponentProps<typeof Ionicons>['name']}
          size={40}
          color={THEME.primary}
        />
      </View>
      <Text className="text-center text-lg font-bold text-ink">{copy.title}</Text>
      <Text className="mt-2 text-center text-sm leading-6 text-muted">{copy.body}</Text>
    </View>
  );
}
