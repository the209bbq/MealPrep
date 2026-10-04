import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { VIRAL_RECIPES_COPY } from '../../config/viralRecipes';
import { recipeListShopLine } from '../../lib/recipes/recipeListShopLine';
import type { ViralFeedCardModel } from '../../lib/recipes/viralFeedRows';
import { RecipeThumbnail } from './RecipeThumbnail';

interface ViralRecipesFeedCardProps {
  model: ViralFeedCardModel;
  onOpen: () => void;
}

function ViralRecipesFeedCardInner({ model, onOpen }: ViralRecipesFeedCardProps) {
  const { item, match, importedRecipe } = model;
  const name = importedRecipe?.name ?? item.title;
  const imageUri = importedRecipe?.imageUrl ?? item.thumbnailUrl;
  const readyToCook = match != null && match.missingCount === 0;
  const shopLine = match != null ? recipeListShopLine(match) : null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={shopLine ? `${name}. ${shopLine}` : name}
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
        {shopLine ? (
          <Text
            className={`mt-0.5 text-xs ${readyToCook ? 'text-success-accent' : 'text-danger'}`}
            numberOfLines={1}
          >
            {shopLine}
          </Text>
        ) : (
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {VIRAL_RECIPES_COPY.cardTapToImport}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const ViralRecipesFeedCard = memo(ViralRecipesFeedCardInner);
