import { Ionicons } from '../../lib/icons/Ionicons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../config/appConfig';
import { RECIPES_COPY } from '../../config/recipesCopy';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { VIRAL_RECIPES_COPY } from '../../config/viralRecipes';
import { formatIngredientText, formatQuantityWithUnit } from '../../lib/formatQuantity';
import { sanitizeHttpUrl } from '../../lib/recipeImport/safeHttpUrl';
import type { RecipePantryMatch } from '../../lib/recipeMatch';
import type { Recipe } from '../../types/mealprep';
import type { ViralRecipeLinkItem } from '../../lib/viralRecipes/types';
import { RecipeDietNotice } from '../diet/RecipeDietNotice';
import { ingredientLinesForKitchenRecipe } from '../../lib/diet/ingredientLines';
import { RecipeSaveButton } from './RecipeSaveButton';
import { RecipeSaveCta } from './RecipeSaveCta';
import { RecipeCostPerServingForRecipe } from './RecipeCostPerServingForRecipe';

type DetailSection = 'ingredients' | 'steps';

export interface VideoRecipeDetailViewProps {
  recipe: Recipe;
  match: RecipePantryMatch | null | undefined;
  viralItem?: ViralRecipeLinkItem | null;
  creatorAvatarUrl?: string | null;
  importing?: boolean;
  importError?: string | null;
  onClose: () => void;
  onRetryImport?: () => void;
  onStartImport?: () => void;
  onSignInForImport?: () => void;
  onAddMissing: () => void;
  recipeSaved?: boolean;
  onToggleSaveRecipe?: () => void;
  saveDisabled?: boolean;
  /** Preview / screenshot mode: force loading UI without network. */
  previewLoading?: boolean;
  /** Controlled tab for screenshots. */
  initialSection?: DetailSection;
  wontCookAgain?: boolean;
  onToggleWontCook?: () => void;
}

