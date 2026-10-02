import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { THEME } from '../config/appConfig';
import {
  countRecipesTabFilterMatches,
  mealCategoryFilterCandidates,
  pantryProteinFilterCandidates,
  RECIPES_TAB_FILTER_COPY,
  RECIPES_TAB_QUICK_FILTER_IDS,
  RECIPES_TAB_TIME_FILTER_MINUTES,
  type RecipesTabFilterId,
  type RecipesTabQuickFilterId,
  type RecipesTabRow,
  recipesTabFiltersActive,
} from '../config/recipesTabFilters';
import type { PantryItem } from '../types/mealprep';

interface RecipesTabFilterBarProps {
  pantry: PantryItem[];
  baseRows: RecipesTabRow[];
  activeFilterIds: RecipesTabFilterId[];
  onToggleFilter: (id: RecipesTabFilterId) => void;
  onClearAll: () => void;
}

function chipLabel(label: string, count: number, showCount: boolean): string {
  if (!showCount) return label;
  return `${label} (${count})`;
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'border border-border bg-paper'}`}
    >
      <Text className={`text-xs font-semibold ${active ? 'text-on-primary' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

export function RecipesTabFilterBar({
  pantry,
  baseRows,
  activeFilterIds,
  onToggleFilter,
  onClearAll,
}: RecipesTabFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const filtersActive = recipesTabFiltersActive(activeFilterIds);

  const quickOptions = useMemo(() => {
    return RECIPES_TAB_QUICK_FILTER_IDS.map((id) => {
      const count = countRecipesTabFilterMatches(baseRows, id, activeFilterIds);
      const active = activeFilterIds.includes(id);
      return { id, count, active, hidden: count === 0 && !active };
    }).filter((row) => !row.hidden);
  }, [activeFilterIds, baseRows]);

  const mealCategories = useMemo(() => mealCategoryFilterCandidates(baseRows), [baseRows]);
  const proteinItems = useMemo(
    () => pantryProteinFilterCandidates(pantry, baseRows),
    [baseRows, pantry],
  );

  const sheetFilterCount = activeFilterIds.filter(
    (id) => !RECIPES_TAB_QUICK_FILTER_IDS.includes(id as RecipesTabQuickFilterId),
  ).length;

  return (
    <>
      <View className="mt-1 flex-row items-center">
        <Pressable
          onPress={() => setSheetOpen(true)}
          className="mr-2 flex-row items-center rounded-full border border-border bg-paper px-3 py-1.5"
        >
          <Ionicons name="options-outline" size={14} color={THEME.muted} />
          <Text className="ml-1 text-xs font-semibold text-muted">{RECIPES_TAB_FILTER_COPY.filtersButton}</Text>
          {sheetFilterCount > 0 ? (
            <View className="ml-1.5 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5">
              <Text className="text-center text-[10px] font-bold text-on-primary">{sheetFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
        {filtersActive ? (
          <Pressable onPress={onClearAll} className="mr-2 rounded-full px-2 py-1.5">
            <Text className="text-xs font-semibold text-primary">{RECIPES_TAB_FILTER_COPY.clearAll}</Text>
          </Pressable>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          {quickOptions.map(({ id, count, active }) => (
            <FilterChip
              key={id}
              active={active}
              label={chipLabel(RECIPES_TAB_FILTER_COPY.quick[id], count, true)}
              onPress={() => onToggleFilter(id)}
            />
          ))}
        </ScrollView>
      </View>

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setSheetOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-3xl bg-paper px-4 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-ink">{RECIPES_TAB_FILTER_COPY.filtersButton}</Text>
              <Pressable onPress={() => setSheetOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={THEME.muted} />
              </Pressable>
            </View>

            {mealCategories.length > 0 ? (
              <Text className="mb-1 text-xs font-semibold uppercase text-muted">
                {RECIPES_TAB_FILTER_COPY.sheet.mealTypes}
              </Text>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {mealCategories.map((category) => {
                const id = `meal:${category}` as RecipesTabFilterId;
                const count = countRecipesTabFilterMatches(baseRows, id, activeFilterIds);
                if (count === 0 && !activeFilterIds.includes(id)) return null;
                return (
                  <FilterChip
                    key={id}
                    active={activeFilterIds.includes(id)}
                    label={chipLabel(RECIPES_TAB_FILTER_COPY.mealLabels[category], count, true)}
                    onPress={() => onToggleFilter(id)}
                  />
                );
              })}
            </ScrollView>

            <Text className="mb-1 text-xs font-semibold uppercase text-muted">
              {RECIPES_TAB_FILTER_COPY.sheet.time}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {[30, ...RECIPES_TAB_TIME_FILTER_MINUTES].map((minutes) => {
                const id =
                  minutes === 30
                    ? ('under_30' as RecipesTabFilterId)
                    : (`time:max_${minutes}` as RecipesTabFilterId);
                const count = countRecipesTabFilterMatches(baseRows, id, activeFilterIds);
                if (count === 0 && !activeFilterIds.includes(id)) return null;
                const label =
                  minutes === 30
                    ? RECIPES_TAB_FILTER_COPY.quick.under_30
                    : RECIPES_TAB_FILTER_COPY.sheet.underMinutes(minutes);
                return (
                  <FilterChip
                    key={id}
                    active={activeFilterIds.includes(id)}
                    label={chipLabel(label, count, true)}
                    onPress={() => onToggleFilter(id)}
                  />
                );
              })}
            </ScrollView>

            {proteinItems.length > 0 ? (
              <>
                <Text className="mb-1 text-xs font-semibold uppercase text-muted">
                  {RECIPES_TAB_FILTER_COPY.sheet.pantryProtein}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {proteinItems.map((item) => {
                    const id = `protein:${item.id}` as RecipesTabFilterId;
                    const count = countRecipesTabFilterMatches(baseRows, id, activeFilterIds);
                    if (count === 0 && !activeFilterIds.includes(id)) return null;
                    return (
                      <FilterChip
                        key={id}
                        active={activeFilterIds.includes(id)}
                        label={chipLabel(item.name, count, true)}
                        onPress={() => onToggleFilter(id)}
                      />
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {filtersActive ? (
              <Pressable
                onPress={() => {
                  onClearAll();
                  setSheetOpen(false);
                }}
                className="mt-5 items-center rounded-xl border border-border py-3"
              >
                <Text className="text-sm font-bold text-ink">{RECIPES_TAB_FILTER_COPY.clearAll}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function RecipesTabFiltersEmptyState({ onClearAll }: { onClearAll: () => void }) {
  return (
    <View className="mt-4 items-center rounded-2xl border border-dashed border-border bg-card px-5 py-8">
      <Text className="text-center text-base font-bold text-ink">{RECIPES_TAB_FILTER_COPY.emptyTitle}</Text>
      <Text className="mt-2 text-center text-sm text-muted">{RECIPES_TAB_FILTER_COPY.emptyBody}</Text>
      <Pressable onPress={onClearAll} className="mt-4 rounded-xl bg-primary px-5 py-3">
        <Text className="text-sm font-bold text-on-primary">{RECIPES_TAB_FILTER_COPY.clearAll}</Text>
      </Pressable>
    </View>
  );
}
