import { Pressable, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { SAVED_RECIPES_COPY } from '../../config/savedRecipes';

export function RecipeSaveButton({
  saved,
  onToggle,
  size = 22,
  className = '',
}: {
  saved: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
}) {
  return (
    <Pressable
      onPress={(event: GestureResponderEvent) => {
        event.stopPropagation?.();
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? SAVED_RECIPES_COPY.unsave : SAVED_RECIPES_COPY.save}
      accessibilityState={{ selected: saved }}
      hitSlop={8}
      className={`items-center justify-center rounded-full bg-card/90 p-1.5 ${className}`}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={saved ? THEME.primary : THEME.ink}
      />
    </Pressable>
  );
}
