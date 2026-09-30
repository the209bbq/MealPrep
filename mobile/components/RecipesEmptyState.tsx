import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';

interface RecipesEmptyStateProps {
  pantryEmpty: boolean;
}

export function RecipesEmptyState({ pantryEmpty }: RecipesEmptyStateProps) {
  return (
    <View className="mt-4 items-center rounded-3xl border border-dashed border-border bg-card px-6 py-10">
      <View className="mb-4 rounded-full bg-emerald-light p-4">
        <Ionicons name={pantryEmpty ? 'camera-outline' : 'restaurant-outline'} size={40} color={THEME.emerald} />
      </View>
      <Text className="text-center text-lg font-bold text-ink">
        {pantryEmpty ? 'Add pantry items first' : 'No recipes match your pantry yet'}
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-muted">
        {pantryEmpty
          ? 'Scan your shelves or add ingredients on the Pantry tab. We will rank kitchen recipes by how many ingredients you already have.'
          : 'Try scanning more pantry items, loosen filters below, or use Discover search for ideas from RecipeAPI.io.'}
      </Text>
      {pantryEmpty ? (
        <Pressable
          onPress={() => router.push('/pantry')}
          className="mt-5 items-center rounded-xl bg-emerald px-5 py-3"
        >
          <Text className="text-sm font-bold text-on-emerald">Go to Pantry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
