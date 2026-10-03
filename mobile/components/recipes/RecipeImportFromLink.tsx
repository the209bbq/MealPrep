import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
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
import type { RecipeImportExtractedDto } from '../../lib/recipeImport/types';
import { RecipeImportReviewSheet } from './RecipeImportReviewSheet';

function extractUrlFromClipboardText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[)\]"']+$/, '') : null;
}

export function RecipeImportFromLink({ initialUrl = '' }: { initialUrl?: string }) {
  const { session, openAuthSheet, saveLinkImportedRecipe, demoMode } = useApp();
  const [url, setUrl] = useState(() => initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<RecipeImportExtractedDto | null>(null);
  const [clipboardHint, setClipboardHint] = useState(false);

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
    if (!session && !demoMode) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    try {
      const token = session?.access_token ?? null;
      const extracted = await importRecipeFromLink(trimmed, token);
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
  }, [demoMode, session, url]);

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
            <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.importCta}</Text>
          )}
        </Pressable>
      </View>
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
        }}
      />
    </View>
  );
}
