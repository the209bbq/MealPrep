import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME, isViralRecipesConfigured } from '../../config/appConfig';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import {
  VIRAL_RECIPES_CATEGORIES,
  VIRAL_RECIPES_CATEGORY_LABELS,
  VIRAL_RECIPES_COPY,
  type ViralRecipesCategory,
} from '../../config/viralRecipes';
import { useApp } from '../../context/AppContext';
import { useViralRecipes } from '../../hooks/useViralRecipes';
import {
  importRecipeFromLink,
  RecipeImportAuthError,
  RecipeImportUpstreamError,
} from '../../lib/recipeImport/client';
import type { ViralRecipeLinkItem } from '../../lib/viralRecipes/types';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import { RecipeImportReviewSheet } from './RecipeImportReviewSheet';
import type { RecipeImportExtractedDto } from '../../lib/recipeImport/types';

const CARD_WIDTH = 148;

function CategoryDropdown({
  value,
  onChange,
}: {
  value: ViralRecipesCategory;
  onChange: (next: ViralRecipesCategory) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="relative" style={{ zIndex: open ? 10 : 1 }}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={VIRAL_RECIPES_COPY.categoryAccessibility}
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5"
      >
        <Text className="text-xs font-semibold text-ink">{VIRAL_RECIPES_CATEGORY_LABELS[value]}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={THEME.muted} />
      </Pressable>
      {open ? (
        <View className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-border bg-paper shadow-sm">
          {VIRAL_RECIPES_CATEGORIES.map((choice) => {
            const selected = choice === value;
            return (
              <Pressable
                key={choice}
                onPress={() => {
                  onChange(choice);
                  setOpen(false);
                }}
                className={`px-3 py-2 ${selected ? 'bg-primary-light' : 'bg-paper'}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text className={`text-xs font-semibold ${selected ? 'text-primary-dark' : 'text-ink'}`}>
                  {VIRAL_RECIPES_CATEGORY_LABELS[choice]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function ViralRecipeCard({
  item,
  saving,
  onWatch,
  onSave,
}: {
  item: ViralRecipeLinkItem;
  saving: boolean;
  onWatch: () => void;
  onSave: () => void;
}) {
  return (
    <View
      className="mr-3 overflow-hidden rounded-xl border border-border bg-card"
      style={{ width: CARD_WIDTH }}
    >
      <Pressable
        onPress={onWatch}
        accessibilityRole="link"
        accessibilityLabel={VIRAL_RECIPES_COPY.watchAccessibility(item.title)}
      >
        <Image
          source={{ uri: item.thumbnailUrl }}
          className="h-[84px] w-full bg-border"
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <Text className="px-2 pt-2 text-xs font-bold text-ink" numberOfLines={2}>
          {item.title}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void openExternalUrl(item.channelUrl).catch(() => undefined)}
        className="px-2 pt-1"
        accessibilityRole="link"
        accessibilityLabel={`Channel ${item.channelTitle}`}
      >
        <Text className="text-[11px] text-muted" numberOfLines={1}>
          {VIRAL_RECIPES_COPY.byChannel(item.channelTitle)}
        </Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={saving}
        className="mx-2 mb-2 mt-2 min-h-[32px] items-center justify-center rounded-lg border border-primary bg-primary-light px-2 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={VIRAL_RECIPES_COPY.saveAccessibility(item.title)}
      >
        {saving ? (
          <ActivityIndicator color={THEME.primary} size="small" />
        ) : (
          <Text className="text-xs font-bold text-primary-dark">{VIRAL_RECIPES_COPY.saveCta}</Text>
        )}
      </Pressable>
    </View>
  );
}

export function ViralRecipesShelf() {
  const { session, openAuthSheet, saveLinkImportedRecipe, demoMode } = useApp();
  const [category, setCategory] = useState<ViralRecipesCategory>('viral');
  const { items, loading, error, enabled } = useViralRecipes(session, category);
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [review, setReview] = useState<RecipeImportExtractedDto | null>(null);

  const runSave = useCallback(
    async (item: ViralRecipeLinkItem) => {
      setSaveError(null);
      if (!session && !demoMode) {
        setSaveError(RECIPE_IMPORT_COPY.guestSignInMessage);
        return;
      }
      setSavingVideoId(item.videoId);
      try {
        const token = session?.access_token ?? null;
        const extracted = await importRecipeFromLink(item.watchUrl, token);
        setReview(extracted);
      } catch (err) {
        if (err instanceof RecipeImportAuthError) {
          setSaveError(RECIPE_IMPORT_COPY.guestSignInMessage);
        } else if (err instanceof RecipeImportUpstreamError) {
          setSaveError(err.message);
        } else if (err instanceof Error) {
          setSaveError(err.message);
        } else {
          setSaveError(RECIPE_IMPORT_COPY.guestSignInMessage);
        }
      } finally {
        setSavingVideoId(null);
      }
    },
    [demoMode, session],
  );

  const configured = isViralRecipesConfigured();
  if (!configured || !enabled) return null;

  return (
    <>
      <View className="mt-4 border-t border-border pt-3">
        <View className="mb-2 flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink">{VIRAL_RECIPES_COPY.shelfTitle}</Text>
            <Text className="mt-0.5 text-[11px] text-muted">{VIRAL_RECIPES_COPY.shelfSubtitle}</Text>
          </View>
          <CategoryDropdown value={category} onChange={setCategory} />
        </View>

        {loading ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator color={THEME.primary} size="small" />
            <Text className="text-xs text-muted">{VIRAL_RECIPES_COPY.loading}</Text>
          </View>
        ) : null}

        {!loading && error ? <Text className="py-1 text-xs text-muted">{error}</Text> : null}

        {!loading && !error && items.length === 0 ? (
          <Text className="py-1 text-xs text-muted">{VIRAL_RECIPES_COPY.empty}</Text>
        ) : null}

        {!loading && items.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1 mt-1"
            contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 4 }}
          >
            {items.map((item) => (
              <ViralRecipeCard
                key={item.videoId}
                item={item}
                saving={savingVideoId === item.videoId}
                onWatch={() => void openExternalUrl(item.watchUrl).catch(() => undefined)}
                onSave={() => void runSave(item)}
              />
            ))}
          </ScrollView>
        ) : null}

        {saveError ? (
          <View className="mt-1">
            <Text className="text-xs text-muted">{saveError}</Text>
            {!session && !demoMode ? (
              <Pressable onPress={openAuthSheet} className="mt-2 self-start rounded-lg bg-primary px-3 py-2">
                <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.guestSignInCta}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <RecipeImportReviewSheet
        visible={review != null}
        draft={review}
        onClose={() => setReview(null)}
        onSave={async (next) => {
          const saved = await saveLinkImportedRecipe(next);
          setReview(null);
          return saved;
        }}
        onAddMissingToGrocery={() => setReview(null)}
      />
    </>
  );
}
