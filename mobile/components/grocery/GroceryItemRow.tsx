import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import type { GroceryListItem } from '../../types/mealprep';

interface GroceryItemRowProps {
  item: GroceryListItem;
  recipeLabels: string;
  onToggle: () => void;
  dimmed?: boolean;
}

export function GroceryItemRow({ item, recipeLabels, onToggle, dimmed }: GroceryItemRowProps) {
  const qtyLabel = `${item.quantity} ${item.unit}`;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      className={`mb-2 flex-row items-center rounded-2xl border border-border bg-card px-3 py-3 active:opacity-90 ${dimmed ? 'opacity-80' : ''}`}
    >
      <View
        className={`mr-3 h-11 w-11 items-center justify-center rounded-xl border-2 ${
          item.checked ? 'border-emerald bg-emerald' : 'border-emerald bg-emerald-light'
        }`}
      >
        {item.checked ? <Ionicons name="checkmark" size={24} color={THEME.onEmerald} /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`text-base font-bold ${item.checked ? 'text-muted line-through' : 'text-ink'}`}>{item.name}</Text>
        <Text className="mt-0.5 text-sm font-semibold text-emerald-dark">{qtyLabel}</Text>
        {recipeLabels ? (
          <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
            {recipeLabels}
          </Text>
        ) : (
          <Text className="mt-1 text-xs text-muted">Added manually</Text>
        )}
      </View>
    </Pressable>
  );
}

export function openStoreUrl(url?: string) {
  if (!url) return;
  void Linking.openURL(url);
}
