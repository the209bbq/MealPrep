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
              className={`mr-2 rounded-full ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} ${
                active ? 'bg-emerald' : 'border border-border bg-paper'
              }`}
            >
              <Text className={`font-semibold ${compact ? 'text-[10px]' : 'text-xs'} ${active ? 'text-on-emerald' : 'text-muted'}`}>
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
  const items: Array<{ key: PantryStorageLocation | 'all'; label: string; count: number }> = [
    { key: 'all', label: PANTRY_LIST_COPY.allLocationsChipLabel, count: counts.all },
    ...pantryStorageLocationOptions().map((o) => ({
      key: o.id,
      label: o.label,
      count: counts[o.id],
    })),
  ];

  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
        {PANTRY_LIST_COPY.storageFilterLabel}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        {items.map((item) => {
          const active = selected === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-slate' : 'border border-border bg-paper'}`}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-on-emerald' : 'text-muted'}`}>
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
