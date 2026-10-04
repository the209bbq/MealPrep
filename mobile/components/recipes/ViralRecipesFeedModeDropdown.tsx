import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import {
  VIRAL_RECIPES_COPY,
  VIRAL_RECIPES_FEED_MODE_LABELS,
  VIRAL_RECIPES_FEED_MODES,
  type ViralRecipesFeedMode,
} from '../../config/viralRecipes';

export function ViralRecipesFeedModeDropdown({
  value,
  onChange,
}: {
  value: ViralRecipesFeedMode;
  onChange: (next: ViralRecipesFeedMode) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="relative" style={{ zIndex: open ? 10 : 1 }}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={VIRAL_RECIPES_COPY.categoryAccessibility}
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5"
      >
        <Text className="text-xs font-semibold text-ink">{VIRAL_RECIPES_FEED_MODE_LABELS[value]}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={THEME.muted} />
      </Pressable>
      {open ? (
        <View className="absolute right-0 top-full z-20 mt-1 min-w-[132px] overflow-hidden rounded-xl border border-border bg-paper shadow-sm">
          {VIRAL_RECIPES_FEED_MODES.map((choice) => {
            const selected = choice === value;
            return (
              <Pressable
                key={choice}
                onPress={() => {
                  onChange(choice);
                  setOpen(false);
                }}
                className={`px-3 py-2 ${selected ? 'bg-primary-light' : 'bg-paper'}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text className={`text-xs font-semibold ${selected ? 'text-primary-dark' : 'text-ink'}`}>
                  {VIRAL_RECIPES_FEED_MODE_LABELS[choice]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
