import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { CATEGORY_LABELS, THEME } from '../config/appConfig';
import {
  DEFAULT_PANTRY_SECTION_EXPANDED,
  PANTRY_SECTION_EXPANDED_STORAGE_KEY,
  type PantryStorageLocation,
} from '../config/pantryStorage';
import { groupPantryIntoLocationSections } from '../lib/pantryGrouping';
import { readJson, writeJson } from '../lib/storage';
import type { PantryCategory, PantryItem } from '../types/mealprep';

interface PantryLocationSectionsProps {
  items: PantryItem[];
  categoryFilter: PantryCategory | 'all';
  locationFilter: PantryStorageLocation | 'all';
  onPressItem: (item: PantryItem) => void;
}

function readExpandedState(): Record<PantryStorageLocation, boolean> {
  const saved = readJson<Partial<Record<PantryStorageLocation, boolean>>>(PANTRY_SECTION_EXPANDED_STORAGE_KEY, {});
  return { ...DEFAULT_PANTRY_SECTION_EXPANDED, ...saved };
}

export function PantryLocationSections({
  items,
  categoryFilter,
  locationFilter,
  onPressItem,
}: PantryLocationSectionsProps) {
  const [expanded, setExpanded] = useState<Record<PantryStorageLocation, boolean>>(readExpandedState);

  useEffect(() => {
    writeJson(PANTRY_SECTION_EXPANDED_STORAGE_KEY, expanded);
  }, [expanded]);

  const sections = useMemo(
    () => groupPantryIntoLocationSections(items, { categoryFilter, locationFilter }),
    [categoryFilter, items, locationFilter],
  );

  const toggleSection = useCallback((location: PantryStorageLocation) => {
    setExpanded((prev) => ({ ...prev, [location]: !prev[location] }));
  }, []);

  if (sections.every((section) => section.items.length === 0)) {
    return (
      <View className="mb-4 rounded-2xl border border-border bg-card px-4 py-6">
        <Text className="text-center text-sm text-muted">No items match your filters.</Text>
      </View>
    );
  }

  return (
    <View className="mb-4">
      {sections.map((section) => {
        const isOpen = expanded[section.location];
        const count = section.items.length;
        return (
          <View key={section.location} className="mb-3 overflow-hidden rounded-2xl border border-border bg-card">
            <Pressable
              onPress={() => toggleSection(section.location)}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={18} color={THEME.primary} />
                <Text className="text-base font-bold text-ink">{section.label}</Text>
                <Text className="text-sm text-muted">({count})</Text>
              </View>
            </Pressable>

            {isOpen ? (
              <View className="border-t border-border px-3 pb-3">
                {count === 0 ? (
                  <Text className="px-1 py-3 text-sm text-muted">Nothing here yet.</Text>
                ) : (
                  section.categoryGroups.map((group) => (
                    <View key={`${section.location}-${group.category}`} className="mt-2">
                      <Text className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-muted">
                        {group.label}
                      </Text>
                      {group.items.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => onPressItem(item)}
                          className="mb-2 rounded-xl border border-border bg-paper px-3 py-3"
                        >
                          <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-2">
                              <Text className="text-base font-bold text-ink">{item.name}</Text>
                              <Text className="text-sm text-muted">
                                {CATEGORY_LABELS[item.category]} · {item.quantity} {item.unit}
                              </Text>
                            </View>
                            {item.photoUri ? (
                              <Image source={{ uri: item.photoUri }} className="h-12 w-12 rounded-lg" />
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
