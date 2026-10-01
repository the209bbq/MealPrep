import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from './Card';

export function RecipesPantryEmptyState() {
  return (
    <Card className="mt-3" title="Add pantry items first" subtitle="Recipes appear when we can match them to what you have on hand">
      <Text className="mt-2 text-sm text-muted">
        Scan shelves or add items manually. We will not suggest meals until your pantry has ingredients to match against.
      </Text>
      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => router.push('/pantry')}
          className="flex-1 items-center rounded-xl bg-primary py-3"
        >
          <Text className="text-sm font-bold text-on-primary">Scan pantry</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/pantry')}
          className="flex-1 items-center rounded-xl border border-border bg-paper py-3"
        >
          <Text className="text-sm font-bold text-ink">Add items</Text>
        </Pressable>
      </View>
    </Card>
  );
}
