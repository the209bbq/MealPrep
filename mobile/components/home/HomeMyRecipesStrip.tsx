import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { SAVED_RECIPES_COPY } from '../../config/savedRecipes';
import type { RecipesTabRow } from '../../config/recipesTabFilters';
import { useApp } from '../../context/AppContext';
import { MyRecipesSheet } from '../recipes/MyRecipesSheet';
import { savedCreatorItemFromRecord } from '../../lib/savedRecipes/resolveRows';

const PREVIEW_LIMIT = 8;

function recipeTitle(row: RecipesTabRow): string {
  return row.kind === 'kitchen' ? row.recipe.name : row.recipe.name;
}

function recipeImageUrl(row: RecipesTabRow): string | null {
  if (row.kind !== 'kitchen') return null;
  return row.recipe.imageUrl ?? null;
}

export function HomeMyRecipesStrip() {
  const { demoMode, isGuest, savedRecipes } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);

  const previewRows = savedRecipes.feedRows.slice(0, PREVIEW_LIMIT);

  const openRow = useCallback(
    (row: RecipesTabRow) => {
      setSheetOpen(false);
      if (row.kind === 'kitchen' && row.recipe.id.startsWith('viral-preview-')) {
        const record = savedRecipes.records.find((entry) => {
          const item = savedCreatorItemFromRecord(entry);
          return item?.videoId && row.recipe.id === `viral-preview-${item.videoId}`;
        });
        const item = record ? savedCreatorItemFromRecord(record) : null;
        if (item?.watchUrl) {
          router.push({ pathname: '/recipes', params: { url: item.watchUrl } });
          return;
        }
      }
      if (row.kind === 'kitchen') {
        router.push({ pathname: '/recipes', params: { recipeId: row.recipe.id } });
      }
    },
    [savedRecipes.records],
  );

  return (
    <>
      <View className="mt-4 rounded-2xl border border-border bg-card px-3 py-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-bold text-ink">{SAVED_RECIPES_COPY.myRecipesTitle}</Text>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="See all My Recipes"
            className="flex-row items-center gap-0.5 rounded-full px-2 py-1 active:opacity-80"
          >
            <Text className="text-xs font-bold text-primary-dark">See all</Text>
            <Ionicons name="chevron-forward" size={14} color={THEME.primaryDark} />
          </Pressable>
        </View>

        {previewRows.length === 0 ? (
          <Text className="text-xs text-muted">{SAVED_RECIPES_COPY.empty}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
            {previewRows.map((row) => {
              const title = recipeTitle(row);
              const imageUrl = recipeImageUrl(row);
              const key = row.kind === 'kitchen' ? row.recipe.id : `row-${title}`;
              return (
                <Pressable
                  key={key}
                  onPress={() => openRow(row)}
                  className="mx-1 w-24 active:opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel={title}
                >
                  <View className="h-16 w-24 overflow-hidden rounded-xl border border-border bg-paper">
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} className="h-full w-full" contentFit="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center bg-primary-light">
                        <Ionicons name="restaurant-outline" size={22} color={THEME.primaryDark} />
                      </View>
                    )}
                  </View>
                  <Text className="mt-1 text-xs font-semibold text-ink" numberOfLines={2}>
                    {title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <MyRecipesSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        rows={savedRecipes.feedRows}
        guestHint={isGuest && !demoMode}
        onOpenRow={openRow}
      />
    </>
  );
}
