import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatQuantityWithUnit, formatIngredientText } from '../../lib/formatQuantity';
import { formatUsd, type RecipeCostEstimate } from '../../lib/costPerServing';
import { RECIPES_COPY } from '../../config/recipesCopy';

type Props = {
  estimate: RecipeCostEstimate | null;
};

export function RecipeCostPerServingLine({ estimate }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!estimate || estimate.costPerServing == null || estimate.pricedCount === 0) {
    return null;
  }

  const headline = RECIPES_COPY.recipeDetail.costPerServingAbout(formatUsd(estimate.costPerServing));
  const meta = RECIPES_COPY.recipeDetail.costEstimateMeta(
    estimate.unpricedCount,
    estimate.servingsAssumedDefault,
  );

  return (
    <View className="mt-1">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={RECIPES_COPY.recipeDetail.costPerServingAccessibility(
          estimate.costPerServing,
          estimate.unpricedCount,
        )}
        className="self-start"
      >
        <Text className="text-sm font-semibold text-ink">{headline}</Text>
        <Text className="text-xs text-muted">{meta}</Text>
      </Pressable>
      {expanded ? (
        <View className="mt-2 rounded-lg border border-border bg-card px-3 py-2">
          {estimate.lines
            .filter((line) => line.cost != null)
            .map((line) => {
              const name = formatIngredientText(line.ingredient.name);
              const amount =
                line.ingredient.quantity > 0
                  ? formatQuantityWithUnit(line.ingredient.quantity, line.ingredient.unit)
                  : '';
              return (
                <View
                  key={line.ingredient.ingredientId}
                  className="flex-row items-center justify-between py-1"
                >
                  <Text className="mr-2 flex-1 text-xs text-ink" numberOfLines={2}>
                    {amount ? `${name} (${amount})` : name}
                  </Text>
                  <Text className="text-xs font-medium text-ink">{formatUsd(line.cost!)}</Text>
                </View>
              );
            })}
          <View className="mt-1 flex-row justify-between border-t border-border pt-2">
            <Text className="text-xs text-muted">
              {RECIPES_COPY.recipeDetail.costBreakdownTotal(estimate.servings)}
            </Text>
            <Text className="text-xs font-semibold text-ink">{formatUsd(estimate.totalCost)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
