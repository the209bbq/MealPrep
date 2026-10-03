import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECIPE_IMPORT, RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import {
  RecipeImportAuthError,
  RecipeImportFallbackRequiredError,
  RecipeImportNotConfiguredError,
  RecipeImportNotRecipeError,
  RecipeImportRateLimitError,
  RecipeImportUpstreamError,
  confirmYoutubeRecipeImport,
  importRecipeFromLink,
  importRecipeFromPhotos,
  importRecipeFromScreenshots,
  importRecipeFromUploadedVideoPath,
} from '../../lib/recipeImport/client';
import type { RecipeImportExtractedDto, RecipeImportFallbacksDto } from '../../lib/recipeImport/types';
import {
  classifyImportUrlForClient,
  isManualCaptionImportKind,
  normalizeImportUrl,
} from '../../lib/recipeImport/urlClassificationClient';
import { uploadRecipeImportVideo } from '../../lib/recipeImport/uploadImportVideo';
import { readImportLinkFromClipboard } from '../../lib/recipeImport/pasteImportLink';
import { RecipeImportReviewSheet } from './RecipeImportReviewSheet';

type ImportMode = 'link' | 'photo' | 'video';

async function pickRecipeImages(max: number): Promise<{ mimeType: string; data: string }[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is needed to scan a recipe.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets
    .filter((asset) => asset.base64)
    .map((asset) => ({
      mimeType: asset.mimeType ?? 'image/jpeg',
      data: asset.base64!,
    }));
}

async function pickImportVideo(): Promise<{
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
} | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is needed to upload a video.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'video/mp4',
    name: asset.fileName ?? `import-${Date.now()}.mp4`,
    size: asset.fileSize ?? undefined,
  };
}

