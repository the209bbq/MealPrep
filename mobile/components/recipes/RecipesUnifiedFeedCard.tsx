import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { RECIPE_IMAGE } from '../../config/recipeImages';
import { recipeListShopLine } from '../../lib/recipes/recipeListShopLine';
import {
  resolveDiscoveryRecipeImageUrl,
  resolveKitchenRecipeImageUrl,
} from '../../lib/recipes/recipeImageUrl';
import { DietAllergenBadge } from '../diet/DietAllergenBadge';
import { ingredientLinesFromRecipesTabRow } from '../../lib/diet/ingredientLines';
import { RecipeThumbnail } from './RecipeThumbnail';
import { RecipeSaveButton } from './RecipeSaveButton';
import { CookThisButton } from '../mealCalendar/CookThisButton';
import { RECIPES_COPY } from '../../config/recipesCopy';

interface RecipesUnifiedFeedCardProps {
  row: RecipesTabRow;
  onOpen: () => void;
  onCook?: () => void;
  sourceTag?: string | null;
  saved?: boolean;
  onToggleSave?: () => void;
  saveDisabled?: boolean;
}

function RecipesUnifiedFeedCardInner({
  row,
  onOpen,
  onCook,
  sourceTag,
  saved,
  onToggleSave,
  saveDisabled = false,
}: RecipesUnifiedFeedCardProps) {
  const name = row.recipe.name;
  const imageUri = useMemo(
    () =>
      row.kind === 'kitchen'
        ? resolveKitchenRecipeImageUrl(row.recipe)
        : resolveDiscoveryRecipeImageUrl(row.recipe),
    [row],
  );
  const matchPending = row.kind === 'kitchen' && Boolean(row.pantryMatchPending);
  const shopLine = useMemo(() => {
    if (matchPending) return RECIPES_COPY.recipeCard.checkingPantry;
    return recipeListShopLine(row.match);
  }, [matchPending, row.match]);
  const readyToCook = !matchPending && row.match.missingCount === 0;
  const ingredientLines = useMemo(() => ingredientLinesFromRecipesTabRow(row), [row]);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${shopLine}`}
      className="mb-2 overflow-hidden rounded-xl border border-border bg-card"
    >
      <View className="relative">
        <RecipeThumbnail
          uri={imageUri}
          accessibilityLabel=""
          height={RECIPE_IMAGE.listHeight}
          lazy
        />
        <DietAllergenBadge ingredientLines={ingredientLines} />
        {onToggleSave ? (
          <View className="absolute right-2 top-2">
            <RecipeSaveButton
              saved={Boolean(saved)}
              onToggle={onToggleSave}
              size={20}
              disabled={saveDisabled}
            />
          </View>
        ) : null}
      </View>
      <View className="px-3 py-2.5">
        <Text className="text-base font-semibold text-ink" numberOfLines={2}>
          {name}
        </Text>
        <Text
          className={`mt-0.5 text-xs ${readyToCook ? 'text-success-accent' : 'text-danger'}`}
          numberOfLines={1}
        >
          {shopLine}
        </Text>
        {sourceTag ? (
          <Text className="mt-1 text-[11px] text-muted" numberOfLines={1}>
            {sourceTag}
          </Text>
        ) : null}
        {onCook ? (
          <View className="mt-2">
            <CookThisButton compact className="self-start" onPress={onCook} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export const RecipesUnifiedFeedCard = memo(RecipesUnifiedFeedCardInner);
