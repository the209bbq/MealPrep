import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { recipeListShopLine } from '../../lib/recipes/recipeListShopLine';
import {
  resolveDiscoveryRecipeImageUrl,
  resolveKitchenRecipeImageUrl,
} from '../../lib/recipes/recipeImageUrl';
import { RecipeThumbnail } from './RecipeThumbnail';

interface RecipesUnifiedFeedCardProps {
  row: RecipesTabRow;
  onOpen: () => void;
}

function RecipesUnifiedFeedCardInner({ row, onOpen }: RecipesUnifiedFeedCardProps) {
  const name = row.recipe.name;
  const imageUri = useMemo(
    () =>
      row.kind === 'kitchen'
        ? resolveKitchenRecipeImageUrl(row.recipe)
        : resolveDiscoveryRecipeImageUrl(row.recipe),
    [row],
  );
  const shopLine = useMemo(() => recipeListShopLine(row.match), [row.match]);
  const readyToCook = row.match.missingCount === 0;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${shopLine}`}
      className="mb-2 overflow-hidden rounded-xl border border-border bg-card"
    >
      <RecipeThumbnail
        uri={imageUri}
        accessibilityLabel=""
        height={RECIPE_IMAGE.listHeight}
        lazy
      />
      <View className="px-3 py-2.5">
        <Text className="text-base font-semibold text-ink" numberOfLines={2}>
          {name}
        </Text>
        <Text
          className={`mt-0.5 text-xs ${readyToCook ? 'text-success-accent' : 'text-muted'}`}
          numberOfLines={1}
        >
          {shopLine}
        </Text>
      </View>
    </Pressable>
  );
}

export const RecipesUnifiedFeedCard = memo(RecipesUnifiedFeedCardInner);
