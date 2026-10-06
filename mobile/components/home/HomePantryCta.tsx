import { router } from 'expo-router';
import { useState } from 'react';
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
  const [pressed, setPressed] = useState(false);

  const buttonStyle = {
    backgroundColor: pressed ? THEME.primaryDark : THEME.primary,
    transform: [{ scale: pressed ? 0.96 : 1 }],
  };

  if (stackButton) {
    return (
      <Card className="mt-4 p-3">
        <Text className="text-sm text-muted">{description}</Text>
        <Pressable
          onPress={() => router.push(APP_ROUTES.pantry)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          className="mt-3 items-center justify-center rounded-xl px-3 py-2.5"
          style={buttonStyle}
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
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          className="shrink-0 items-center justify-center rounded-xl px-3 py-2"
          style={buttonStyle}
        >
          <Text className="text-xs font-bold text-on-primary">{buttonLabel}</Text>
        </Pressable>
      </View>
    </Card>
  );
}
