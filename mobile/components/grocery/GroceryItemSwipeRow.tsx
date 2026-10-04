import { Ionicons } from '../../lib/icons/Ionicons';
import { Platform, Pressable, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { THEME } from '../../config/appConfig';
import { GROCERY_COPY } from '../../config/grocery';
import type { GroceryCommunityDealBadge } from '../../lib/communityDeals/matchItem';
import type { GroceryListItem } from '../../types/mealprep';
import { GroceryItemRow } from './GroceryItemRow';

interface GroceryItemSwipeRowProps {
  item: GroceryListItem;
  recipeLabels: string;
  onToggle: () => void;
  onRemove: () => void;
  dimmed?: boolean;
  communityDeal?: GroceryCommunityDealBadge;
}

function SwipeDeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={GROCERY_COPY.removeItem}
      className="mb-2 ml-2 min-w-[72px] items-center justify-center rounded-2xl bg-danger px-3"
    >
      <Ionicons name="trash-outline" size={22} color={THEME.onPrimary} />
      <Text className="mt-0.5 text-xs font-bold text-on-primary">{GROCERY_COPY.removeItem}</Text>
    </Pressable>
  );
}

export function GroceryItemSwipeRow(props: GroceryItemSwipeRowProps) {
  const row = <GroceryItemRow {...props} />;

  if (Platform.OS === 'web') {
    return row;
  }

  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => <SwipeDeleteAction onPress={props.onRemove} />}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') props.onRemove();
      }}
    >
      {row}
    </Swipeable>
  );
}
