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
  quantityLabel?: string;
  mealHint?: string;
  showMealHint?: boolean;
  hideSecondaryLine?: boolean;
  onRowBodyPress?: () => void;
  /** Hairline under the row; off for the last row in a card. */
  showDivider?: boolean;
}

export function GroceryItemRow({
  item,
  recipeLabels,
  onToggle,
  onRemove,
  dimmed,
  communityDeal,
  quantityLabel,
  mealHint,
  showMealHint,
  hideSecondaryLine,
  onRowBodyPress,
  showDivider,
}: GroceryItemRowProps) {
  const qtyLabel = quantityLabel ?? formatQuantityWithUnit(item.quantity, item.unit);
  const bodyOpensMealHint = onRowBodyPress != null;
  const bodyAccessibilityLabel = bodyOpensMealHint
    ? `Show which meals need ${item.name}`
    : `${item.checked ? 'Uncheck' : 'Check'} ${item.name}`;

  return (
    <View
      className={`min-h-[52px] flex-row items-center bg-card pl-[5px] pr-1 ${
        showDivider ? 'border-b border-border/60' : ''
      } ${dimmed ? 'opacity-80' : ''}`}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${item.name} as ${item.checked ? 'not purchased' : 'purchased'}`}
        accessibilityState={{ checked: item.checked }}
        className="h-11 w-11 items-center justify-center active:opacity-90"
      >
        <View
          className={`h-[22px] w-[22px] items-center justify-center rounded-md border-2 border-primary ${
            item.checked ? 'bg-primary' : 'bg-card'
          }`}
        >
          {item.checked ? <Ionicons name="checkmark" size={16} color={THEME.onPrimary} /> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onRowBodyPress ?? onToggle}
        accessibilityRole="button"
        accessibilityLabel={bodyAccessibilityLabel}
        className="ml-px min-h-[44px] min-w-0 flex-1 justify-center py-1.5 active:opacity-90"
      >
        <Text className={`text-base font-semibold ${item.checked ? 'text-muted line-through' : 'text-ink'}`}>{item.name}</Text>
        {communityDeal ? (
          <View className="mt-1 self-start rounded-lg bg-amber-100 px-2 py-0.5">
            <Text className="text-xs font-bold text-amber-950">
              Deal: {formatMoney(communityDeal.deal.price)}
              {communityDeal.deal.unit ? `/${communityDeal.deal.unit}` : ''} at {communityDeal.storeLabel}
              {communityDeal.deal.isSample ? ' (SAMPLE)' : ''}
            </Text>
          </View>
        ) : null}
        {showMealHint && mealHint ? (
          <Text className="mt-0.5 text-xs font-medium text-muted" numberOfLines={2}>
            {mealHint}
          </Text>
        ) : null}
        {!hideSecondaryLine && !showMealHint ? (
          recipeLabels ? (
            <Text className="mt-0.5 text-xs text-muted" numberOfLines={2}>
              For {recipeLabels}
            </Text>
          ) : (
            <Text className="mt-0.5 text-xs text-muted">Added manually</Text>
          )
        ) : null}
      </Pressable>
      <Text className="ml-3 max-w-[40%] text-right text-sm text-muted">{qtyLabel}</Text>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={GROCERY_COPY.removeItem}
        hitSlop={4}
        className="ml-1 min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:bg-danger/10"
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
