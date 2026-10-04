import { Linking, Pressable, Text, View } from 'react-native';
import { MEALDB_COPY } from '../../config/mealdb';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { sanitizeHttpUrl } from '../../lib/recipeImport/safeHttpUrl';
import type { Recipe } from '../../types/mealprep';

export function MealDbRecipeCreditLine({ recipe, className = 'mt-1' }: { recipe: Recipe; className?: string }) {
  const mealDbPage = sanitizeHttpUrl(recipe.sourceUrl);
  const original = sanitizeHttpUrl(recipe.sourceAuthorUrl);
  const youtube = sanitizeHttpUrl(recipe.sourceChannelUrl);

  const open = (url: string) => {
    const safe = sanitizeHttpUrl(url);
    if (safe) void Linking.openURL(safe);
  };

  return (
    <View className={`flex-row flex-wrap items-center ${className}`}>
      <Text className="text-xs text-muted">{MEALDB_COPY.attribution}</Text>
      {mealDbPage ? (
        <>
          <Text className="text-xs text-muted"> — </Text>
          <Pressable
            onPress={() => open(mealDbPage)}
            accessibilityRole="link"
            accessibilityLabel={MEALDB_COPY.mealPageAccessibility(recipe.name)}
            hitSlop={4}
          >
            <Text className="text-xs font-semibold text-primary">{MEALDB_COPY.attributionLinkLabel}</Text>
          </Pressable>
        </>
      ) : null}
      {original ? (
        <>
          <Text className="text-xs text-muted">{RECIPE_IMPORT_COPY.creditSeparator}</Text>
          <Pressable
            onPress={() => open(original)}
            accessibilityRole="link"
            accessibilityLabel={RECIPE_IMPORT_COPY.viewOriginalAccessibility}
            hitSlop={4}
          >
            <Text className="text-xs font-semibold text-primary">{RECIPE_IMPORT_COPY.viewOriginal}</Text>
          </Pressable>
        </>
      ) : null}
      {youtube ? (
        <>
          <Text className="text-xs text-muted">{RECIPE_IMPORT_COPY.creditSeparator}</Text>
          <Pressable
            onPress={() => open(youtube)}
            accessibilityRole="link"
            accessibilityLabel="Watch recipe video on YouTube"
            hitSlop={4}
          >
            <Text className="text-xs font-semibold text-primary">YouTube</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
