import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { RECIPE_IMPORT, RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import {
  RecipeImportAuthError,
  RecipeImportFallbackRequiredError,
  RecipeImportNotConfiguredError,
  RecipeImportNotRecipeError,
  RecipeImportRateLimitError,
  RecipeImportRedditTipError,
  RecipeImportUpstreamError,
  confirmYoutubeRecipeImport,
  importRecipeFromPhotos,
  importRecipeFromScreenshots,
  importRecipeFromUploadedVideoPath,
  importRecipeSmartInput,
} from '../../lib/recipeImport/client';
import {
  applyRedditCreditToImport,
  findRedditUrlInText,
  resolveRedditImportContext,
  stripRedditUrlsFromText,
} from '../../lib/recipeImport/redditClient';
import { MIN_TEXT_IMPORT_CHARS } from '../../lib/recipeImport/parseImportInput';
import {
  pickRecipeImportPhotoFromCamera,
  pickRecipeImportPhotosFromLibrary,
  type RecipeImportPickedImage,
} from '../../lib/recipeImport/pickRecipeImportPhoto';
import type { RecipeImportExtractedDto, RecipeImportFallbacksDto } from '../../lib/recipeImport/types';
import { uploadRecipeImportPhotos, uploadRecipeImportVideo } from '../../lib/recipeImport/uploadImportVideo';
import { RecipeImportReviewSheet } from './RecipeImportReviewSheet';

async function pickImportVideo(): Promise<{
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
} | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is needed.');
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

export function RecipeImportBox({
  initialText = '',
  autoRun = false,
}: {
  initialText?: string;
  autoRun?: boolean;
}) {
  const {
    session,
    openAuthSheet,
    saveLinkImportedRecipe,
    addMissingRecipeIngredientsToGrocery,
    demoMode,
  } = useApp();
  const authUserId = session?.user.id ?? null;

  const [input, setInput] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbacks, setFallbacks] = useState<RecipeImportFallbacksDto | null>(null);
  const [review, setReview] = useState<RecipeImportExtractedDto | null>(null);
  const [rememberedRedditPostUrl, setRememberedRedditPostUrl] = useState<string | null>(null);
  const [redditTip, setRedditTip] = useState<string | null>(null);
  const autoRunRef = useRef(false);

  const handleImportError = useCallback((err: unknown) => {
    if (err instanceof RecipeImportAuthError) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
    } else if (err instanceof RecipeImportFallbackRequiredError || err instanceof RecipeImportNotRecipeError) {
      setError(RECIPE_IMPORT_COPY.needMoreHint);
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
  }, []);

  const runSmartImport = useCallback(async (rawOverride?: string) => {
    setError(null);
    setFallbacks(null);
    setRedditTip(null);
    const raw = (rawOverride ?? input).trim();
    if (!raw) {
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
      const redditInInput = findRedditUrlInText(raw);
      if (redditInInput) setRememberedRedditPostUrl(redditInInput);
      const extracted = await importRecipeSmartInput(raw, token, {
        rememberedRedditPostUrl,
      });
      setReview(extracted);
      const stillRedditOnly =
        Boolean(redditInInput) && stripRedditUrlsFromText(raw).length < MIN_TEXT_IMPORT_CHARS;
      if (!stillRedditOnly) {
        setInput('');
        setRememberedRedditPostUrl(null);
      }
    } catch (err) {
      if (err instanceof RecipeImportRedditTipError) {
        const url = findRedditUrlInText(raw) ?? rememberedRedditPostUrl;
        if (url) setRememberedRedditPostUrl(url);
        setRedditTip(err.message);
        setError(null);
        setFallbacks(null);
        return;
      }
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }, [demoMode, handleImportError, input, rememberedRedditPostUrl, session]);

  const applyRedditSessionCredit = useCallback(
    (extracted: RecipeImportExtractedDto) => {
      const ctx = resolveRedditImportContext(input, rememberedRedditPostUrl);
      if (!ctx) return extracted;
      return applyRedditCreditToImport(extracted, ctx);
    },
    [input, rememberedRedditPostUrl],
  );

  useEffect(() => {
    if (!autoRun || autoRunRef.current || !initialText.trim()) return;
    autoRunRef.current = true;
    void runSmartImport(initialText);
  }, [autoRun, initialText, runSmartImport]);

  async function uploadPickedImages(images: RecipeImportPickedImage[]) {
    if ((!session && !demoMode) || !authUserId) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return null;
    }
    return uploadRecipeImportPhotos(
      authUserId,
      images.map((image) => ({
        uri: '',
        mimeType: image.mimeType,
        base64: image.data,
      })),
    );
  }

  async function runCameraPhotoImport() {
    if ((!session && !demoMode) || !authUserId) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setError(null);
    let images: RecipeImportPickedImage[] = [];
    try {
      images = await pickRecipeImportPhotoFromCamera();
    } catch (err) {
      handleImportError(err);
      return;
    }
    if (images.length === 0) {
      return;
    }
    setLoading(true);
    try {
      const paths = await uploadPickedImages(images);
      if (!paths) {
        setLoading(false);
        return;
      }
      const token = session?.access_token ?? null;
      const redditCtx = resolveRedditImportContext(input, rememberedRedditPostUrl);
      const extracted = await importRecipeFromPhotos(token, {
        photoStoragePaths: paths,
        privateImport: Boolean(redditCtx),
      });
      setReview(applyRedditSessionCredit(extracted));
      setFallbacks(null);
      if (redditCtx) {
        setRememberedRedditPostUrl(null);
        setRedditTip(null);
      }
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function runPhotoImport() {
    if ((!session && !demoMode) || !authUserId) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const images = await pickRecipeImportPhotosFromLibrary(RECIPE_IMPORT.maxPhotos);
      if (images.length === 0) {
        setLoading(false);
        return;
      }
      const paths = await uploadPickedImages(images);
      if (!paths) {
        setLoading(false);
        return;
      }
      const token = session?.access_token ?? null;
      const redditCtx = resolveRedditImportContext(input, rememberedRedditPostUrl);
      const extracted = await importRecipeFromPhotos(token, {
        photoStoragePaths: paths,
        privateImport: Boolean(redditCtx),
      });
      setReview(applyRedditSessionCredit(extracted));
      setFallbacks(null);
      if (redditCtx) {
        setRememberedRedditPostUrl(null);
        setRedditTip(null);
      }
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function runVideoImport() {
    if (!session || !authUserId) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const picked = await pickImportVideo();
      if (!picked) {
        setLoading(false);
        return;
      }
      const path = await uploadRecipeImportVideo(authUserId, picked);
      const extracted = await importRecipeFromUploadedVideoPath(path, session.access_token);
      setReview(extracted);
      setFallbacks(null);
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  async function runScreenshotImport() {
    if ((!session && !demoMode) || !authUserId) {
      setError(RECIPE_IMPORT_COPY.guestSignInMessage);
      return;
    }
    setLoading(true);
    try {
      const images = await pickRecipeImportPhotosFromLibrary(RECIPE_IMPORT.maxPhotos);
      if (images.length === 0) {
        setLoading(false);
        return;
      }
      const paths = await uploadPickedImages(images);
      if (!paths) {
        setLoading(false);
        return;
      }
      const token = session?.access_token ?? null;
      const extracted = await importRecipeFromScreenshots(token, {
        captionText: input.trim() || undefined,
        photoStoragePaths: paths,
      });
      setReview(extracted);
      setFallbacks(null);
      setError(null);
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
    try {
      const token = session?.access_token ?? null;
      const extracted = await confirmYoutubeRecipeImport(suggestion.watchUrl, token);
      setReview(extracted);
      setFallbacks(null);
      setError(null);
    } catch (err) {
      handleImportError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <View className="mt-3">
        <View className="flex-row items-stretch overflow-hidden rounded-xl border border-border bg-card">
          <TextInput
            value={input}
            onChangeText={(text) => {
              setInput(text);
              setError(null);
              setFallbacks(null);
              const redditUrl = findRedditUrlInText(text);
              if (redditUrl) setRememberedRedditPostUrl(redditUrl);
            }}
            placeholder={RECIPE_IMPORT_COPY.importBoxPlaceholder}
            placeholderTextColor={THEME.muted}
            className="min-h-[48px] flex-1 px-3 py-2 text-sm text-ink"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            accessibilityLabel={RECIPE_IMPORT_COPY.importBoxLabel}
            onSubmitEditing={() => void runSmartImport()}
          />
          <Pressable
            onPress={() => void runCameraPhotoImport()}
            disabled={loading}
            className="min-h-[48px] items-center justify-center border-l border-border px-3"
            accessibilityRole="button"
            accessibilityLabel={RECIPE_IMPORT_COPY.cameraAccessibility}
          >
            <Ionicons name="camera-outline" size={22} color={THEME.primary} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => void runSmartImport()}
          disabled={loading}
          className="mt-2 min-h-[40px] flex-row items-center justify-center rounded-full bg-primary px-3 py-2"
          accessibilityRole="button"
          accessibilityLabel={RECIPE_IMPORT_COPY.importButtonAccessibility}
        >
          {loading ? (
            <ActivityIndicator color={THEME.onPrimary} />
          ) : (
            <Text className="text-sm font-bold text-on-primary">{RECIPE_IMPORT_COPY.importCta}</Text>
          )}
        </Pressable>
        {redditTip ? <Text className="mt-2 text-xs text-muted">{redditTip}</Text> : null}
        {loading ? (
          <Text className="mt-1 text-xs text-muted">{RECIPE_IMPORT_COPY.importing}</Text>
        ) : null}
        {error ? (
          <View className="mt-2">
            <Text className="text-xs text-muted">{error}</Text>
            {!session && !demoMode ? (
              <Pressable onPress={openAuthSheet} className="mt-2 self-start rounded-lg bg-primary px-3 py-2">
                <Text className="text-xs font-bold text-on-primary">{RECIPE_IMPORT_COPY.guestSignInCta}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {fallbacks ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {fallbacks.youtubeSuggestion ? (
              <Pressable onPress={() => void confirmYoutubeFallback()} disabled={loading}>
                <Text className="text-xs font-semibold text-primary">
                  {RECIPE_IMPORT_COPY.youtubeConfirmCta} · {fallbacks.youtubeSuggestion.channelTitle}
                </Text>
              </Pressable>
            ) : null}
            {fallbacks.steps.includes('screenshot') ? (
              <Pressable onPress={() => void runScreenshotImport()} disabled={loading}>
                <Text className="text-xs font-semibold text-primary">{RECIPE_IMPORT_COPY.screenshotCta}</Text>
              </Pressable>
            ) : null}
            {fallbacks.steps.includes('video_upload') ? (
              <Pressable onPress={() => void runVideoImport()} disabled={loading}>
                <Text className="text-xs font-semibold text-primary">{RECIPE_IMPORT_COPY.addVideoCta}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void runPhotoImport()} disabled={loading}>
              <Text className="text-xs font-semibold text-primary">{RECIPE_IMPORT_COPY.addPhotoCta}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <RecipeImportReviewSheet
        visible={review != null}
        draft={review}
        onClose={() => setReview(null)}
        onSave={async (next) => {
          const saved = await saveLinkImportedRecipe(next);
          if (next.source_type === 'photo') {
            return saved;
          }
          setReview(null);
        }}
        onAddMissingToGrocery={(recipeId) => {
          addMissingRecipeIngredientsToGrocery(recipeId);
          setReview(null);
        }}
      />
    </>
  );
}
