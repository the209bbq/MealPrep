import { router } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { APP_ROUTES } from '../../config/appRoutes';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { THEME } from '../../config/appConfig';
import { Card } from '../Card';

const NARROW_WIDTH = 420;

export function HomePantryCta() {
  const { description, buttonLabel } = RECIPES_COPY.homePantryPrompt;
  const { width } = useWindowDimensions();
  const stackButton = width < NARROW_WIDTH;

  if (stackButton) {
    return (
      <Card className="mt-4 p-3">
        <Text className="text-sm text-muted">{description}</Text>
        <Pressable
          onPress={() => router.push(APP_ROUTES.pantry)}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          className="mt-3 items-center justify-center rounded-xl bg-primary px-3 py-2.5"
          style={({ pressed }) => ({
            opacity: pressed ? 0.72 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text className="text-xs font-bold text-on-primary">{buttonLabel}</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-3">
      <View className="flex-row items-center gap-3">
        <Text className="min-w-0 flex-1 text-sm text-muted">{description}</Text>
        <Pressable
          onPress={() => router.push(APP_ROUTES.pantry)}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          className="shrink-0 items-center justify-center rounded-xl bg-primary px-3 py-2"
          style={({ pressed }) => ({
            opacity: pressed ? 0.72 : 1,
            backgroundColor: pressed ? THEME.primaryDark : THEME.primary,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text className="text-xs font-bold text-on-primary">{buttonLabel}</Text>
        </Pressable>
      </View>
    </Card>
  );
}
