import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  labelForPantryStorageLocation,
  PANTRY_LIST_COPY,
  pantryStorageLocationOptions,
  type PantryStorageLocation,
} from '../config/pantryStorage';
import type { PantryLocationFilterCounts } from '../lib/pantryGrouping';

interface PantryStorageLocationChipsProps {
  selected: PantryStorageLocation;
  onSelect: (location: PantryStorageLocation) => void;
  label?: string;
  compact?: boolean;
}

export function PantryStorageLocationChips({
  selected,
  onSelect,
  label = 'Storage',
  compact = false,
}: PantryStorageLocationChipsProps) {
  const options = pantryStorageLocationOptions();

  return (
    <View>
      {label ? (
        <Text className={`font-bold uppercase tracking-wide text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {label}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className={label ? 'mt-1.5' : ''}>
        {options.map((option) => {
          const active = selected === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`mr-2 items-center justify-center rounded-full ${compact ? 'px-2 py-1' : 'min-h-[44px] px-4'} ${
                active ? 'bg-primary' : `border border-border ${compact ? 'bg-paper' : 'bg-card'}`
              }`}
            >
              <Text
                className={`${compact ? 'text-[10px] font-semibold' : 'text-sm'} ${
                  active
                    ? `${compact ? 'text-on-primary' : 'font-bold text-cream'}`
                    : `${compact ? 'text-muted' : 'font-semibold text-ink'}`
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface PantryStorageLocationFilterChipsProps {
  selected: PantryStorageLocation | 'all';
  onSelect: (location: PantryStorageLocation | 'all') => void;
  counts: PantryLocationFilterCounts;
}

export function PantryStorageLocationFilterChips({
  selected,
  onSelect,
  counts,
}: PantryStorageLocationFilterChipsProps) {
  const items: { key: PantryStorageLocation | 'all'; label: string; count: number }[] = [
    { key: 'all', label: PANTRY_LIST_COPY.allLocationsChipLabel, count: counts.all },
    ...pantryStorageLocationOptions().map((o) => ({
      key: o.id,
      label: o.label,
      count: counts[o.id],
    })),
  ];

  return (
    <View accessibilityLabel={PANTRY_LIST_COPY.storageFilterLabel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((item) => {
          const active = selected === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`mr-2 min-h-[44px] items-center justify-center rounded-full px-4 ${
                active ? 'bg-primary' : 'border border-border bg-card'
              }`}
            >
              <Text className={`text-sm ${active ? 'font-bold text-cream' : 'font-semibold text-ink'}`}>
                {item.label} ({item.count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function PantryStorageLocationBadge({ location }: { location: PantryStorageLocation }) {
  return (
    <Text className="text-xs text-muted">{labelForPantryStorageLocation(location)}</Text>
  );
}
