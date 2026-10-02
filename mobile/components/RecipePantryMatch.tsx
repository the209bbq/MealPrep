import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from './Card';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import { THEME } from '../config/appConfig';
import {
  RECIPES_COPY,
  recipePantryBadgeLabel,
  recipePantryListSubtitle,
} from '../config/recipesCopy';
import { Ionicons } from '../lib/icons/Ionicons';

import type { Recipe } from '../types/mealprep';
import { scheduleTargetFromRecipeId } from '../lib/mealCalendar/scheduleTarget';
import { AddToCalendarButton } from './mealCalendar/AddToCalendarButton';

interface CookFromPantryCardProps {
  recommendations: RecipePantryMatch[];
  recipes: Recipe[];
  onOpenRecipe: (recipeId: string) => void;
  onAddMissing?: (recipeId: string) => void;
}

export function CookFromPantryCard({ recommendations, recipes, onOpenRecipe, onAddMissing }: CookFromPantryCardProps) {
  if (recommendations.length === 0) return null;

  return (
    <Card
      className="mt-4"
      title={RECIPES_COPY.cookFromPantryCard.title}
      subtitle={RECIPES_COPY.cookFromPantryCard.subtitle}
    >
      {recommendations.map((match, index) => (
        <View key={match.recipeId} className={index > 0 ? 'border-t border-border' : ''}>
          <Pressable
            onPress={() => onOpenRecipe(match.recipeId)}
            className="flex-row items-center justify-between py-3"
          >
            <View className="mr-3 flex-1">
              <Text className="font-bold text-ink" numberOfLines={1}>
                {match.recipeName}
              </Text>
              <Text className="mt-0.5 text-xs text-muted">
                {recipePantryListSubtitle(match.matchedCount, match.totalIngredients, match.missingCount)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <AddToCalendarButton
                target={{
                  ...scheduleTargetFromRecipeId(match.recipeId, recipes),
                  title: match.recipeName,
                }}
              />
              <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
            </View>
          </Pressable>
          {match.missingCount > 0 && onAddMissing ? (
            <Pressable
              onPress={() => onAddMissing(match.recipeId)}
              className="mb-3 items-center rounded-xl border border-primary bg-primary-light py-2"
            >
              <Text className="text-xs font-bold text-primary-dark">
                {RECIPES_COPY.cookFromPantryCard.addMissingShort}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable onPress={() => router.push('/recipes')} className="mt-2 items-center py-2">
        <Text className="text-sm font-bold text-primary-dark">{RECIPES_COPY.cookFromPantryCard.seeAllOnRecipes}</Text>
      </Pressable>
    </Card>
  );
}

export function RecipePantryMatchBadge({ match }: { match: RecipePantryMatch | undefined }) {
  if (!match || match.totalIngredients === 0) return null;
  const ready = match.missingCount === 0;
  const label = recipePantryBadgeLabel(match.matchedCount, match.totalIngredients, match.missingCount);
  return (
    <View className={`mt-2 self-start rounded-full px-2.5 py-1 ${ready ? 'bg-primary-light' : 'bg-sand'}`}>
      <Text className={`text-xs font-bold ${ready ? 'text-primary-dark' : 'text-slate'}`}>{label}</Text>
    </View>
  );
}
