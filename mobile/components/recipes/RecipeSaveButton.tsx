import { Pressable, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { SAVED_RECIPES_COPY } from '../../config/savedRecipes';

export function RecipeSaveButton({
  saved,
  onToggle,
  size = 22,
  className = '',
  disabled = false,
}: {
  saved: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={(event: GestureResponderEvent) => {
        event.stopPropagation?.();
        if (disabled) return;
        onToggle();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        saved ? SAVED_RECIPES_COPY.savedAccessibility : SAVED_RECIPES_COPY.saveAccessibility
      }
      accessibilityState={{ selected: saved, disabled }}
      hitSlop={8}
      className={`items-center justify-center rounded-full p-1.5 ${
        saved ? 'border border-primary bg-primary-light' : 'bg-card/90'
      } ${disabled ? 'opacity-60' : ''} ${className}`}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={saved ? THEME.primary : THEME.ink}
      />
    </Pressable>
  );
}