function SectionToggle({
  section,
  onSection,
}: {
  section: DetailSection;
  onSection: (next: DetailSection) => void;
}) {
  const tabs: { id: DetailSection; label: string }[] = [
    { id: 'ingredients', label: RECIPES_COPY.recipeDetail.ingredientsTab },
    { id: 'steps', label: RECIPES_COPY.recipeDetail.stepsTab },
  ];
  return (
    <View className="mt-4 flex-row rounded-xl border border-border bg-paper p-0.5">
      {tabs.map((tab) => {
        const selected = section === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSection(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-lg py-2.5 ${selected ? 'bg-card shadow-sm' : ''}`}
          >
            <Text className={`text-sm font-bold ${selected ? 'text-ink' : 'text-muted'}`}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <View className={`rounded-lg bg-border/60 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <View className="mt-4 gap-3" accessibilityLabel={VIRAL_RECIPES_COPY.detailImporting}>
      <View className="flex-row items-center gap-2">
        <ActivityIndicator color={THEME.primary} size="small" />
        <Text className="flex-1 text-sm font-medium text-muted">{VIRAL_RECIPES_COPY.detailImporting}</Text>
      </View>
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-[92%]" />
      <SkeletonBlock className="h-4 w-[78%]" />
      <SkeletonBlock className="mt-2 h-4 w-full" />
      <SkeletonBlock className="h-4 w-[85%]" />
    </View>
  );
}

function CreatorCreditRow({
  channelTitle,
  channelUrl,
  avatarUrl,
}: {
  channelTitle: string;
  channelUrl: string | null;
  avatarUrl: string | null;
}) {
  const safeUrl = sanitizeHttpUrl(channelUrl);
  const openChannel = () => {
    if (safeUrl) void Linking.openURL(safeUrl);
  };
  const initial = channelTitle.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <Pressable
      onPress={safeUrl ? openChannel : undefined}
      disabled={!safeUrl}
      accessibilityRole={safeUrl ? 'link' : 'text'}
      accessibilityLabel={RECIPE_IMPORT_COPY.creatorLinkAccessibility(channelTitle)}
      className="mt-3 flex-row items-center gap-3"
    >
      {avatarUrl?.trim() ? (
        <Image
          source={{ uri: avatarUrl.trim() }}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
          <Text className="text-base font-bold text-primary">{initial}</Text>
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Creator</Text>
        <Text className="text-base font-bold text-ink" numberOfLines={1}>{channelTitle}</Text>
      </View>
      {safeUrl ? <Ionicons name="chevron-forward" size={18} color={THEME.muted} /> : null}
    </Pressable>
  );
}

function PantryStatusLine({
  missingCount,
  minutes,
  servings,
  ingredientCount,
  previewWithoutIngredients,
}: {
  missingCount: number;
  minutes: number;
  servings: number;
  ingredientCount: number;
  previewWithoutIngredients: boolean;
}) {
  const timePart = RECIPES_COPY.recipeDetail.servingsAndTime(servings, minutes);
  const ready = missingCount === 0 && ingredientCount > 0;
  return (
    <View className="mt-2 flex-row flex-wrap items-center gap-x-2 gap-y-1">
      <Text className="text-sm text-muted">{timePart}</Text>
      <Text className="text-sm text-muted">·</Text>
      {previewWithoutIngredients ? (
        <Text className="text-sm text-muted">{RECIPES_COPY.recipeCard.previewNoIngredients}</Text>
      ) : ready ? (
        <Text className="text-sm font-bold text-success-accent">{RECIPES_COPY.recipeCard.haveEverything}</Text>
      ) : (
        <Text className="text-sm font-bold text-danger">{RECIPES_COPY.recipeCard.needItems(missingCount)}</Text>
      )}
    </View>
  );
}

export function VideoRecipeDetailView({
  recipe,
  match,
  viralItem,
  creatorAvatarUrl,
  importing = false,
  importError = null,
  onClose,
  onRetryImport,
  onStartImport,
  onSignInForImport,
  onAddMissing,
  recipeSaved,
  onToggleSaveRecipe,
  saveDisabled = false,
  previewLoading = false,
  initialSection = 'ingredients',
  wontCookAgain = false,
  onToggleWontCook,
}: VideoRecipeDetailViewProps) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<DetailSection>(initialSection);
  const isImportPreview =
    Boolean(viralItem) && recipe.id.startsWith('viral-preview-') && recipe.ingredients.length === 0;
  const showLoading = previewLoading || importing;
  const missingCount = match?.missingCount ?? 0;

  const watchUrl = useMemo(() => {
    const fromItem = viralItem?.watchUrl;
    const fromRecipe = recipe.sourceUrl;
    return sanitizeHttpUrl(fromItem ?? fromRecipe ?? null);
  }, [recipe.sourceUrl, viralItem?.watchUrl]);

  const heroUri = viralItem?.thumbnailUrl?.trim() || recipe.imageUrl?.trim() || null;
  const channelTitle = viralItem?.channelTitle ?? recipe.sourceChannelName ?? 'Creator';
  const channelUrl = viralItem?.channelUrl ?? recipe.sourceChannelUrl ?? null;
  const avatar = creatorAvatarUrl ?? null;

  const openWatch = () => {
    if (watchUrl) void Linking.openURL(watchUrl);
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-border bg-card px-3 py-2">
        <Pressable onPress={onClose} accessibilityLabel="Close recipe details" className="p-2">
          <Ionicons name="close" size={24} color={THEME.ink} />
        </Pressable>
        <Text className="flex-1 text-center text-sm font-semibold text-muted" numberOfLines={1}>
          Video recipe
        </Text>
        {onToggleSaveRecipe ? (
          <RecipeSaveButton
            saved={Boolean(recipeSaved)}
            onToggle={onToggleSaveRecipe}
            size={20}
            disabled={saveDisabled}
          />
        ) : (
          <View className="w-10" />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={openWatch}
          disabled={!watchUrl}
          accessibilityRole="button"
          accessibilityLabel={watchUrl ? VIRAL_RECIPES_COPY.watchOriginalVideo : undefined}
          className="relative w-full overflow-hidden bg-ink"
          style={{ aspectRatio: 16 / 9 }}
        >
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-primary-light">
              <Ionicons name="play-circle-outline" size={48} color={THEME.primary} />
            </View>
          )}
          <View className="absolute inset-0 items-center justify-center bg-ink/25">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-ink/55">
              <Ionicons name="play" size={32} color={THEME.onPrimary} />
            </View>
          </View>
        </Pressable>

        <View className="px-4 pt-4">
          <Text className="text-2xl font-bold leading-tight text-ink">{recipe.name}</Text>

          <CreatorCreditRow channelTitle={channelTitle} channelUrl={channelUrl} avatarUrl={avatar} />

          {!showLoading && !importError ? (
            <PantryStatusLine
              missingCount={missingCount}
              minutes={recipe.minutes}
              servings={recipe.servings}
              ingredientCount={recipe.ingredients.length}
              previewWithoutIngredients={isImportPreview}
            />
          ) : null}

          {!showLoading && !importError ? <RecipeCostPerServingForRecipe recipe={recipe} /> : null}

          {!showLoading && !importError ? (
            <RecipeDietNotice
              ingredientLines={ingredientLinesForKitchenRecipe(recipe, viralItem?.title ?? recipe.name)}
            />
          ) : null}

          {!showLoading && !importError && onToggleWontCook ? (
            <Pressable
              onPress={onToggleWontCook}
              className="mt-3 self-start"
              accessibilityRole="button"
              accessibilityLabel={
                wontCookAgain
                  ? RECIPES_COPY.recipeDetail.wontCookAgainUndo
                  : RECIPES_COPY.recipeDetail.wontCookAgain
              }
            >
              <Text className="text-xs font-semibold text-muted">
                {wontCookAgain
                  ? RECIPES_COPY.recipeDetail.wontCookAgainUndo
                  : RECIPES_COPY.recipeDetail.wontCookAgain}
              </Text>
            </Pressable>
          ) : null}

          {isImportPreview && !showLoading && !importError ? (
            <View className="mt-4 rounded-2xl border border-border bg-card px-4 py-4">
              <Text className="text-base font-bold text-ink">{VIRAL_RECIPES_COPY.getRecipeCta}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{VIRAL_RECIPES_COPY.getRecipeHint}</Text>
              {onStartImport ? (
                <Pressable
                  onPress={onStartImport}
                  className="mt-3 min-h-[48px] items-center justify-center rounded-xl bg-primary px-4"
                  accessibilityRole="button"
                >
                  <Text className="text-base font-bold text-on-primary">{VIRAL_RECIPES_COPY.getRecipeCta}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {showLoading ? <LoadingSkeleton /> : null}

          {importError && !showLoading ? (
            <View className="mt-4 rounded-2xl border border-border bg-card px-4 py-4">
              <Text className="text-base font-bold text-ink">{VIRAL_RECIPES_COPY.detailImportErrorTitle}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                {importError === RECIPE_IMPORT_COPY.guestSignInMessage
                  ? importError
                  : VIRAL_RECIPES_COPY.detailImportErrorBody}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {onRetryImport ? (
                  <Pressable
                    onPress={onRetryImport}
                    className="min-h-[44px] justify-center rounded-xl border border-border bg-paper px-4 py-2"
                  >
                    <Text className="text-sm font-bold text-primary">Try again</Text>
                  </Pressable>
                ) : null}
                {onSignInForImport ? (
                  <Pressable onPress={onSignInForImport} className="min-h-[44px] justify-center rounded-xl bg-primary px-4 py-2">
                    <Text className="text-sm font-bold text-on-primary">{RECIPE_IMPORT_COPY.guestSignInCta}</Text>
                  </Pressable>
                ) : null}
                {watchUrl ? (
                  <Pressable
                    onPress={openWatch}
                    className="min-h-[44px] justify-center rounded-xl border border-primary bg-primary-light px-4 py-2"
                  >
                    <Text className="text-sm font-bold text-primary-dark">{VIRAL_RECIPES_COPY.watchOriginalVideo}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {!showLoading && !importError ? (
            <>
              <SectionToggle section={section} onSection={setSection} />
              {section === 'ingredients' ? (
                <View className="mt-3 pb-2">
                  {recipe.ingredients.length === 0 ? (
                    <Text className="text-sm text-muted">No ingredients listed.</Text>
                  ) : (
                    recipe.ingredients.map((ing) => {
                      const name = formatIngredientText(ing.name);
                      const line =
                        ing.quantity > 0
                          ? `${name} — ${formatQuantityWithUnit(ing.quantity, ing.unit)}`
                          : name;
                      return (
                        <Text key={ing.ingredientId} className="mt-2.5 text-sm leading-6 text-ink">
                          {line}
                        </Text>
                      );
                    })
                  )}
                </View>
              ) : (
                <View className="mt-3 pb-2">
                  {recipe.steps.length === 0 ? (
                    <Text className="text-sm text-muted">
                      {recipe.sourceUrl ? RECIPE_IMPORT_COPY.noSteps : 'No steps listed.'}
                    </Text>
                  ) : (
                    recipe.steps.map((step, index) => (
                      <View key={`${index}-${step.slice(0, 24)}`} className="mt-3 flex-row gap-2">
                        <View className="h-7 w-7 items-center justify-center rounded-full bg-primary-light">
                          <Text className="text-xs font-bold text-primary-dark">{index + 1}</Text>
                        </View>
                        <Text className="flex-1 text-sm leading-6 text-ink">{step}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      {!showLoading && !importError ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="gap-2">
            {onToggleSaveRecipe ? (
              <RecipeSaveCta
                saved={Boolean(recipeSaved)}
                onToggle={onToggleSaveRecipe}
                disabled={saveDisabled}
              />
            ) : null}
            {missingCount > 0 ? (
              <Pressable
                onPress={onAddMissing}
                className="min-h-[48px] items-center justify-center rounded-2xl border border-primary bg-primary-light px-4"
              >
                <Text className="text-base font-bold text-primary-dark">{RECIPES_COPY.recipeCard.addMissingCta}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function isVideoRecipeDetailContext(
  recipe: Recipe,
  viralItem?: ViralRecipeLinkItem | null,
): boolean {
  if (viralItem) return true;
  if (recipe.sourceType === 'youtube' && recipe.sourceUrl?.trim()) return true;
  return recipe.id.startsWith('viral-preview-');
}