export function RecipeImportSheet({
  visible,
  onClose,
  initialUrl = '',
  autoStart = false,
}: {
  visible: boolean;
  onClose: () => void;
  initialUrl?: string;
  autoStart?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const {
    session,
    openAuthSheet,
    saveLinkImportedRecipe,
    addMissingRecipeIngredientsToGrocery,
    demoMode,
  } = useApp();
  const authUserId = session?.user.id ?? null;

  const [mode, setMode] = useState<ImportMode>(() => (initialUrl.trim() ? 'link' : 'link'));
  const [url, setUrl] = useState(initialUrl);
  const [captionText, setCaptionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbacks, setFallbacks] = useState<RecipeImportFallbacksDto | null>(null);
  const [review, setReview] = useState<RecipeImportExtractedDto | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const autoStartRef = useRef(false);

  const normalizedUrl = useMemo(() => normalizeImportUrl(url.trim()) ?? '', [url]);
  const urlKind = useMemo(
    () => (normalizedUrl ? classifyImportUrlForClient(normalizedUrl) : null),
    [normalizedUrl],
  );
  const manualCaptionMode = isManualCaptionImportKind(urlKind);

  useEffect(() => {
    if (!visible) {
      autoStartRef.current = false;
    }
  }, [visible]);

  const pasteLinkFromClipboard = useCallback(async () => {
    setPasteHint(false);
    setError(null);
    const pasted = await readImportLinkFromClipboard();
    if (!pasted) return;
    setUrl(pasted);
    setPasteHint(true);
  }, []);

  const runLinkImport = useCallback(async (urlOverride?: string) => {
    setError(null);
    setFallbacks(null);
    const trimmed = (urlOverride ?? url).trim();
    if (!trimmed) {
      setError(RECIPE_IMPORT.invalidUrlMessage);
      return;
    }
    if (manualCaptionMode && !captionText.trim()) {
      /* server returns FALLBACK_REQUIRED with steps */
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
      } else if (err instanceof RecipeImportFallbackRequiredError || err instanceof RecipeImportNotRecipeError) {
        setError(err.message);
        setFallbacks(err.fallbacks ?? null);
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

  useEffect(() => {
    if (!visible || !autoStart || autoStartRef.current || !initialUrl.trim()) return;
    autoStartRef.current = true;
    setUrl(initialUrl);
    void runLinkImport(initialUrl);
  }, [autoStart, initialUrl, runLinkImport, visible]);

  async function runPhotoImport() {
    setError(null);
    setFallbacks(null);
    if (!session && !demoMode) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    try {
      const images = await pickRecipeImages(RECIPE_IMPORT.maxPhotos);
      if (images.length === 0) {
        setLoading(false);
        return;
      }
      const token = session?.access_token ?? null;
      const extracted = await importRecipeFromPhotos(images, token);
      setReview(extracted);
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function runVideoImport() {
    setError(null);
    setFallbacks(null);
    if (!session || !authUserId) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    try {
      const picked = await pickImportVideo();
      if (!picked) {
        setLoading(false);
        return;
      }
      const path = await uploadRecipeImportVideo(authUserId, picked);
      const extracted = await importRecipeFromUploadedVideoPath(path, session.access_token);
      setReview(extracted);
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function runScreenshotFallback() {
    setError(null);
    if (!session && !demoMode) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    try {
      const images = await pickRecipeImages(RECIPE_IMPORT.maxPhotos);
      if (images.length === 0) {
        setLoading(false);
        return;
      }
      const token = session?.access_token ?? null;
      const extracted = await importRecipeFromScreenshots(images, token, {
        url: normalizedUrl || undefined,
        captionText: captionText || undefined,
      });
      setReview(extracted);
      setFallbacks(null);
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmYoutubeFallback() {
    const suggestion = fallbacks?.youtubeSuggestion;
    if (!suggestion || (!session && !demoMode)) return;
    setLoading(true);
    setError(null);
    try {
      const token = session?.access_token ?? null;
      const extracted = await confirmYoutubeRecipeImport(suggestion.watchUrl, token);
      setReview(extracted);
      setFallbacks(null);
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleImportError(err: unknown) {
    if (err instanceof RecipeImportAuthError) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
    } else if (err instanceof RecipeImportFallbackRequiredError || err instanceof RecipeImportNotRecipeError) {
      setError(err.message);
      setFallbacks(err.fallbacks ?? null);
    } else if (err instanceof RecipeImportRateLimitError) {
      setError(err.message);
    } else if (err instanceof RecipeImportNotConfiguredError) {
      setError(err.message);
    } else if (err instanceof RecipeImportUpstreamError) {
      setError(RECIPE_IMPORT.importBusyMessage);
    } else if (err instanceof Error) {
      setError(err.message);
    } else {
      setError(RECIPE_IMPORT.importFailedMessage);
    }
  }

  function resetAndClose() {
    setUrl('');
    setCaptionText('');
    setError(null);
    setFallbacks(null);
    setReview(null);
    onClose();
  }

  return (
    <>
      <Modal
        visible={visible && review == null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
        onShow={() => {
          if (initialUrl.trim()) {
            setUrl(initialUrl);
            setMode('link');
          }
        }}
      >
        <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
            <Pressable onPress={resetAndClose} accessibilityLabel="Close import" className="mr-3 p-1">
              <Text className="text-base font-bold text-primary">{RECIPE_IMPORT_COPY.cancel}</Text>
            </Pressable>
            <Text className="flex-1 text-lg font-bold text-ink">{RECIPE_IMPORT_COPY.sheetTitle}</Text>
          </View>

          <ScrollView className="flex-1 px-4 pb-8" keyboardShouldPersistTaps="handled">
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(['link', 'photo', 'video'] as ImportMode[]).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setMode(tab)}
                  className={`rounded-full px-3 py-2 ${mode === tab ? 'bg-primary' : 'border border-border bg-card'}`}
                >
                  <Text className={`text-xs font-bold ${mode === tab ? 'text-on-primary' : 'text-ink'}`}>
                    {tab === 'link'
                      ? RECIPE_IMPORT_COPY.modeLink
                      : tab === 'photo'
                        ? RECIPE_IMPORT_COPY.modePhoto
                        : RECIPE_IMPORT_COPY.modeVideo}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === 'link' ? (
              <View className="mt-4">
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={url}
                    onChangeText={(text) => {
                      setUrl(text);
                      setPasteHint(false);
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
                    onPress={() => void pasteLinkFromClipboard()}
                    className="min-h-[44px] items-center justify-center rounded-xl border border-border bg-card px-3 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={RECIPE_IMPORT_COPY.pasteLinkAccessibility}
                  >
                    <Text className="text-xs font-bold text-primary">{RECIPE_IMPORT_COPY.pasteLinkCta}</Text>
                  </Pressable>
                </View>
                {manualCaptionMode ? (
                  <View className="mt-2 rounded-xl border border-border bg-card p-3">
                    <Text className="text-xs text-muted">{RECIPE_IMPORT_COPY.manualCaptionHint}</Text>
                    <Text className="mt-2 text-xs font-semibold text-ink">{RECIPE_IMPORT_COPY.socialCaptionLabel}</Text>
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
                {pasteHint ? (
                  <Text className="mt-1 text-xs text-muted">{RECIPE_IMPORT_COPY.pasteAppliedHint}</Text>
                ) : null}
                <Pressable
                  onPress={() => void runLinkImport()}
                  disabled={loading}
                  className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-3"
                >
                  {loading ? (
                    <ActivityIndicator color={THEME.onPrimary} />
                  ) : (
                    <Text className="text-sm font-bold text-on-primary">{RECIPE_IMPORT_COPY.importCta}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {mode === 'photo' ? (
              <View className="mt-4">
                <Text className="text-sm text-muted">{RECIPE_IMPORT_COPY.photoScanHint}</Text>
                <Pressable
                  onPress={() => void runPhotoImport()}
                  disabled={loading}
                  className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-3"
                >
                  {loading ? (
                    <ActivityIndicator color={THEME.onPrimary} />
                  ) : (
                    <Text className="text-sm font-bold text-on-primary">{RECIPE_IMPORT_COPY.pickPhotosCta}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {mode === 'video' ? (
              <View className="mt-4">
                <Text className="text-sm text-muted">
                  Saved screen recording or video (MP4/MOV/WebM, up to about 100 MB). Deleted after import.
                </Text>
                <Pressable
                  onPress={() => void runVideoImport()}
                  disabled={loading}
                  className="mt-3 min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-3"
                >
                  {loading ? (
                    <ActivityIndicator color={THEME.onPrimary} />
                  ) : (
                    <Text className="text-sm font-bold text-on-primary">{RECIPE_IMPORT_COPY.uploadVideoCta}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {error ? (
              <View className="mt-3">
                <Text className="text-xs text-danger">{error}</Text>
                {!session && !demoMode ? (
                  <Pressable onPress={openAuthSheet} className="mt-2 self-start rounded-lg bg-primary px-3 py-2">
                    <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.guestSignInCta}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {fallbacks ? (
              <View className="mt-4 rounded-xl border border-border bg-card p-3">
                <Text className="text-xs font-semibold text-ink">{RECIPE_IMPORT_COPY.fallbackTitle}</Text>
                {fallbacks.youtubeSuggestion ? (
                  <>
                    <Text className="mt-2 text-xs text-muted">
                      {RECIPE_IMPORT_COPY.youtubeFound(fallbacks.youtubeSuggestion.channelTitle)}
                    </Text>
                    <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
                      {fallbacks.youtubeSuggestion.title}
                    </Text>
                    <Pressable
                      onPress={() => void confirmYoutubeFallback()}
                      disabled={loading}
                      className="mt-2 rounded-lg bg-primary px-3 py-2"
                    >
                      <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.youtubeConfirmCta}</Text>
                    </Pressable>
                  </>
                ) : null}
                {fallbacks.steps.includes('screenshot') ? (
                  <Pressable
                    onPress={() => void runScreenshotFallback()}
                    disabled={loading}
                    className="mt-2 rounded-lg border border-primary px-3 py-2"
                  >
                    <Text className="text-xs font-bold text-primary">{RECIPE_IMPORT_COPY.screenshotCta}</Text>
                  </Pressable>
                ) : null}
                {fallbacks.steps.includes('video_upload') ? (
                  <Pressable
                    onPress={() => {
                      setMode('video');
                      void runVideoImport();
                    }}
                    disabled={loading}
                    className="mt-2 rounded-lg border border-primary px-3 py-2"
                  >
                    <Text className="text-xs font-bold text-primary">{RECIPE_IMPORT_COPY.uploadVideoCta}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {loading && mode === 'link' ? (
              <Text className="mt-2 text-xs text-muted">{RECIPE_IMPORT_COPY.importing}</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <RecipeImportReviewSheet
        visible={review != null}
        draft={review}
        onClose={() => {
          setReview(null);
          resetAndClose();
        }}
        onSave={async (next) => {
          const saved = await saveLinkImportedRecipe(next);
          if (next.source_type === 'photo') {
            return saved;
          }
          setReview(null);
          setUrl('');
          setCaptionText('');
          setFallbacks(null);
          resetAndClose();
        }}
        onAddMissingToGrocery={(recipeId) => {
          addMissingRecipeIngredientsToGrocery(recipeId);
          resetAndClose();
        }}
      />
    </>
  );
}
