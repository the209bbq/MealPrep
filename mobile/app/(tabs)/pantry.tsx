import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { CategoryChips } from '../../components/CategoryChips';
import { PantryPhotoCapture } from '../../components/PantryPhotoCapture';
import { PantryScanReview } from '../../components/PantryScanReview';
import { CATEGORY_LABELS, isPantryVisionConfigured, PHOTO_SCAN } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import {
  analyzePantryPhoto,
  PantryVisionAuthError,
  PantryVisionNotConfiguredError,
  PantryVisionRateLimitError,
} from '../../lib/pantryVision/client';
import { preparePantryImage } from '../../lib/pantryVision/prepareImage';
import { detectionsToReviewItems } from '../../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem, PreparedPantryImage } from '../../lib/pantryVision/types';
import type { PantryCategory } from '../../types/mealprep';

type ScanPhase = 'idle' | 'loading' | 'review';

export default function PantryScreen() {
  const {
    pantry,
    recipes,
    featureFlags,
    demoMode,
    session,
    savePantryScanReview,
  } = useApp();
  const [filter, setFilter] = useState<PantryCategory | 'all'>('all');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<PantryScanReviewItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const visionReady = isPantryVisionConfigured();
  const accessToken = session?.access_token ?? null;

  const filtered = useMemo(
    () => (filter === 'all' ? pantry : pantry.filter((item) => item.category === filter)),
    [filter, pantry],
  );

  async function runVisionFromPrepared(prepared: PreparedPantryImage) {
    if (!featureFlags.photoScan) {
      Alert.alert('Feature off', 'Photo scan is disabled in feature toggles.');
      return;
    }

    setScanError(null);
    setPhase('loading');
    setPreviewUri(prepared.uri);

    try {
      const result = await analyzePantryPhoto(prepared, accessToken);
      const rows = detectionsToReviewItems(result.items, pantry, recipes, prepared.uri, demoMode);
      if (rows.length === 0) {
        setScanError('No pantry items were detected. Try a clearer photo with labels visible.');
        setPhase('idle');
        return;
      }
      setModelLabel(result.model);
      setReviewItems(rows);
      setPhase('review');
    } catch (error) {
      const message =
        error instanceof PantryVisionNotConfiguredError
          ? error.message
          : error instanceof PantryVisionAuthError
            ? error.message
            : error instanceof PantryVisionRateLimitError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Pantry scan failed';
      setScanError(message);
      setPhase('idle');
    }
  }

  async function runVisionFromUri(uri: string) {
    setScanError(null);
    setPhase('loading');
    setPreviewUri(uri);
    try {
      const prepared = await preparePantryImage(uri);
      await runVisionFromPrepared(prepared);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pantry scan failed';
      setScanError(message);
      setPhase('idle');
    }
  }

  async function handleNativeCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera', 'Camera permission is required for pantry scanning.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: PHOTO_SCAN.jpegQuality,
    });
    if (result.canceled || !result.assets[0]) return;
    await runVisionFromUri(result.assets[0].uri);
  }

  async function handleNativeLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: PHOTO_SCAN.jpegQuality,
    });
    if (result.canceled || !result.assets[0]) return;
    await runVisionFromUri(result.assets[0].uri);
  }

  async function handleSaveReview() {
    setSaving(true);
    setSaveError(null);
    try {
      await savePantryScanReview(reviewItems);
      setPhase('idle');
      setReviewItems([]);
      setPreviewUri(null);
      setScanError(null);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save pantry items';
      setSaveError(message);
      if (Platform.OS !== 'web') {
        Alert.alert('Save failed', message);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancelReview() {
    setPhase('idle');
    setReviewItems([]);
    setPreviewUri(null);
  }

  const showSetupHint = !visionReady && !demoMode;

  return (
    <ScrollView className="flex-1 bg-paper px-4 pb-8">
      <Card className="mt-4" title="Pantry inventory" subtitle="Filter by category or scan new items">
        {Platform.OS === 'web' ? (
          <PantryPhotoCapture
            disabled={phase === 'loading' || !featureFlags.photoScan}
            onImagePrepared={(prepared) => void runVisionFromPrepared(prepared)}
            onError={(message) => {
              setScanError(message);
              setPhase('idle');
            }}
          />
        ) : (
          <View className="mt-3 flex-row gap-2">
            <Pressable
              disabled={phase === 'loading' || !featureFlags.photoScan}
              onPress={() => void handleNativeCamera()}
              className={`flex-1 rounded-xl px-3 py-3 ${phase === 'loading' || !featureFlags.photoScan ? 'bg-slate/40' : 'bg-emerald'}`}
            >
              <Text className="text-center text-sm font-bold text-on-emerald">Scan shelf</Text>
            </Pressable>
            <Pressable
              disabled={phase === 'loading' || !featureFlags.photoScan}
              onPress={() => void handleNativeLibrary()}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-3"
            >
              <Text className="text-center text-sm font-bold text-slate">Pick photo</Text>
            </Pressable>
          </View>
        )}

        {phase === 'loading' ? (
          <View className="mt-4 items-center py-6">
            <ActivityIndicator size="large" color="#047857" />
            <Text className="mt-2 text-sm text-muted">Analyzing photo…</Text>
          </View>
        ) : null}

        {previewUri ? (
          <Image source={{ uri: previewUri }} className="mt-3 h-32 w-full rounded-xl" resizeMode="cover" />
        ) : null}

        {showSetupHint ? (
          <View className="mt-3 rounded-xl border border-border bg-paper p-3">
            <Text className="text-sm font-semibold text-ink">Photo scan not set up yet</Text>
            <Text className="mt-1 text-xs text-muted">{PHOTO_SCAN.notConfiguredMessage}</Text>
          </View>
        ) : null}

        {demoMode ? (
          <Text className="mt-2 text-xs text-muted">
            Demo mode: scan returns labeled sample detections only (no Gemini call).
          </Text>
        ) : null}

        {scanError ? (
          <Text className="mt-2 text-xs font-semibold text-danger">{scanError}</Text>
        ) : null}

        {phase === 'review' ? (
          <PantryScanReview
            items={reviewItems}
            onChange={setReviewItems}
            onSave={() => void handleSaveReview()}
            onCancel={handleCancelReview}
            saving={saving}
            modelLabel={modelLabel}
            saveError={saveError}
          />
        ) : null}
      </Card>

      <CategoryChips selected={filter} onSelect={setFilter} />

      {filtered.map((item) => (
        <Card key={item.id} className="mb-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-base font-bold text-ink">{item.name}</Text>
              <Text className="text-sm text-muted">
                {CATEGORY_LABELS[item.category]} · {item.quantity} {item.unit}
              </Text>
              <Text className="text-xs text-muted">{item.location}</Text>
            </View>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} className="h-14 w-14 rounded-lg" />
            ) : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
