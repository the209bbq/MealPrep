import { Linking, Pressable, Text, View } from 'react-native';
import { OPEN_FOOD_FACTS, OPEN_FOOD_FACTS_COPY } from '../../config/openFoodFacts';
import { sanitizeHttpUrl } from '../../lib/recipeImport/safeHttpUrl';

/** Required credit for Open Food Facts data (ODbL / CC BY-SA). Show it wherever their data appears. */
export function OpenFoodFactsCreditLine({
  pageUrl,
  className = 'mt-1',
}: {
  /** Product page on Open Food Facts; falls back to the site home. */
  pageUrl?: string | null;
  className?: string;
}) {
  const target = sanitizeHttpUrl(pageUrl) ?? sanitizeHttpUrl(OPEN_FOOD_FACTS.siteUrl);

  return (
    <View className={`flex-row flex-wrap items-center ${className}`}>
      <Text className="text-xs text-muted">{OPEN_FOOD_FACTS_COPY.attribution} </Text>
      <Pressable
        onPress={() => {
          if (target) void Linking.openURL(target);
        }}
        accessibilityRole="link"
        accessibilityLabel={OPEN_FOOD_FACTS_COPY.attributionAccessibility}
        hitSlop={4}
      >
        <Text className="text-xs font-semibold text-primary">{OPEN_FOOD_FACTS_COPY.attributionLinkLabel}</Text>
      </Pressable>
    </View>
  );
}
