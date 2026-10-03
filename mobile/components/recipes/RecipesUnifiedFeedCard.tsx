import { Pressable, Text, View } from 'react-native';
import { Card } from '../Card';
import { AddToCalendarButton } from '../mealCalendar/AddToCalendarButton';
import { RecipePantryMatchBadge } from '../RecipePantryMatch';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { isUserOwnedKitchenRecipe } from '../../lib/recipeImport/mapToAppRecipe';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { nutritionLabel } from '../../lib/nutrition';
import {
  scheduleTargetFromDiscoveryRecipe,
  scheduleTargetFromKitchenRecipe,
} from '../../lib/mealCalendar/scheduleTarget';
import type { RecipeDiscoveryListItem } from '../../lib/recipeDiscovery/types';

interface RecipesUnifiedFeedCardProps {
  row: RecipesTabRow;
  onOpen: () => void;
  isOnMealPlan: (options: { recipeSlug?: string; recipeApiId?: number }) => boolean;
  onToggleKitchen: (recipeId: string) => void;
  onToggleDiscovery: (recipe: RecipeDiscoveryListItem) => void;
  onAddMissingKitchen?: (recipeId: string) => void;
  onAddMissingDiscovery?: (recipe: RecipeDiscoveryListItem) => void;
}

export function RecipesUnifiedFeedCard({
  row,
  onOpen,
  isOnMealPlan,
  onToggleKitchen,
  onToggleDiscovery,
  onAddMissingKitchen,
  onAddMissingDiscovery,
}: RecipesUnifiedFeedCardProps) {
  const match = row.match;
  const missingCount = match.missingCount;

  if (row.kind === 'kitchen') {
    const recipe = row.recipe;
    const onPlan = isOnMealPlan({ recipeSlug: recipe.id });
    return (
      <Card className="mb-3">
        <Pressable onPress={onOpen}>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-semibold uppercase text-primary">
                {isUserOwnedKitchenRecipe(recipe) ? RECIPE_IMPORT_COPY.yourRecipeBadge : recipe.tag}
              </Text>
              <Text className="text-base font-bold text-ink">{recipe.name}</Text>
              <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
                {recipe.description}
              </Text>
              <RecipePantryMatchBadge match={match} />
              <Text className="mt-2 text-xs text-muted">
                {recipe.servings} servings · {recipe.minutes} min · {nutritionLabel(recipe)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <AddToCalendarButton target={scheduleTargetFromKitchenRecipe(recipe)} />
              <Pressable
                onPress={() => void onToggleKitchen(recipe.id)}
                className={`rounded-full px-3 py-1 ${onPlan ? 'bg-primary' : 'border border-border bg-paper'}`}
              >
                <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-muted'}`}>
                  {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
        {missingCount > 0 && onAddMissingKitchen ? (
          <Pressable
            onPress={() => onAddMissingKitchen(recipe.id)}
            className="mt-3 items-center rounded-xl bg-primary py-3"
          >
            <Text className="text-sm font-bold text-on-primary">{RECIPES_COPY.recipeCard.addMissingCta}</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  }

  const recipe = row.recipe;
  const onPlan = isOnMealPlan({ recipeApiId: recipe.id });
  return (
    <Card className="mb-3">
      <Pressable onPress={onOpen}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-xs font-semibold uppercase text-primary">{recipe.cuisine}</Text>
            <Text className="text-base font-bold text-ink">{recipe.name}</Text>
            <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
              {recipe.description}
            </Text>
            <RecipePantryMatchBadge match={match} />
            <Text className="mt-2 text-xs text-muted">
              {recipe.servings} servings · {recipe.prep_time + recipe.cook_time} min ·{' '}
              {recipe.calories_per_serving} cal
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <AddToCalendarButton target={scheduleTargetFromDiscoveryRecipe(recipe)} />
            <Pressable
              onPress={() => void onToggleDiscovery(recipe)}
              className={`rounded-full px-3 py-1 ${onPlan ? 'bg-primary' : 'border border-border bg-paper'}`}
            >
              <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-muted'}`}>
                {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
      {missingCount > 0 && onAddMissingDiscovery ? (
        <Pressable
          onPress={() => onAddMissingDiscovery(recipe)}
          className="mt-3 items-center rounded-xl bg-primary py-3"
        >
          <Text className="text-sm font-bold text-on-primary">{RECIPES_COPY.recipeCard.addMissingCta}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
