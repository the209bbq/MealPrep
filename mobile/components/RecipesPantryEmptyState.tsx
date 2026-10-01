import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { RECIPES_COPY } from '../config/recipesCopy';
import { Card } from './Card';

export function RecipesPantryEmptyState() {
  return (
    <Card
      className="mt-3"
      title={RECIPES_COPY.pantryEmptyCard.title}
      subtitle={RECIPES_COPY.pantryEmptyCard.subtitle}
    >
      <Text className="mt-2 text-sm text-muted">{RECIPES_COPY.pantryEmptyCard.body}</Text>
      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => router.push('/pantry')}
          className="flex-1 items-center rounded-xl bg-emerald py-3"
        >
          <Text className="text-sm font-bold text-on-emerald">{RECIPES_COPY.pantryEmptyCard.scanCta}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/pantry')}
          className="flex-1 items-center rounded-xl border border-border bg-paper py-3"
        >
          <Text className="text-sm font-bold text-ink">{RECIPES_COPY.pantryEmptyCard.addCta}</Text>
        </Pressable>
      </View>
    </Card>
  );
}
