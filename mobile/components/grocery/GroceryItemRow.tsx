import { Ionicons } from '../../lib/icons/Ionicons';
import { Linking, Pressable, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { GROCERY_COPY } from '../../config/grocery';
import type { GroceryCommunityDealBadge } from '../../lib/communityDeals/matchItem';
import { formatMoney } from '../../lib/smartShop/aggregateDeals';
import { formatQuantityWithUnit } from '../../lib/formatQuantity';
import type { GroceryListItem } from '../../types/mealprep';

interface GroceryItemRowProps {
  item: GroceryListItem;
  recipeLabels: string;
  onToggle: () => void;
  onRemove: () => void;
  dimmed?: boolean;
  communityDeal?: GroceryCommunityDealBadge;
}

export function GroceryItemRow({ item, recipeLabels, onToggle, onRemove, dimmed, communityDeal }: GroceryItemRowProps) {
  const qtyLabel = formatQuantityWithUnit(item.quantity, item.unit);

  return (
    <View
      className={`mb-2 flex-row items-center rounded-2xl border border-border bg-card px-3 py-3 ${dimmed ? 'opacity-80' : ''}`}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        className="min-w-0 flex-1 flex-row items-center active:opacity-90"
      >
        <View
          className={`mr-3 h-11 w-11 items-center justify-center rounded-xl border-2 ${
            item.checked ? 'border-primary bg-primary' : 'border-primary bg-primary-light'
          }`}
        >
          {item.checked ? <Ionicons name="checkmark" size={24} color={THEME.onPrimary} /> : null}
        </View>
        <View className="min-w-0 flex-1">
          <Text className={`text-base font-bold ${item.checked ? 'text-muted line-through' : 'text-ink'}`}>{item.name}</Text>
          <Text className="mt-0.5 text-sm font-semibold text-primary-dark">{qtyLabel}</Text>
          {communityDeal ? (
            <View className="mt-1 self-start rounded-lg bg-amber-100 px-2 py-0.5">
              <Text className="text-xs font-bold text-amber-950">
                Deal: {formatMoney(communityDeal.deal.price)}
                {communityDeal.deal.unit ? `/${communityDeal.deal.unit}` : ''} at {communityDeal.storeLabel}
                {communityDeal.deal.isSample ? ' (SAMPLE)' : ''}
              </Text>
            </View>
          ) : null}
          {recipeLabels ? (
            <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
              {recipeLabels}
            </Text>
          ) : (
            <Text className="mt-1 text-xs text-muted">Added manually</Text>
          )}
        </View>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={GROCERY_COPY.removeItem}
        hitSlop={12}
        className="ml-2 rounded-xl border border-border bg-paper px-2.5 py-2.5 active:opacity-70"
      >
        <Ionicons name="trash-outline" size={20} color={THEME.danger} />
      </Pressable>
    </View>
  );
}

export function openStoreUrl(url?: string) {
  if (!url) return;
  void Linking.openURL(url);
}
