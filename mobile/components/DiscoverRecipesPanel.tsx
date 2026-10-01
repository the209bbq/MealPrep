import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from './Card';
import { FilterChips } from './FilterChips';
import { RecipePantryMatchBadge } from './RecipePantryMatch';
import { isRecipeDiscoveryConfigured, RECIPE_DISCOVERY, RECIPES_TAB, THEME } from '../config/appConfig';
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
  isActiveRecipeDiscoverySearch,
  RECIPE_DISCOVERY_CUISINES,
  RECIPE_DISCOVERY_DIFFICULTIES,
  RECIPE_DISCOVERY_DIETARY,
  RECIPE_DISCOVERY_MAX_MINUTES,
  RECIPE_DISCOVERY_MEAL_TYPES,
} from '../lib/recipeDiscovery/filters';
import { compareRecipePantryMatches } from '../lib/recipeMatch';
import { scoreDiscoveryRecipeAgainstPantry } from '../lib/recipeDiscovery/scorePantry';
import type {
  RecipeApiCuisine,
  RecipeApiDietaryTag,
  RecipeApiDifficulty,
  RecipeApiMealType,
} from '../lib/recipeDiscovery/types';

interface DiscoverRecipesPanelProps {
  onToggleMealPlan: (item: Awaited<ReturnType<typeof searchDiscoveryRecipes>>['items'][number]) => void;
  isOnMealPlan: (recipeApiId: number) => boolean;
  onAddMissing?: (item: Awaited<ReturnType<typeof searchDiscoveryRecipes>>['items'][number]) => void;
}

