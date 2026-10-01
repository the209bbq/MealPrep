import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { FilterChips } from '../components/FilterChips';
import { isRecipeDiscoveryConfigured, RECIPE_DISCOVERY, THEME } from '../config/appConfig';
import { RECIPES_COPY } from '../config/recipesCopy';
import { useApp } from '../context/AppContext';
import {
  debouncedSearch,
  RecipeDiscoveryAuthError,
  RecipeDiscoveryNotConfiguredError,
  searchDiscoveryRecipes,
} from '../lib/recipeDiscovery/client';
import { getRecipeDiscoveryAccessToken } from '../lib/recipeDiscovery/accessToken';
import {
  RECIPE_DISCOVERY_CUISINES,
  RECIPE_DISCOVERY_DIFFICULTIES,
  RECIPE_DISCOVERY_DIETARY,
  RECIPE_DISCOVERY_MEAL_TYPES,
} from '../lib/recipeDiscovery/filters';
import type { RecipeApiCuisine, RecipeApiDietaryTag, RecipeApiDifficulty, RecipeApiMealType } from '../lib/recipeDiscovery/types';

export default function DiscoverRecipesScreen() {
  const insets = useSafeAreaInsets();
  const { session, demoMode } = useApp();
  const accessToken = getRecipeDiscoveryAccessToken(session);

  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState<RecipeApiCuisine | ''>('');
  const [difficulty, setDifficulty] = useState<RecipeApiDifficulty | ''>('');
  const [mealType, setMealType] = useState<RecipeApiMealType | ''>('');
  const [dietaryTag, setDietaryTag] = useState<RecipeApiDietaryTag | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [items, setItems] = useState<Awaited<ReturnType<typeof searchDiscoveryRecipes>>['items']>([]);
  const [total, setTotal] = useState(0);

  const filters = useMemo(
    () => ({
      search,
      cuisine: cuisine || undefined,
      difficulty: difficulty || undefined,
      mealType: mealType || undefined,
      dietaryTag: dietaryTag || undefined,
      page: 1,
      perPage: RECIPE_DISCOVERY.defaultPerPage,
    }),
    [cuisine, difficulty, dietaryTag, mealType, search],
  );

  const runSearch = useCallback(async () => {
    if (!RECIPE_DISCOVERY.enabled) return;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const result = await searchDiscoveryRecipes(filters, accessToken);
      setItems(result.items);
      setTotal(result.meta?.total ?? result.items.length);
    } catch (err) {
      if (err instanceof RecipeDiscoveryNotConfiguredError) {
        setNotConfigured(true);
        setItems([]);
        setTotal(0);
      } else if (err instanceof RecipeDiscoveryAuthError) {
        setError(err.message);
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters]);

  const authBlocked = !demoMode && !accessToken;
  const searchRequestKey = useMemo(
    () => `${accessToken ?? ''}:${JSON.stringify(filters)}`,
    [accessToken, filters],
  );
  const [settledSearchKey, setSettledSearchKey] = useState('');

  useEffect(() => {
    if (!RECIPE_DISCOVERY.enabled) return;
    if (demoMode) {
      queueMicrotask(() => {
        void runSearch();
      });
      return;
    }
    if (!accessToken) return;
    debouncedSearch(
      filters,
      accessToken,
      (result) => {
        setItems(result.items);
        setTotal(result.meta?.total ?? result.items.length);
        setSettledSearchKey(searchRequestKey);
        setError(null);
        setNotConfigured(false);
      },
      (err) => {
        if (err instanceof RecipeDiscoveryNotConfiguredError) {
          setNotConfigured(true);
          setItems([]);
        } else {
          setError(err.message);
        }
        setSettledSearchKey(searchRequestKey);
      },
    );
  }, [accessToken, demoMode, filters, runSearch, searchRequestKey]);

  const debouncedLoading = !demoMode && Boolean(accessToken) && searchRequestKey !== settledSearchKey;
  const screenLoading = demoMode ? loading : debouncedLoading;

  const showSetupHint = notConfigured || (!demoMode && !isRecipeDiscoveryConfigured());
  const screenError = authBlocked ? RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild : error;

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="chevron-back" size={24} color={THEME.ink} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-ink">Discover recipes</Text>
      </View>

      <ScrollView className="flex-1 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="mt-4 text-sm text-muted">
          Search online recipes and import them into your kitchen library.
        </Text>

        {demoMode ? (
          <View className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <Text className="text-xs font-semibold text-amber-900">Demo mode</Text>
            <Text className="mt-1 text-xs text-amber-800">
              Results below are labeled sample data only. Sign in with a connected account for live search.
            </Text>
          </View>
        ) : null}

        {showSetupHint ? (
          <Card className="mt-4 border-dashed">
            <Text className="text-sm font-semibold text-ink">Not set up yet</Text>
            <Text className="mt-2 text-sm text-muted">
              Recipe search isn’t connected yet. Ask an admin to finish setup, then try again.
            </Text>
          </Card>
        ) : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name (e.g. pasta)"
          placeholderTextColor={THEME.muted}
          className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text className="mt-4 text-xs font-semibold uppercase text-muted">Cuisine</Text>
        <FilterChips
          options={RECIPE_DISCOVERY_CUISINES.map((c) => ({ id: c.value, label: c.label }))}
          selectedId={cuisine || null}
          onSelect={(id) => setCuisine((id as RecipeApiCuisine) || '')}
        />

        <Text className="mt-3 text-xs font-semibold uppercase text-muted">Difficulty</Text>
        <FilterChips
          options={RECIPE_DISCOVERY_DIFFICULTIES.map((c) => ({ id: c.value, label: c.label }))}
          selectedId={difficulty || null}
          onSelect={(id) => setDifficulty((id as RecipeApiDifficulty) || '')}
        />

        <Text className="mt-3 text-xs font-semibold uppercase text-muted">Meal type</Text>
        <FilterChips
          options={RECIPE_DISCOVERY_MEAL_TYPES.map((c) => ({ id: c.value, label: c.label }))}
          selectedId={mealType || null}
          onSelect={(id) => setMealType((id as RecipeApiMealType) || '')}
        />

        <Text className="mt-3 text-xs font-semibold uppercase text-muted">Dietary</Text>
        <FilterChips
          options={RECIPE_DISCOVERY_DIETARY.map((c) => ({ id: c.value, label: c.label }))}
          selectedId={dietaryTag || null}
          onSelect={(id) => setDietaryTag((id as RecipeApiDietaryTag) || '')}
        />

        {screenError ? <Text className="mt-4 text-sm text-danger">{screenError}</Text> : null}

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-ink">
            {screenLoading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
          </Text>
          {screenLoading ? <ActivityIndicator color={THEME.primary} /> : null}
        </View>

        {items.map((recipe) => (
          <Pressable
            key={recipe.id}
            onPress={() => router.push(`/discover-recipes/${recipe.id}`)}
            className="mt-3"
          >
            <Card>
              {recipe.isDemoSample ? (
                <Text className="mb-1 text-[10px] font-bold uppercase text-amber-700">Demo sample</Text>
              ) : null}
              <Text className="text-xs font-semibold uppercase text-primary">{recipe.cuisine}</Text>
              <Text className="text-base font-bold text-ink">{recipe.name}</Text>
              <Text className="mt-1 text-sm text-muted" numberOfLines={2}>{recipe.description}</Text>
              <Text className="mt-2 text-xs text-muted">
                {recipe.servings} servings · {recipe.prep_time + recipe.cook_time} min ·{' '}
                {recipe.calories_per_serving} cal · {recipe.protein}g protein
              </Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
