import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { RECIPES_COPY } from '../../config/recipesCopy';

export function HomeRecipesRefreshButton({
  refreshing,
  statusMessage,
  onPress,
  visible,
}: {
  refreshing: boolean;
  statusMessage: string | null;
  onPress: () => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <View className="mt-3 flex-row items-center justify-end gap-2">
      {statusMessage ? (
        <Text className="text-xs font-medium text-success-accent" accessibilityLiveRegion="polite">
          {statusMessage}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={refreshing}
        accessibilityRole="button"
        accessibilityLabel={RECIPES_COPY.homeToolbarCard.refreshRecipes}
        accessibilityState={{ busy: refreshing }}
        className="min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-border bg-card"
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={THEME.primary} />
        ) : (
          <Ionicons name="refresh" size={20} color={THEME.primary} />
        )}
      </Pressable>
    </View>
  );
}
