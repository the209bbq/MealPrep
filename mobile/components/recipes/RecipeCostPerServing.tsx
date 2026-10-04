import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { formatUsd, formatUsdAboutPerServing } from '../../lib/costPerServing/formatUsd';
import { useRecipeCostEstimate } from '../../lib/costPerServing/useRecipeCostEstimate';
import type { Recipe } from '../../types/mealprep';

export interface RecipeCostPerServingProps {
  recipe: Recipe;
  ownerId: string;
  className?: string;
}

export function RecipeCostPerServing({ recipe, ownerId, className = 'mt-2' }: RecipeCostPerServingProps) {
  const estimate = useRecipeCostEstimate(recipe, ownerId);
  const [expanded, setExpanded] = useState(false);

  if (!estimate || estimate.costPerServing === null || estimate.pricedCount === 0) {
    return null;
  }

  const skipped = estimate.skippedCount;
  const meta = RECIPES_COPY.recipeDetail.costEstimateMeta(skipped);
  const headline = formatUsdAboutPerServing(estimate.costPerServing);

  return (
    <View className={className}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${headline}. ${meta}. ${expanded ? 'Collapse' : 'Expand'} cost breakdown`}
        className="self-start"
      >
        <Text className="text-sm font-semibold text-ink">{headline}</Text>
        <Text className="text-xs text-muted">
          {meta}
          {estimate.usedDefaultServings ? ` · ${RECIPES_COPY.recipeDetail.costDefaultServingsNote}` : ''}
        </Text>
      </Pressable>

      {expanded ? (
        <View className="mt-2 rounded-lg border border-border bg-card px-3 py-2">
          {estimate.lines
            .filter((line) => !line.skipped && line.cost !== null)
            .map((line) => (
              <View key={line.ingredientId} className="flex-row justify-between py-1">
                <Text className="mr-2 flex-1 text-xs text-ink" numberOfLines={2}>
                  {line.name}
                </Text>
                <Text className="text-xs font-medium text-muted">{formatUsd(line.cost ?? 0)}</Text>
              </View>
            ))}
          <View className="mt-1 flex-row justify-between border-t border-border pt-2">
            <Text className="text-xs font-semibold text-ink">
              {RECIPES_COPY.recipeDetail.costBreakdownTotal(estimate.servings)}
            </Text>
            <Text className="text-xs font-semibold text-ink">{formatUsd(estimate.totalCost)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
