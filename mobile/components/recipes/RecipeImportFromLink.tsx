import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { RECIPE_IMPORT, RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import {
  RecipeImportAuthError,
  RecipeImportNotConfiguredError,
  RecipeImportNotRecipeError,
  RecipeImportRateLimitError,
  RecipeImportUpstreamError,
  importRecipeFromLink,
} from '../../lib/recipeImport/client';
import {
  classifyImportUrlForClient,
  isManualCaptionImportKind,
  normalizeImportUrl,
} from '../../lib/recipeImport/urlClassificationClient';
import type { RecipeImportExtractedDto } from '../../lib/recipeImport/types';
import { RecipeImportReviewSheet } from './RecipeImportReviewSheet';

function extractUrlFromClipboardText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\]"']+$/, '') : null;
}

export function RecipeImportFromLink({ initialUrl = '' }: { initialUrl?: string }) {
  const { session, openAuthSheet, saveLinkImportedRecipe, demoMode } = useApp();
  const [url, setUrl] = useState(() => initialUrl);
  const [captionText, setCaptionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<RecipeImportExtractedDto | null>(null);
  const [clipboardHint, setClipboardHint] = useState(false);

  const normalizedUrl = useMemo(() => normalizeImportUrl(url.trim()) ?? '', [url]);
  const urlKind = useMemo(
    () => (normalizedUrl ? classifyImportUrlForClient(normalizedUrl) : null),
    [normalizedUrl],
  );
  const manualCaptionMode = isManualCaptionImportKind(urlKind);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const clip = await Clipboard.getStringAsync();
        if (cancelled || !clip?.trim() || url.trim()) return;
        const detected = extractUrlFromClipboardText(clip);
        if (detected) {
          setUrl(detected);
          setClipboardHint(true);
        }
      } catch {
        /* clipboard may be denied */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const runImport = useCallback(async () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError(RECIPE_IMPORT.invalidUrlMessage);
      return;
    }
    if (manualCaptionMode && !captionText.trim()) {
      setError(RECIPE_IMPORT_COPY.manualCaptionHint);
      return;
    }
    if (!session && !demoMode) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    try {
      const token = session?.access_token ?? null;
      const extracted = await importRecipeFromLink(trimmed, token, {
        captionText: manualCaptionMode ? captionText : undefined,
      });
      setReview(extracted);
    } catch (err) {
      if (err instanceof RecipeImportAuthError) {
        setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      } else if (err instanceof RecipeImportNotRecipeError) {
        setError(err.message);
      } else if (err instanceof RecipeImportRateLimitError) {
        setError(err.message);
      } else if (err instanceof RecipeImportNotConfiguredError) {
        setError(err.message);
      } else if (err instanceof RecipeImportUpstreamError) {
        setError(RECIPE_IMPORT.importBusyMessage);
      } else {
        setError(RECIPE_IMPORT.importFailedMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [captionText, demoMode, manualCaptionMode, session, url]);

  return (
    <View className="mt-2">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={url}
          onChangeText={(text) => {
            setUrl(text);
            setClipboardHint(false);
            setError(null);
          }}
          placeholder={RECIPE_IMPORT_COPY.pastePlaceholder}
          placeholderTextColor={THEME.muted}
          className="min-h-[44px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={RECIPE_IMPORT_COPY.pasteLabel}
        />
        <Pressable
          onPress={() => void runImport()}
          disabled={loading}
          className="min-h-[44px] items-center justify-center rounded-xl bg-primary px-3 py-2"
          accessibilityRole="button"
          accessibilityLabel={RECIPE_IMPORT_COPY.importButtonAccessibility}
        >
          {loading ? (
            <ActivityIndicator color={THEME.onPrimary} />
          ) : (
            <Text className="text-xs font-bold text-on-primary">
              {manualCaptionMode ? RECIPE_IMPORT_COPY.importFromCaptionCta : RECIPE_IMPORT_COPY.importCta}
            </Text>
          )}
        </Pressable>
      </View>
      {manualCaptionMode ? (
        <View className="mt-2 rounded-xl border border-border bg-card p-3">
          <Text className="text-xs text-muted">{RECIPE_IMPORT_COPY.manualCaptionHint}</Text>
          <Text className="mt-2 text-xs font-semibold text-ink">{RECIPE_IMPORT_COPY.sourceLinkLabel}</Text>
          <Text className="mt-1 text-xs text-muted" numberOfLines={2}>{normalizedUrl}</Text>
          <Text className="mt-3 text-xs font-semibold text-ink">{RECIPE_IMPORT_COPY.socialCaptionLabel}</Text>
          <TextInput
            value={captionText}
            onChangeText={setCaptionText}
            placeholder={RECIPE_IMPORT_COPY.socialCaptionPlaceholder}
            placeholderTextColor={THEME.muted}
            multiline
            className="mt-1 min-h-[88px] rounded-xl border border-border bg-paper px-3 py-2 text-sm text-ink"
          />
        </View>
      ) : null}
      {clipboardHint ? (
        <Text className="mt-1 text-xs text-muted">{RECIPE_IMPORT_COPY.clipboardDetected}</Text>
      ) : null}
      {error ? (
        <View className="mt-2">
          <Text className="text-xs text-danger">{error}</Text>
          {!session && !demoMode ? (
            <Pressable onPress={openAuthSheet} className="mt-2 self-start rounded-lg bg-primary px-3 py-2">
              <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.guestSignInCta}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {loading ? (
        <Text className="mt-1 text-xs text-muted">{RECIPE_IMPORT_COPY.importing}</Text>
      ) : null}

      <RecipeImportReviewSheet
        visible={review != null}
        draft={review}
        onClose={() => setReview(null)}
        onSave={async (next) => {
          await saveLinkImportedRecipe(next);
          setReview(null);
          setUrl('');
          setCaptionText('');
        }}
      />
    </View>
  );
}
