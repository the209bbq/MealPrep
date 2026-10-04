import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { CREATOR_RECIPES_COPY } from '../../config/creatorRecipes';
import { recipeListShopLine } from '../../lib/recipes/recipeListShopLine';
import type { CreatorFeedCardModel } from '../../lib/recipes/creatorFeedRows';
import { RecipeThumbnail } from './RecipeThumbnail';
import { RecipeSaveButton } from './RecipeSaveButton';

interface CreatorRecipesFeedCardProps {
  model: CreatorFeedCardModel;
  onOpen: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
}

function CreatorRecipesFeedCardInner({
  model,
  onOpen,
  saved,
  onToggleSave,
}: CreatorRecipesFeedCardProps) {
  const { item, match, importedRecipe, sourceLabel } = model;
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
      <View className="relative">
        <RecipeThumbnail
          uri={imageUri}
          accessibilityLabel=""
          height={RECIPE_IMAGE.listHeight}
          lazy
        />
        {onToggleSave ? (
          <View className="absolute right-2 top-2">
            <RecipeSaveButton saved={Boolean(saved)} onToggle={onToggleSave} size={20} />
          </View>
        ) : null}
      </View>
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
            {CREATOR_RECIPES_COPY.cardTapToImport}
          </Text>
        )}
        <Text className="mt-1 text-[11px] text-muted" numberOfLines={1}>
          {sourceLabel}
        </Text>
      </View>
    </Pressable>
  );
}

export const CreatorRecipesFeedCard = memo(CreatorRecipesFeedCardInner);
