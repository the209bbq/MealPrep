import { Linking, Pressable, Text, View } from 'react-native';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { sanitizeHttpUrl } from '../../lib/recipeImport/safeHttpUrl';

export interface RecipeSourceCreditLineProps {
  creatorName?: string | null;
  creatorUrl?: string | null;
  originalUrl?: string | null;
  plainCreatorCredit?: boolean;
  viewOriginalLabel?: string;
  viewOriginalAccessibility?: string;
  className?: string;
}

export function RecipeSourceCreditLine({
  creatorName,
  creatorUrl,
  originalUrl,
  plainCreatorCredit = false,
  viewOriginalLabel = RECIPE_IMPORT_COPY.viewOriginal,
  viewOriginalAccessibility = RECIPE_IMPORT_COPY.viewOriginalAccessibility,
  className = 'mt-2',
}: RecipeSourceCreditLineProps) {
  const name = creatorName?.trim();
  const safeCreator = sanitizeHttpUrl(creatorUrl);
  const safeOriginal = sanitizeHttpUrl(originalUrl);
  if (!name && !safeOriginal) return null;

  const open = (url: string) => {
    const safe = sanitizeHttpUrl(url);
    if (safe) void Linking.openURL(safe);
  };

  return (
    <View className={`flex-row flex-wrap items-center ${className}`}>
      {name ? (
        safeCreator ? (
          <Pressable
            onPress={() => open(safeCreator)}
            accessibilityRole="link"
            accessibilityLabel={RECIPE_IMPORT_COPY.creatorLinkAccessibility(name)}
            hitSlop={4}
          >
            <Text className="text-xs font-semibold text-primary">
              {plainCreatorCredit ? name : RECIPE_IMPORT_COPY.byCreator(name)}
            </Text>
          </Pressable>
        ) : (
          <Text className="text-xs font-semibold text-muted" accessibilityRole="text">
            {plainCreatorCredit ? name : RECIPE_IMPORT_COPY.byCreator(name)}
          </Text>
        )
      ) : null}
      {name && safeOriginal ? (
        <Text className="text-xs text-muted" accessibilityElementsHidden importantForAccessibility="no">
          {RECIPE_IMPORT_COPY.creditSeparator}
        </Text>
      ) : null}
      {safeOriginal ? (
        <Pressable
          onPress={() => open(safeOriginal)}
          accessibilityRole="link"
          accessibilityLabel={viewOriginalAccessibility}
          hitSlop={4}
        >
          <Text className="text-sm font-semibold text-primary">{viewOriginalLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
