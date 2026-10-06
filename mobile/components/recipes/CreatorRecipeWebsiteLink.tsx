import { Linking, Pressable, Text } from 'react-native';
import { CREATOR_RECIPES_COPY } from '../../config/creatorRecipes';
import type { CreatorWebsiteConfig } from '../../config/creatorWebsites';
import { sanitizeHttpUrl } from '../../lib/recipeImport/safeHttpUrl';

export function CreatorRecipeWebsiteLink({
  website,
  className = 'mb-2',
}: {
  website: CreatorWebsiteConfig;
  className?: string;
}) {
  const safeUrl = sanitizeHttpUrl(website.url);
  if (!safeUrl) return null;

  const label = CREATOR_RECIPES_COPY.fullRecipesAtHost(website.displayHost);

  return (
    <Pressable
      onPress={() => void Linking.openURL(safeUrl)}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={4}
      className={className}
    >
      <Text className="text-sm font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}
