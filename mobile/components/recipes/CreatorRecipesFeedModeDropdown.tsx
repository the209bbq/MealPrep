import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import {
  CREATOR_RECIPES_COPY,
  CREATOR_RECIPES_FEED_MODE_LABELS,
  CREATOR_RECIPES_FEED_MODE_SHORT_LABELS,
  CREATOR_RECIPES_FEED_MODES,
  type CreatorRecipesFeedMode,
} from '../../config/creatorRecipes';
import { AnchoredDropdownOverlay, useAnchoredDropdownTrigger } from '../AnchoredDropdownOverlay';

export function CreatorRecipesFeedModeDropdown({
  value,
  onChange,
}: {
  value: CreatorRecipesFeedMode;
  onChange: (next: CreatorRecipesFeedMode) => void;
}) {
  const { triggerRef, open, anchor, toggleMenu, closeMenu, onTriggerLayout } = useAnchoredDropdownTrigger();

  return (
    <View ref={triggerRef} collapsable={false} onLayout={onTriggerLayout} className="shrink-0">
      <Pressable
        onPress={toggleMenu}
        accessibilityRole="button"
        accessibilityLabel={`${CREATOR_RECIPES_COPY.feedAccessibility}: ${CREATOR_RECIPES_FEED_MODE_LABELS[value]}`}
        accessibilityState={{ expanded: open }}
        className="max-w-[108px] flex-row items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-1.5"
      >
        <Text className="shrink text-xs font-semibold text-ink" numberOfLines={1}>
          {CREATOR_RECIPES_FEED_MODE_SHORT_LABELS[value]}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={THEME.muted} />
      </Pressable>
      <AnchoredDropdownOverlay visible={open} anchor={anchor} onClose={closeMenu}>
        {CREATOR_RECIPES_FEED_MODES.map((choice) => {
          const selected = choice === value;
          return (
            <Pressable
              key={choice}
              onPress={() => {
                onChange(choice);
                closeMenu();
              }}
              className={`px-3 py-2 ${selected ? 'bg-primary-light' : 'bg-paper'}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text className={`text-xs font-semibold ${selected ? 'text-primary-dark' : 'text-ink'}`}>
                {CREATOR_RECIPES_FEED_MODE_LABELS[choice]}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredDropdownOverlay>
    </View>
  );
}
