import { Pressable, Text } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { SAVED_RECIPES_COPY } from '../../config/savedRecipes';
import { VIRAL_RECIPES_COPY } from '../../config/viralRecipes';

export function RecipeSaveCta({
  saved,
  onToggle,
  disabled = false,
}: {
  saved: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={saved ? SAVED_RECIPES_COPY.savedAccessibility : SAVED_RECIPES_COPY.saveAccessibility}
      accessibilityState={{ selected: saved, disabled }}
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl px-4 ${
        saved ? 'border border-primary bg-primary-light' : 'bg-primary'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={22}
        color={saved ? THEME.primary : THEME.onPrimary}
      />
      <Text className={`text-base font-bold ${saved ? 'text-primary-dark' : 'text-on-primary'}`}>
        {saved ? SAVED_RECIPES_COPY.savedButton : VIRAL_RECIPES_COPY.saveToMyRecipes}
      </Text>
    </Pressable>
  );
}
