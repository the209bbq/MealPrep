import { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { CATEGORY_LABELS } from '../config/appConfig';
import {
  labelForPantryStorageLocation,
  PANTRY_LIST_COPY,
  type PantryStorageLocation,
} from '../config/pantryStorage';
import { groupPantryIntoLocationSections } from '../lib/pantryGrouping';
import { formatQuantityWithUnit } from '../lib/formatQuantity';
import {
  daysUntilPantryExpiry,
  formatPantryDaysLeft,
  formatPantryExpiryShort,
  isExpiringSoon,
  isPantryItemExpired,
} from '../lib/pantry/expiry';
import type { PantryCategory, PantryItem } from '../types/mealprep';

interface PantryFilteredItemListProps {
  items: PantryItem[];
  categoryFilter: PantryCategory | 'all';
  locationFilter: PantryStorageLocation | 'all';
  highlightItemIds?: ReadonlySet<string>;
  onPressItem: (item: PantryItem) => void;
  onResetFilters?: () => void;
}

const SECTION_HEADING_CLASS = 'mb-2.5 text-[19px] font-extrabold text-ink';
const SECTION_CARD_CLASS = 'overflow-hidden rounded-[18px] border border-border bg-card';

function rowClassName(isLast: boolean, highlighted: boolean): string {
  return `min-h-[56px] flex-row items-center justify-between gap-3 px-4 py-2 ${
    isLast ? '' : 'border-b border-border/60'
  } ${highlighted ? 'bg-primary-light' : ''}`;
}

function PantryItemRow({
  item,
  highlighted,
  isLast,
  onPress,
}: {
  item: PantryItem;
  highlighted: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const expiryLabel = formatPantryExpiryShort(item.expiresOn);
  const expired = isPantryItemExpired(item);
  const soon = !expired && isExpiringSoon(item);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={rowClassName(isLast, highlighted)}>
      <View className="min-w-0 flex-1">
        <Text className="text-base font-bold text-ink">{item.name}</Text>
        <Text className="text-[13px] text-muted">
          {CATEGORY_LABELS[item.category]}
          {expiryLabel ? ` · ${expiryLabel}` : ''}
        </Text>
        {expired && expiryLabel ? (
          <Text className="text-[13px] font-semibold text-danger">Expired</Text>
        ) : soon && expiryLabel ? (
          <Text className="text-[13px] font-semibold text-danger">Expiring soon</Text>
        ) : null}
      </View>
      <Text className="shrink-0 text-[15px] text-muted">{formatQuantityWithUnit(item.quantity, item.unit)}</Text>
      {item.photoUri ? <Image source={{ uri: item.photoUri }} className="h-10 w-10 rounded-lg" /> : null}
    </Pressable>
  );
}

function UseSoonRow({
  item,
  highlighted,
  isLast,
  onPress,
}: {
  item: PantryItem;
  highlighted: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const daysLeftLabel = formatPantryDaysLeft(item);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={rowClassName(isLast, highlighted)}>
      <View className="min-w-0 flex-1">
        <Text className="text-base font-bold text-ink">{item.name}</Text>
        <Text className="text-[13px] text-muted">{labelForPantryStorageLocation(item.location)}</Text>
      </View>
      {daysLeftLabel ? (
        <View className="shrink-0 rounded-[10px] bg-warning-light px-2.5 py-[5px]">
          <Text className="text-[13px] font-bold text-on-warning">{daysLeftLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function PantryFilteredItemList({
  items,
  categoryFilter,
  locationFilter,
  highlightItemIds,
  onPressItem,
  onResetFilters,
}: PantryFilteredItemListProps) {
  const sections = useMemo(
    () => groupPantryIntoLocationSections(items, { categoryFilter, locationFilter }),
    [categoryFilter, items, locationFilter],
  );

  /** Dated items inside the app's existing "expiring soon" window, soonest first (same filters as the list). */
  const useSoonItems = useMemo(
    () =>
      sections
        .flatMap((section) => section.items)
        .filter((item) => isExpiringSoon(item))
        .sort((a, b) => {
          const byDays = (daysUntilPantryExpiry(a) ?? 0) - (daysUntilPantryExpiry(b) ?? 0);
          return byDays !== 0 ? byDays : a.name.localeCompare(b.name);
        }),
    [sections],
  );

  const hasItems = sections.some((section) => section.items.length > 0);

  if (!hasItems) {
    return (
      <View className="rounded-[18px] border border-border bg-card px-4 py-6">
        <Text className="text-center text-sm text-muted">{PANTRY_LIST_COPY.emptyFiltered}</Text>
        {items.length > 0 && onResetFilters ? (
          <Pressable
            onPress={onResetFilters}
            accessibilityRole="button"
            className="mt-3 min-h-[44px] items-center justify-center rounded-full border border-border px-4"
          >
            <Text className="text-sm font-bold text-primary-dark">{PANTRY_LIST_COPY.showAllFilters}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const showLocationHeaders = locationFilter === 'all';

  return (
    <View className="gap-4">
      {useSoonItems.length > 0 ? (
        <View>
          <Text className={SECTION_HEADING_CLASS} accessibilityRole="header">
            {PANTRY_LIST_COPY.useSoonHeading}
          </Text>
          <View className={SECTION_CARD_CLASS}>
            {useSoonItems.map((item, index) => (
              <UseSoonRow
                key={item.id}
                item={item}
                highlighted={highlightItemIds?.has(item.id) ?? false}
                isLast={index === useSoonItems.length - 1}
                onPress={() => onPressItem(item)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {sections.map((section) => {
        if (section.items.length === 0) {
          return null;
        }

        const rows = section.categoryGroups.flatMap((group) => group.items);

        return (
          <View key={section.location}>
            {showLocationHeaders ? (
              <Text className={SECTION_HEADING_CLASS} accessibilityRole="header">
                {section.label}
              </Text>
            ) : null}

            <View className={SECTION_CARD_CLASS}>
              {rows.map((item, index) => (
                <PantryItemRow
                  key={item.id}
                  item={item}
                  highlighted={highlightItemIds?.has(item.id) ?? false}
                  isLast={index === rows.length - 1}
                  onPress={() => onPressItem(item)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
