import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from './Card';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import { THEME } from '../config/appConfig';
import { Ionicons } from '@expo/vector-icons';

interface CookFromPantryCardProps {
  recommendations: RecipePantryMatch[];
  onOpenRecipe: (recipeId: string) => void;
  onAddMissing?: (recipeId: string) => void;
}

export function CookFromPantryCard({ recommendations, onOpenRecipe, onAddMissing }: CookFromPantryCardProps) {
  if (recommendations.length === 0) return null;

  return (
    <Card className="mt-4" title="Cook from your pantry" subtitle="Use what you have — fewer store runs">
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
                {match.matchedCount}/{match.totalIngredients} ingredients · {match.percentMatch}%
                {match.missingCount > 0 ? ` · ${match.missingCount} to buy` : ' · ready to cook'}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs font-bold text-emerald-dark">{match.percentMatch}%</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
            </View>
          </Pressable>
          {match.missingCount > 0 && onAddMissing ? (
            <Pressable
              onPress={() => onAddMissing(match.recipeId)}
              className="mb-3 items-center rounded-xl border border-emerald bg-emerald-light py-2"
            >
              <Text className="text-xs font-bold text-emerald-dark">Add missing to list</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable onPress={() => router.push('/recipes')} className="mt-2 items-center py-2">
        <Text className="text-sm font-bold text-emerald-dark">See all matches on Recipes</Text>
      </Pressable>
    </Card>
  );
}

export function RecipePantryMatchBadge({ match }: { match: RecipePantryMatch | undefined }) {
  if (!match || match.totalIngredients === 0) return null;
  const ready = match.missingCount === 0;
  return (
    <View className={`mt-2 self-start rounded-full px-2.5 py-1 ${ready ? 'bg-emerald-light' : 'bg-sand'}`}>
      <Text className={`text-xs font-bold ${ready ? 'text-emerald-dark' : 'text-slate'}`}>
        {match.matchedCount}/{match.totalIngredients} · {match.percentMatch}%
      </Text>
    </View>
  );
}
