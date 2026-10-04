import { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { CATEGORY_LABELS } from '../config/appConfig';
import { PANTRY_LIST_COPY, type PantryStorageLocation } from '../config/pantryStorage';
import { groupPantryIntoLocationSections } from '../lib/pantryGrouping';
import { formatQuantityWithUnit } from '../lib/formatQuantity';
import type { PantryCategory, PantryItem } from '../types/mealprep';

interface PantryFilteredItemListProps {
  items: PantryItem[];
  categoryFilter: PantryCategory | 'all';
  locationFilter: PantryStorageLocation | 'all';
  onPressItem: (item: PantryItem) => void;
  onResetFilters?: () => void;
}

function PantryItemRow({ item, onPress }: { item: PantryItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-xl border border-border bg-paper px-3 py-3"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-ink">{item.name}</Text>
          <Text className="text-sm text-muted">
            {CATEGORY_LABELS[item.category]} · {formatQuantityWithUnit(item.quantity, item.unit)}
          </Text>
        </View>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} className="h-12 w-12 rounded-lg" />
        ) : null}
      </View>
    </Pressable>
  );
}

export function PantryFilteredItemList({
  items,
  categoryFilter,
  locationFilter,
  onPressItem,
  onResetFilters,
}: PantryFilteredItemListProps) {
  const sections = useMemo(
    () => groupPantryIntoLocationSections(items, { categoryFilter, locationFilter }),
    [categoryFilter, items, locationFilter],
  );

  const hasItems = sections.some((section) => section.items.length > 0);

  if (!hasItems) {
    return (
      <View className="mb-4 rounded-2xl border border-border bg-card px-4 py-6">
        <Text className="text-center text-sm text-muted">{PANTRY_LIST_COPY.emptyFiltered}</Text>
        {items.length > 0 && onResetFilters ? (
          <Pressable onPress={onResetFilters} className="mt-3 items-center rounded-xl border border-border py-2.5">
            <Text className="text-sm font-bold text-primary-dark">{PANTRY_LIST_COPY.showAllFilters}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const showLocationHeaders = locationFilter === 'all';

  return (
    <View className="mb-4">
      {sections.map((section) => {
        if (section.items.length === 0) {
          return null;
        }

        return (
          <View key={section.location} className={showLocationHeaders ? 'mb-4' : ''}>
            {showLocationHeaders ? (
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {section.label}
              </Text>
            ) : null}

            {section.categoryGroups.map((group) => (
              <View key={`${section.location}-${group.category}`} className="mb-1">
                <Text className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-muted">
                  {group.label}
                </Text>
                {group.items.map((item) => (
                  <PantryItemRow key={item.id} item={item} onPress={() => onPressItem(item)} />
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
