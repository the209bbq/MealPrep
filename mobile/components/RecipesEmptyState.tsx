import { Text, View } from 'react-native';
import { HydrationSafeIonicon } from './HydrationSafeIonicon';
import { RECIPES_COPY } from '../config/recipesCopy';
import { THEME } from '../config/appConfig';
import { TabEmptyState } from './TabEmptyState';

interface RecipesEmptyStateProps {
  pantryEmpty: boolean;
}

export function RecipesEmptyState({ pantryEmpty }: RecipesEmptyStateProps) {
  if (pantryEmpty) {
    return <TabEmptyState tab="recipes_pantry" />;
  }

  return (
    <View className="mt-4 items-center rounded-3xl border border-dashed border-border bg-card px-6 py-10">
      <View className="mb-4 rounded-full bg-primary-light p-4">
        <HydrationSafeIonicon name="restaurant-outline" size={40} color={THEME.primary} />
      </View>
      <Text className="text-center text-lg font-bold text-ink">{RECIPES_COPY.emptyState.title}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-muted">{RECIPES_COPY.emptyState.body}</Text>
    </View>
  );
}
