import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { CREATOR_RECIPES_COPY } from '../../config/creatorRecipes';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { recipeListShopLine } from '../../lib/recipes/recipeListShopLine';
import type { CreatorFeedCardModel } from '../../lib/recipes/creatorFeedRows';
import { DietAllergenBadge } from '../diet/DietAllergenBadge';
import { ingredientLinesFromCreatorModel } from '../../lib/diet/ingredientLines';
import { RecipeThumbnail } from './RecipeThumbnail';
import { RecipeSaveButton } from './RecipeSaveButton';
import { CookThisButton } from '../mealCalendar/CookThisButton';

interface CreatorRecipesFeedCardProps {
  model: CreatorFeedCardModel;
  onOpen: () => void;
  onCook?: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  saveDisabled?: boolean;
  /** Home 2-column grid: half-width card with the shorter photo. */
  grid?: boolean;
}

const GRID_CARD_STYLE = { width: '48.4%' } as const;
const GRID_IMAGE_HEIGHT = 108;

function CreatorRecipesFeedCardInner({
  model,
  onOpen,
  onCook,
  saved,
  onToggleSave,
  saveDisabled = false,
  grid = false,
}: CreatorRecipesFeedCardProps) {
  const { item, match, importedRecipe, sourceLabel } = model;
  const name = importedRecipe?.name ?? item.title;
  const imageUri = importedRecipe?.imageUrl ?? item.thumbnailUrl;
  const readyToCook = match != null && match.missingCount === 0;
  const shopLine = match != null ? recipeListShopLine(match) : null;
  // Pantry match pill ("You have 6 of 8") — same numbers and wording as the pantry badge helper.
  const pantryPill =
    match == null || match.totalIngredients === 0
      ? null
      : match.missingCount === 0
        ? RECIPES_COPY.pantryOverlap.readyToCook
        : RECIPES_COPY.pantryOverlap.youHave(match.matchedCount, match.totalIngredients);
  const showShopLine = !(pantryPill && readyToCook);
  const ingredientLines = ingredientLinesFromCreatorModel(model);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={shopLine ? `${name}. ${shopLine}` : name}
      className="mb-3 overflow-hidden rounded-[18px] border border-border bg-card"
      style={grid ? GRID_CARD_STYLE : undefined}
    >
      <View className="relative">
        <RecipeThumbnail
          uri={imageUri}
          accessibilityLabel=""
          height={grid ? GRID_IMAGE_HEIGHT : RECIPE_IMAGE.listHeight}
          lazy
        />
        <DietAllergenBadge ingredientLines={ingredientLines} />
        {onToggleSave ? (
          <View className="absolute right-1.5 top-1.5">
            <RecipeSaveButton
              saved={Boolean(saved)}
              onToggle={onToggleSave}
              size={20}
              disabled={saveDisabled}
              className="h-11 w-11"
            />
          </View>
        ) : null}
      </View>
      <View className="p-3">
        <Text className="text-[15px] font-bold leading-[18px] text-ink" numberOfLines={2}>
          {name}
        </Text>
        {pantryPill ? (
          <View className="mt-2 self-start rounded-[10px] bg-primary-light px-2 py-1">
            <Text className="text-xs font-bold text-primary" numberOfLines={1}>
              {pantryPill}
            </Text>
          </View>
        ) : null}
        {shopLine ? (
          showShopLine ? (
            <Text
              className={`mt-1.5 text-xs ${readyToCook ? 'text-success-accent' : 'text-danger'}`}
              numberOfLines={1}
            >
              {shopLine}
            </Text>
          ) : null
        ) : (
          <Text className="mt-1.5 text-xs text-muted" numberOfLines={1}>
            {CREATOR_RECIPES_COPY.cardTapToImport}
          </Text>
        )}
        <Text className="mt-1 text-[11px] text-muted" numberOfLines={1}>
          {sourceLabel}
        </Text>
        {onCook ? (
          <View className="mt-2">
            <CookThisButton
              compact
              className="min-h-[44px] justify-center self-start"
              onPress={onCook}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export const CreatorRecipesFeedCard = memo(CreatorRecipesFeedCardInner);
