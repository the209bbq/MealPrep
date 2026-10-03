import { Linking, Pressable, Text, View } from 'react-native';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';

export interface RecipeSourceCreditLineProps {
  creatorName?: string | null;
  creatorUrl?: string | null;
  originalUrl?: string | null;
  className?: string;
}

export function RecipeSourceCreditLine({
  creatorName,
  creatorUrl,
  originalUrl,
  className = 'mt-2',
}: RecipeSourceCreditLineProps) {
  const name = creatorName?.trim();
  const original = originalUrl?.trim();
  if (!name && !original) return null;

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <View className={`flex-row flex-wrap items-center ${className}`}>
      {name ? (
        creatorUrl?.trim() ? (
          <Pressable
            onPress={() => open(creatorUrl.trim())}
            accessibilityRole="link"
            accessibilityLabel={RECIPE_IMPORT_COPY.creatorLinkAccessibility(name)}
            hitSlop={4}
          >
            <Text className="text-xs font-semibold text-primary">{RECIPE_IMPORT_COPY.byCreator(name)}</Text>
          </Pressable>
        ) : (
          <Text className="text-xs font-semibold text-muted" accessibilityRole="text">
            {RECIPE_IMPORT_COPY.byCreator(name)}
          </Text>
        )
      ) : null}
      {name && original ? (
        <Text className="text-xs text-muted" accessibilityElementsHidden importantForAccessibility="no">
          {RECIPE_IMPORT_COPY.creditSeparator}
        </Text>
      ) : null}
      {original ? (
        <Pressable
          onPress={() => open(original)}
          accessibilityRole="link"
          accessibilityLabel={RECIPE_IMPORT_COPY.viewOriginalAccessibility}
          hitSlop={4}
        >
          <Text className="text-xs font-semibold text-primary">{RECIPE_IMPORT_COPY.viewOriginal}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
