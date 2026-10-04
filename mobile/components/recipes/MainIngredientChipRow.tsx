import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { MAIN_INGREDIENT_COPY } from '../../config/mainIngredient';
import type { MainIngredientChipOption, MainIngredientPick } from '../../lib/mainIngredient';

interface MainIngredientChipRowProps {
  options: MainIngredientChipOption[];
  selected: MainIngredientPick | null;
  onSelect: (pick: MainIngredientPick | null) => void;
}

export function MainIngredientChipRow({ options, selected, onSelect }: MainIngredientChipRowProps) {
  if (options.length === 0) return null;

  return (
    <View className="mt-2">
      <View className="flex-row items-center gap-1">
        <Text className="text-xs font-semibold text-muted">{MAIN_INGREDIENT_COPY.cookWithLabel}</Text>
        {selected ? (
          <Pressable
            onPress={() => onSelect(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={MAIN_INGREDIENT_COPY.clearFilter}
          >
            <Ionicons name="close-circle" size={16} color={THEME.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-1.5"
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {options.map(({ pick }) => {
          const isSelected = selected?.id === pick.id;
          return (
            <Pressable
              key={pick.id}
              onPress={() => onSelect(isSelected ? null : pick)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Cook with ${pick.label}`}
              className={`rounded-full border px-3 py-1.5 ${
                isSelected ? 'border-primary bg-primary' : 'border-border bg-card'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${isSelected ? 'text-on-primary' : 'text-ink'}`}
              >
                {pick.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {selected ? (
        <Text className="mt-1.5 text-xs text-muted">{MAIN_INGREDIENT_COPY.builtAround(selected.label)}</Text>
      ) : null}
    </View>
  );
}
