import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { APP_ROUTES } from '../../config/appRoutes';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { Card } from '../Card';

export function HomePantryCta() {
  const { description, buttonLabel } = RECIPES_COPY.homePantryPrompt;

  return (
    <Card className="mt-4 p-3">
      <View className="flex-row items-center gap-3">
        <Text className="min-w-0 flex-1 text-sm text-muted" numberOfLines={2}>
          {description}
        </Text>
        <Pressable
          onPress={() => router.push(APP_ROUTES.pantry)}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          className="shrink-0 items-center justify-center rounded-xl bg-primary px-3 py-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
        >
          <Text className="text-xs font-bold text-on-primary">{buttonLabel}</Text>
        </Pressable>
      </View>
    </Card>
  );
}
