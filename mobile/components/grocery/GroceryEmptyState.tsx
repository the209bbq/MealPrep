import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';

export function GroceryEmptyState() {
  return (
    <View className="items-center rounded-3xl border border-dashed border-border bg-card px-6 py-10">
      <View className="mb-4 rounded-full bg-emerald-light p-4">
        <Ionicons name="cart-outline" size={40} color={THEME.emerald} />
      </View>
      <Text className="text-center text-lg font-bold text-ink">Your list is clear</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-muted">
        Select recipes on the Home or Recipes tab, or add items manually. We subtract what you already have in the pantry.
      </Text>
    </View>
  );
}