export function DiscoverRecipesPanel({ onToggleMealPlan, isOnMealPlan, onAddMissing }: DiscoverRecipesPanelProps) {
  const { session, demoMode, pantry } = useApp();
  const accessToken = getRecipeDiscoveryAccessToken(session);
  const [expanded, setExpanded] = useState(false);

  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState<RecipeApiCuisine | ''>('');
  const [difficulty, setDifficulty] = useState<RecipeApiDifficulty | ''>('');
  const [mealType, setMealType] = useState<RecipeApiMealType | ''>('');
  const [dietaryTag, setDietaryTag] = useState<RecipeApiDietaryTag | ''>('');
  const [maxMinutes, setMaxMinutes] = useState<number | ''>('');
  const [matchPantryOnly, setMatchPantryOnly] = useState(false);
  const [minPantryPercent, setMinPantryPercent] = useState(0);
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
      maxTotalMinutes: maxMinutes === '' ? undefined : maxMinutes,
      page: 1,
      perPage: RECIPE_DISCOVERY.defaultPerPage,
    }),
    [cuisine, difficulty, dietaryTag, maxMinutes, mealType, search],
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

  const discoveryQueryActive = isActiveRecipeDiscoverySearch(filters);
  const discoveryIdle = RECIPES_TAB.discoverRequiresActiveQuery && !discoveryQueryActive;
  const authBlocked = !demoMode && !accessToken && !discoveryIdle;
  const searchRequestKey = useMemo(
    () => `${accessToken ?? ''}:${JSON.stringify(filters)}`,
    [accessToken, filters],
  );
  const [settledSearchKey, setSettledSearchKey] = useState('');

  useEffect(() => {
    if (!RECIPE_DISCOVERY.enabled) return;
    if (discoveryIdle) return;
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
  }, [accessToken, demoMode, discoveryIdle, filters, runSearch, searchRequestKey]);

  const debouncedLoading =
    !discoveryIdle && !demoMode && Boolean(accessToken) && searchRequestKey !== settledSearchKey;
  const panelItems = useMemo(() => (discoveryIdle ? [] : items), [discoveryIdle, items]);
  const panelTotal = discoveryIdle ? 0 : total;
  const panelLoading = discoveryIdle ? false : demoMode ? loading : debouncedLoading;
  const panelError = authBlocked ? RECIPES_COPY.discoveryPanel.searchNotAvailableInBuild : error;

  const displayItems = useMemo(() => {
    let list = panelItems.map((recipe) => ({
      recipe,
      match: scoreDiscoveryRecipeAgainstPantry(recipe, pantry),
    }));
    if (matchPantryOnly || minPantryPercent > 0) {
      list = list.filter((row) => row.match.percentMatch >= (matchPantryOnly ? Math.max(minPantryPercent, 1) : minPantryPercent));
    }
    if (matchPantryOnly) {
      list = list.filter((row) => row.match.matchedCount > 0);
    }
    list.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
    return list;
  }, [panelItems, matchPantryOnly, minPantryPercent, pantry]);

  const showSetupHint = notConfigured || (!demoMode && !isRecipeDiscoveryConfigured());

  if (!RECIPE_DISCOVERY.enabled) return null;

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        className="mb-4 mt-6 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-4"
      >
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold text-ink">{RECIPES_COPY.discoveryPanel.collapsedTitle}</Text>
          <Text className="mt-1 text-sm text-muted">{RECIPES_COPY.discoveryPanel.collapsedSubtitle}</Text>
        </View>
        <Ionicons name="chevron-down" size={22} color={THEME.muted} />
      </Pressable>
    );
  }

  return (
    <View className="mb-4 mt-6 overflow-hidden rounded-2xl border border-primary bg-card px-4 py-5">
      <Pressable onPress={() => setExpanded(false)} className="mb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-ink">{RECIPES_COPY.discoveryPanel.collapsedTitle}</Text>
        <Ionicons name="chevron-up" size={22} color={THEME.muted} />
      </Pressable>
      <Text className="mt-1 text-sm text-muted">{RECIPES_COPY.discoveryPanel.expandedIntro}</Text>

      {demoMode ? (
        <View className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Text className="text-xs font-semibold text-amber-900">{RECIPES_COPY.discoveryPanel.demoBannerTitle}</Text>
          <Text className="mt-1 text-xs text-amber-800">{RECIPES_COPY.discoveryPanel.demoBannerBody}</Text>
        </View>
      ) : null}

      {showSetupHint ? (
        <Card className="mt-3 border-dashed">
          <Text className="text-sm font-semibold text-ink">{RECIPES_COPY.discoveryPanel.notSetupTitle}</Text>
          <Text className="mt-2 text-sm text-muted">{RECIPES_COPY.discoveryPanel.notSetupBody}</Text>
        </Card>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={RECIPES_COPY.discoveryPanel.searchPlaceholder}
        placeholderTextColor={THEME.muted}
        className="mt-4 rounded-2xl border-2 border-primary/30 bg-paper px-5 py-4 text-lg text-ink"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text className="mt-4 text-xs font-semibold uppercase text-muted">Cuisine</Text>
      <FilterChips
        options={RECIPE_DISCOVERY_CUISINES.map((c) => ({ id: c.value, label: c.label }))}
        selectedId={cuisine || null}
        onSelect={(id) => setCuisine((id as RecipeApiCuisine) || '')}
      />

      <Text className="mt-3 text-xs font-semibold uppercase text-muted">Meal type</Text>
      <FilterChips
        options={RECIPE_DISCOVERY_MEAL_TYPES.map((c) => ({ id: c.value, label: c.label }))}
        selectedId={mealType || null}
        onSelect={(id) => setMealType((id as RecipeApiMealType) || '')}
      />

      <Text className="mt-3 text-xs font-semibold uppercase text-muted">Diet</Text>
      <FilterChips
        options={RECIPE_DISCOVERY_DIETARY.map((c) => ({ id: c.value, label: c.label }))}
        selectedId={dietaryTag || null}
        onSelect={(id) => setDietaryTag((id as RecipeApiDietaryTag) || '')}
      />

      <Text className="mt-3 text-xs font-semibold uppercase text-muted">Difficulty</Text>
      <FilterChips
        options={RECIPE_DISCOVERY_DIFFICULTIES.map((c) => ({ id: c.value, label: c.label }))}
        selectedId={difficulty || null}
        onSelect={(id) => setDifficulty((id as RecipeApiDifficulty) || '')}
      />

      <Text className="mt-3 text-xs font-semibold uppercase text-muted">Max time</Text>
      <View className="mt-1 flex-row flex-wrap gap-2">
        {RECIPE_DISCOVERY_MAX_MINUTES.map((mins) => {
          const active = maxMinutes === mins;
          return (
            <Pressable
              key={mins}
              onPress={() => setMaxMinutes(active ? '' : mins)}
              className={`rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'border border-border bg-paper'}`}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-on-primary' : 'text-muted'}`}>
                {mins} min
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-3 text-xs font-semibold uppercase text-muted">{RECIPES_COPY.discoveryPanel.pantryOverlapSection}</Text>
      <View className="mt-1 flex-row flex-wrap items-center gap-2">
        <Pressable
          onPress={() => setMatchPantryOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 ${matchPantryOnly ? 'bg-primary' : 'border border-border bg-paper'}`}
        >
          <Text className={`text-xs font-semibold ${matchPantryOnly ? 'text-on-primary' : 'text-muted'}`}>
            {RECIPES_COPY.discoveryPanel.matchMyPantryChip}
          </Text>
        </Pressable>
        {([0, 50, 70] as const).map((pct) => {
          const active = minPantryPercent === pct;
          return (
            <Pressable
              key={pct}
              onPress={() => setMinPantryPercent(pct)}
              className={`rounded-full px-3 py-1.5 ${active ? 'bg-primary-light' : 'border border-border bg-paper'}`}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-primary-dark' : 'text-muted'}`}>
                {RECIPES_COPY.discoveryPanel.discoverMinOverlapChips[pct]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {panelError ? <Text className="mt-4 text-sm text-danger">{panelError}</Text> : null}

      {RECIPES_TAB.discoverRequiresActiveQuery && !discoveryQueryActive ? (
        <Text className="mt-4 text-sm text-muted">{RECIPES_COPY.discoveryPanel.idleHint}</Text>
      ) : (
        <>
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-ink">
              {panelLoading
                ? RECIPES_COPY.discoveryPanel.searching
                : !panelLoading && panelTotal > displayItems.length
                  ? RECIPES_COPY.discoveryPanel.resultCountOfTotal(displayItems.length, panelTotal)
                  : RECIPES_COPY.discoveryPanel.resultCount(displayItems.length)}
            </Text>
            {panelLoading ? <ActivityIndicator color={THEME.primary} /> : null}
          </View>

          {displayItems.length === 0 && !panelLoading ? (
            <Text className="mt-3 text-sm text-muted">{RECIPES_COPY.discoveryPanel.noFilterResults}</Text>
          ) : null}

          {displayItems.map(({ recipe, match }) => {
            const onPlan = isOnMealPlan(recipe.id);
            const missingCount = match.missingCount;
            return (
              <Card key={recipe.id} className="mt-3">
                {recipe.isDemoSample ? (
                  <Text className="mb-1 text-[10px] font-bold uppercase text-amber-700">Demo sample</Text>
                ) : null}
                <Pressable onPress={() => router.push(`/discover-recipes/${recipe.id}`)}>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-semibold uppercase text-primary">{recipe.cuisine}</Text>
                      <Text className="text-base font-bold text-ink">{recipe.name}</Text>
                      <Text className="mt-1 text-sm text-muted" numberOfLines={2}>{recipe.description}</Text>
                      <RecipePantryMatchBadge match={match} />
                      <Text className="mt-2 text-xs text-muted">
                        {recipe.servings} servings · {recipe.prep_time + recipe.cook_time} min · {recipe.calories_per_serving} cal
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onToggleMealPlan(recipe)}
                      className={`rounded-full px-3 py-2 ${onPlan ? 'bg-primary' : 'border border-border bg-paper'}`}
                    >
                      <Text className={`text-xs font-bold ${onPlan ? 'text-on-primary' : 'text-muted'}`}>
                        {onPlan ? RECIPES_COPY.mealPlanChip.onPlan : RECIPES_COPY.mealPlanChip.add}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
                {missingCount > 0 && onAddMissing ? (
                  <Pressable
                    onPress={() => onAddMissing(recipe)}
                    className="mt-3 items-center rounded-xl bg-primary py-3"
                  >
                    <Text className="text-sm font-bold text-on-primary">{RECIPES_COPY.recipeCard.addMissingCta}</Text>
                  </Pressable>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </View>
  );
}
