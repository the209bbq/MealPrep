import { Pressable, ScrollView, Text } from 'react-native';
import { RECIPES_TAB_SURFACE_COPY } from '../../config/recipesTabSurface';
import type { MealDbCategoryChip } from '../../lib/recipesTab/categoryRotation';
import { HalfVisibleOnce } from './HalfVisibleOnce';

const CHIP_BASE = 'min-h-[44px] items-center justify-center rounded-full px-4';
const CHIP_ACTIVE = `${CHIP_BASE} bg-primary`;
const CHIP_INACTIVE = `${CHIP_BASE} border border-border bg-card`;
const CHIP_TEXT_ACTIVE = 'text-sm font-bold text-on-primary';
const CHIP_TEXT_INACTIVE = 'text-sm font-semibold text-ink';

export function CategoryAvatarsRow({
  chips,
  onSelect,
  onPressIn,
  onImpression,
  selectedCategory = null,
  onSelectAll,
}: {
  chips: readonly MealDbCategoryChip[];
  onSelect: (chip: MealDbCategoryChip) => void;
  onPressIn?: (chip: MealDbCategoryChip) => void;
  onImpression: (chip: MealDbCategoryChip) => void;
  /** Category currently shown; its chip is drawn as the active (green) one. */
  selectedCategory?: string | null;
  /** When set, a leading "All" chip clears the category pick. */
  onSelectAll?: () => void;
}) {
  if (chips.length === 0) return null;

  const allActive = selectedCategory == null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel={RECIPES_TAB_SURFACE_COPY.categoryRowAccessibility}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
    >
      {onSelectAll ? (
        <Pressable
          onPress={onSelectAll}
          accessibilityRole="button"
          accessibilityLabel="Show all classic categories"
          accessibilityState={{ selected: allActive }}
          className={allActive ? CHIP_ACTIVE : CHIP_INACTIVE}
        >
          <Text className={allActive ? CHIP_TEXT_ACTIVE : CHIP_TEXT_INACTIVE}>
            {RECIPES_TAB_SURFACE_COPY.allCategoriesChip}
          </Text>
        </Pressable>
      ) : null}
      {chips.map((chip) => {
        const active = selectedCategory === chip.category;
        return (
          <HalfVisibleOnce key={chip.category} onVisible={() => onImpression(chip)}>
            <Pressable
              onPress={() => onSelect(chip)}
              onPressIn={onPressIn ? () => onPressIn(chip) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${chip.category} classic recipes`}
              accessibilityState={{ selected: active }}
              className={active ? CHIP_ACTIVE : CHIP_INACTIVE}
            >
              <Text className={active ? CHIP_TEXT_ACTIVE : CHIP_TEXT_INACTIVE} numberOfLines={1}>
                {chip.category}
              </Text>
            </Pressable>
          </HalfVisibleOnce>
        );
      })}
    </ScrollView>
  );
}
