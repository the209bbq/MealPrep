import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { RECIPES_TAB_SURFACE_COPY } from '../../config/recipesTabSurface';
import type { MealDbCategoryChip } from '../../lib/recipesTab/categoryRotation';
import { HalfVisibleOnce } from './HalfVisibleOnce';

export function CategoryAvatarsRow({
  chips,
  onSelect,
  onImpression,
}: {
  chips: readonly MealDbCategoryChip[];
  onSelect: (chip: MealDbCategoryChip) => void;
  onImpression: (chip: MealDbCategoryChip) => void;
}) {
  if (chips.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel={RECIPES_TAB_SURFACE_COPY.categoryRowAccessibility}
      contentContainerStyle={{ gap: 12, paddingRight: 4 }}
    >
      {chips.map((chip) => (
        <HalfVisibleOnce key={chip.category} onVisible={() => onImpression(chip)}>
          <Pressable
            onPress={() => onSelect(chip)}
            accessibilityRole="button"
            accessibilityLabel={`${chip.category} classic recipes`}
            className="items-center"
            style={{ width: 72 }}
          >
            {chip.thumbUrl ? (
              <Image
                source={{ uri: chip.thumbUrl }}
                className="h-14 w-14 rounded-full border border-border bg-card"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
                <Text className="text-lg font-bold text-primary">
                  {chip.category.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="mt-1 text-center text-[11px] font-medium text-ink" numberOfLines={2}>
              {chip.category}
            </Text>
          </Pressable>
        </HalfVisibleOnce>
      ))}
    </ScrollView>
  );
}
