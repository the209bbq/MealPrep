import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../components/Card';
import { CategoryChips } from '../../components/CategoryChips';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PantryFilteredItemList } from '../../components/PantryFilteredItemList';
import { PantryStorageScanButtons } from '../../components/PantryStorageScanButtons';
import { PantryScanReview, PantryScanReviewStickyFooter } from '../../components/PantryScanReview';
import { PantryOverflowMenu } from '../../components/PantryOverflowMenu';
import { PantryScanTip } from '../../components/PantryScanTip';
import {
  PantryStorageLocationChips,
  PantryStorageLocationFilterChips,
} from '../../components/PantryStorageLocationChips';
import { CATEGORY_LABELS, isPantryVisionConfigured, PHOTO_SCAN, THEME } from '../../config/appConfig';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  isPantryStorageLocation,
  labelForPantryStorageLocation,
  PANTRY_LOCATION_FILTER_STORAGE_KEY,
  PANTRY_STORAGE_LOCATIONS,
  previewResortFromDefaultPantry,
  suggestStorageLocationForCategory,
  type PantryStorageLocation,
} from '../../config/pantryStorage';
import { useApp } from '../../context/AppContext';
import { countDefaultKitchenMatches } from '../../config/recipeMatching';
import { buildPantryMatchIndex } from '../../lib/recipeMatch';
import { reviewItemsToPantryItems } from '../../lib/pantryVision/reviewItems';
import { countPantryItemsForLocationFilters, countPantryItemsInLocation } from '../../lib/pantryGrouping';
import { readJson, writeJson } from '../../lib/storage';
import {
  analyzePantryPhoto,
  PantryVisionAuthError,
  PantryVisionNotConfiguredError,
  PantryVisionRateLimitError,
  PantryVisionScanError,
} from '../../lib/pantryVision/client';
import { preparePantryImage } from '../../lib/pantryVision/prepareImage';
import { detectionsToReviewItems } from '../../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem, PreparedPantryImage } from '../../lib/pantryVision/types';
import { uploadScanPhoto } from '../../lib/scanPhotos/client';
import { TabEmptyState } from '../../components/onboarding/TabEmptyState';
import { ViewScanPhotoButton } from '../../components/ViewScanPhotoButton';
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from '../../types/mealprep';

type ScanPhase = 'idle' | 'loading' | 'review';

type PantryConfirmAction =
  | { kind: 'delete-item'; item: PantryItem }
  | { kind: 'clear-location'; location: PantryStorageLocation; count: number }
  | { kind: 'clear-all'; count: number }
  | { kind: 'resort'; toFridge: number; toSpiceRack: number };

function readStoredPantryLocationFilter(): PantryStorageLocation | 'all' {
  const saved = readJson<string | null>(PANTRY_LOCATION_FILTER_STORAGE_KEY, null);
  if (saved === 'all') return 'all';
  if (saved && isPantryStorageLocation(saved)) return saved;
  return 'all';
}

export default function PantryScreen() {
  const {
    pantry,
    recipes,
    featureFlags,
    demoMode,
    session,
    savePantryScanReview,
    addManualPantryItem,
    updatePantryItemEntry,
    deletePantryItemEntry,
    clearPantryLocation,
    clearAllPantry,
    resortPantryItemsInDefaultLocation,
  } = useApp();
  const [filter, setFilter] = useState<PantryCategory | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<PantryStorageLocation | 'all'>(readStoredPantryLocationFilter);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<PantryScanReviewItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanErrorTitle, setScanErrorTitle] = useState<string | null>(null);
  const [lastScanAttempt, setLastScanAttempt] = useState<
    | { kind: 'prepared'; prepared: PreparedPantryImage; location: PantryStorageLocation }
    | { kind: 'uri'; uri: string; location: PantryStorageLocation }
    | null
  >(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('each');
  const [manualCategory, setManualCategory] = useState<PantryCategory>('produce');
  const [manualLocation, setManualLocation] = useState<PantryStorageLocation>(DEFAULT_PANTRY_STORAGE_LOCATION);
  const [confirmAction, setConfirmAction] = useState<PantryConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scanLocationHint, setScanLocationHint] = useState<PantryStorageLocation>(
    DEFAULT_PANTRY_STORAGE_LOCATION,
  );
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [scanRecipeCount, setScanRecipeCount] = useState<number | null>(null);
  const [pendingScanPhotoPath, setPendingScanPhotoPath] = useState<string | null>(null);
  const pantryScanUploadRef = useRef<Promise<string | null> | null>(null);

  const visionReady = isPantryVisionConfigured();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;

  const locationCounts = useMemo(
    () =>
      Object.fromEntries(
        PANTRY_STORAGE_LOCATIONS.map((location) => [location, countPantryItemsInLocation(pantry, location)]),
      ) as Record<PantryStorageLocation, number>,
    [pantry],
  );

  const locationFilterCounts = useMemo(
    () => countPantryItemsForLocationFilters(pantry, filter),
    [filter, pantry],
  );

  function selectLocationFilter(next: PantryStorageLocation | 'all') {
    setLocationFilter(next);
    writeJson(PANTRY_LOCATION_FILTER_STORAGE_KEY, next);
  }

  const resortPreview = useMemo(() => previewResortFromDefaultPantry(pantry), [pantry]);

  function clearScanFailure() {
    setScanError(null);
    setScanErrorTitle(null);
    setLastScanAttempt(null);
  }

  function setScanFailure(
    message: string,
    title: string,
    attempt:
      | { kind: 'prepared'; prepared: PreparedPantryImage; location: PantryStorageLocation }
      | { kind: 'uri'; uri: string; location: PantryStorageLocation }
      | null,
  ) {
    setScanError(message);
    setScanErrorTitle(title);
    setLastScanAttempt(attempt);
  }

  function retryLastScan() {
    if (!lastScanAttempt) return;
    if (lastScanAttempt.kind === 'prepared') {
      void runVisionFromPrepared(lastScanAttempt.prepared, lastScanAttempt.location);
      return;
    }
    void runVisionFromUri(lastScanAttempt.uri, lastScanAttempt.location);
  }

  async function runVisionFromPrepared(
    prepared: PreparedPantryImage,
    scanLocation: PantryStorageLocation,
  ) {
    if (!featureFlags.photoScan) {
      Alert.alert('Feature off', 'Photo scan is disabled in feature toggles.');
      return;
    }

    setScanLocationHint(scanLocation);
    clearScanFailure();
    setPhase('loading');
    setPreviewUri(prepared.uri);

    const attempt = { kind: 'prepared' as const, prepared, location: scanLocation };

    setPendingScanPhotoPath(null);
    if (userId) {
      const uploadPromise = uploadScanPhoto(prepared, 'pantry', userId);
      pantryScanUploadRef.current = uploadPromise;
      void uploadPromise.then(setPendingScanPhotoPath);
    } else {
      pantryScanUploadRef.current = null;
    }

    try {
      const result = await analyzePantryPhoto(prepared, accessToken, { scanLocation });
      const rows = detectionsToReviewItems(
        result.items,
        pantry,
        recipes,
        prepared.uri,
        demoMode,
        scanLocation,
      );
      if (rows.length === 0) {
        setScanFailure(
          'No pantry items were detected. Try a clearer photo with labels visible.',
          'No items found',
          attempt,
        );
        setPhase('idle');
        return;
      }
      clearScanFailure();
      setModelLabel(result.model);
      setReviewItems(rows);
      setPhase('review');
    } catch (error) {
      const title =
        error instanceof PantryVisionRateLimitError
          ? 'Too many scans'
          : error instanceof PantryVisionAuthError
            ? 'Sign in required'
            : error instanceof PantryVisionNotConfiguredError
              ? 'Scan not set up'
              : PHOTO_SCAN.scanFailedTitle;
      const message =
        error instanceof PantryVisionNotConfiguredError
          ? error.message
          : error instanceof PantryVisionAuthError
            ? error.message
            : error instanceof PantryVisionRateLimitError
              ? error.message
              : error instanceof PantryVisionScanError
                ? error.message
                : PHOTO_SCAN.scanFailedMessage;
      const canRetry = !(error instanceof PantryVisionNotConfiguredError);
      setScanFailure(message, title, canRetry ? attempt : null);
      setPhase('idle');
    }
  }

  async function runVisionFromUri(uri: string, scanLocation: PantryStorageLocation) {
    clearScanFailure();
    setPhase('loading');
    setPreviewUri(uri);
    const attempt = { kind: 'uri' as const, uri, location: scanLocation };
    try {
      const prepared = await preparePantryImage(uri);
      await runVisionFromPrepared(prepared, scanLocation);
    } catch (error) {
      if (error instanceof Error) {
        console.warn('[pantry scan]', error.message);
      }
      setScanFailure(PHOTO_SCAN.scanFailedMessage, PHOTO_SCAN.scanFailedTitle, attempt);
      setPhase('idle');
    }
  }

  async function handleNativeScan(scanLocation: PantryStorageLocation, source: 'camera' | 'library') {
    if (source === 'camera') {
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
      await runVisionFromUri(result.assets[0].uri, scanLocation);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: PHOTO_SCAN.jpegQuality,
    });
    if (result.canceled || !result.assets[0]) return;
    await runVisionFromUri(result.assets[0].uri, scanLocation);
  }

  async function handleSaveReview() {
    setSaving(true);
    setSaveError(null);
    try {
      const mergedPantry = [...reviewItemsToPantryItems(reviewItems), ...pantry];
      const recipeCount = countDefaultKitchenMatches(
        buildPantryMatchIndex(recipes, mergedPantry).ranked,
        mergedPantry.length,
      );
      let scanPhotoPath = pendingScanPhotoPath;
      if (!scanPhotoPath && pantryScanUploadRef.current) {
        scanPhotoPath = await pantryScanUploadRef.current;
      }
      await savePantryScanReview(reviewItems, scanPhotoPath);
      setPhase('idle');
      setReviewItems([]);
      setPreviewUri(null);
      setPendingScanPhotoPath(null);
      clearScanFailure();
      setSaveError(null);
      setScanRecipeCount(recipeCount);
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
    setPendingScanPhotoPath(null);
    setScanLocationHint(DEFAULT_PANTRY_STORAGE_LOCATION);
  }

  function resetManualForm() {
    setManualName('');
    setManualQty('1');
    setManualUnit('each');
    setManualCategory('produce');
    setManualLocation(suggestStorageLocationForCategory('produce'));
  }

  function openAddModal() {
    resetManualForm();
    setEditItem(null);
    setAddOpen(true);
  }

  function openEditModal(item: PantryItem) {
    setEditItem(item);
    setManualName(item.name);
    setManualQty(String(item.quantity));
    setManualUnit(item.unit);
    setManualCategory(item.category);
    setManualLocation(item.location);
    setAddOpen(true);
  }

  function closeManualModal() {
    setAddOpen(false);
    setEditItem(null);
    setFormError(null);
  }

  async function submitManualForm() {
    const qty = Number.parseFloat(manualQty);
    if (!manualName.trim()) {
      setFormError('Enter an item name.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Enter a valid quantity.');
      return;
    }
    setFormError(null);
    try {
      if (editItem) {
        await updatePantryItemEntry({
          ...editItem,
          name: manualName.trim(),
          quantity: qty,
          unit: manualUnit.trim() || 'each',
          category: manualCategory,
          location: manualLocation,
        });
      } else {
        await addManualPantryItem({
          name: manualName.trim(),
          quantity: qty,
          unit: manualUnit.trim() || 'each',
          category: manualCategory,
          location: manualLocation,
        });
      }
      closeManualModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Try again.');
    }
  }

  function requestDeleteItem() {
    if (!editItem) return;
    setConfirmAction({ kind: 'delete-item', item: editItem });
  }

  async function runConfirmAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.kind === 'delete-item') {
        await deletePantryItemEntry(confirmAction.item.id);
        closeManualModal();
      } else if (confirmAction.kind === 'clear-location') {
        await clearPantryLocation(confirmAction.location);
      } else if (confirmAction.kind === 'resort') {
        await resortPantryItemsInDefaultLocation();
      } else {
        await clearAllPantry();
      }
      setConfirmAction(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Something went wrong.');
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const confirmCopy = useMemo(() => {
    if (!confirmAction) return null;
    if (confirmAction.kind === 'delete-item') {
      return {
        title: 'Delete item?',
        message: `Remove “${confirmAction.item.name}” from your pantry? This cannot be undone.`,
        confirmLabel: 'Delete item',
        destructive: true,
      };
    }
    if (confirmAction.kind === 'clear-location') {
      const label = labelForPantryStorageLocation(confirmAction.location);
      return {
        title: `Clear ${label}?`,
        message: `Remove all ${confirmAction.count} item(s) in ${label}? This cannot be undone.`,
        confirmLabel: `Clear ${label}`,
        destructive: true,
      };
    }
    if (confirmAction.kind === 'resort') {
      const parts: string[] = [];
      if (confirmAction.toFridge > 0) {
        parts.push(`${confirmAction.toFridge} to ${labelForPantryStorageLocation('fridge')}`);
      }
      if (confirmAction.toSpiceRack > 0) {
        parts.push(`${confirmAction.toSpiceRack} to ${labelForPantryStorageLocation('spice_rack')}`);
      }
      return {
        title: 'Re-sort items?',
        message: `Move ${parts.join(' and ')} from the default Pantry section. Items already in Fridge or Spice rack stay put.`,
        confirmLabel: 'Re-sort',
        destructive: false,
      };
    }
    return {
      title: 'Clear entire pantry?',
      message: `Remove all ${confirmAction.count} item(s) from every storage location? This cannot be undone.`,
      confirmLabel: 'Clear everything',
      destructive: true,
    };
  }, [confirmAction]);

  const reviewEnabledCount = useMemo(() => reviewItems.filter((i) => i.enabled).length, [reviewItems]);

  const showSetupHint = !visionReady && !demoMode;
  const scanControlsVisible = phase !== 'review';

  return (
    <>
      <View className="flex-1 bg-paper">
        <ScrollView className="flex-1 px-4 pb-8" contentContainerStyle={{ paddingBottom: phase === 'review' ? 96 : 32 }}>
        <View className="mt-4 flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">Pantry</Text>
            <Text className="text-sm text-muted">Track what you own — fewer duplicate buys</Text>
          </View>
          {pantry.length > 0 ? (
            <Pressable onPress={() => setOverflowOpen(true)} className="rounded-full border border-border bg-card p-2">
              <Ionicons name="ellipsis-horizontal" size={22} color={THEME.ink} />
            </Pressable>
          ) : null}
        </View>

        {scanRecipeCount != null && scanRecipeCount > 0 ? (
          <View className="mt-4 rounded-2xl border border-emerald bg-emerald-light px-4 py-4">
            <Text className="font-bold text-emerald-dark">Pantry updated</Text>
            <Text className="mt-1 text-sm text-emerald-dark">
              See {scanRecipeCount} recipe{scanRecipeCount === 1 ? '' : 's'} you can make with default matches.
            </Text>
            <Pressable
              onPress={() => {
                setScanRecipeCount(null);
                router.push('/recipes');
              }}
              className="mt-3 items-center rounded-xl bg-emerald py-3"
            >
              <Text className="text-sm font-bold text-on-emerald">See {scanRecipeCount} recipes</Text>
            </Pressable>
          </View>
        ) : null}

        <Card className="mt-4" title="Pantry inventory" subtitle="Filter by category or scan new items">
          {scanControlsVisible ? (
            <>
              <PantryStorageScanButtons
                disabled={phase === 'loading' || !featureFlags.photoScan}
                onImagePrepared={(location, prepared) => void runVisionFromPrepared(prepared, location)}
                onRequestNativeScan={(location, source) => void handleNativeScan(location, source)}
              />

              {featureFlags.photoScan ? <PantryScanTip className="mt-2" /> : null}
            </>
          ) : null}

          {phase === 'loading' ? (
            <View className="mt-4 items-center py-6">
              <ActivityIndicator size="large" color={THEME.primary} />
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
              Demo mode: scan returns labeled sample detections only (no cloud scan).
            </Text>
          ) : null}

          {scanError ? (
            <View className="mt-3 rounded-xl border border-danger/25 bg-paper p-3">
              <Text className="text-sm font-bold text-ink">{scanErrorTitle ?? PHOTO_SCAN.scanFailedTitle}</Text>
              <Text className="mt-1 text-xs text-muted">{scanError}</Text>
              {lastScanAttempt ? (
                <Pressable
                  onPress={retryLastScan}
                  className="mt-3 items-center rounded-xl border border-border bg-card py-2.5"
                >
                  <Text className="text-sm font-bold text-emerald-dark">{PHOTO_SCAN.tryAgainLabel}</Text>
                </Pressable>
              ) : null}
            </View>
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
              defaultBatchLocation={scanLocationHint}
              stickyFooter
            />
          ) : null}

          <Pressable
            onPress={openAddModal}
            className="mt-4 rounded-xl border border-border bg-card px-3 py-3"
          >
            <Text className="text-center text-sm font-bold text-emerald-dark">Add item manually</Text>
          </Pressable>
        </Card>

        <PantryStorageLocationFilterChips
          selected={locationFilter}
          onSelect={selectLocationFilter}
          counts={locationFilterCounts}
        />

        <CategoryChips selected={filter} onSelect={setFilter} />

        {actionError ? <Text className="mb-2 text-xs font-semibold text-danger">{actionError}</Text> : null}

        {pantry.length === 0 ? (
          <TabEmptyState tab="pantry" />
        ) : (
          <PantryFilteredItemList
            items={pantry}
            categoryFilter={filter}
            locationFilter={locationFilter}
            onPressItem={openEditModal}
          />
        )}
        </ScrollView>

        {phase === 'review' ? (
          <PantryScanReviewStickyFooter
            saving={saving}
            enabledCount={reviewEnabledCount}
            onSave={() => void handleSaveReview()}
            onCancel={handleCancelReview}
          />
        ) : null}
      </View>

      <PantryOverflowMenu
        visible={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        resortPreviewTotal={resortPreview.total}
        onResort={() =>
          setConfirmAction({
            kind: 'resort',
            toFridge: resortPreview.toFridge,
            toSpiceRack: resortPreview.toSpiceRack,
          })
        }
        locationCounts={locationCounts}
        onClearLocation={(location, count) => setConfirmAction({ kind: 'clear-location', location, count })}
        totalCount={pantry.length}
        onClearAll={() => setConfirmAction({ kind: 'clear-all', count: pantry.length })}
      />

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={closeManualModal}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl border border-border bg-paper px-4 pb-8 pt-4">
            <Text className="text-lg font-bold text-ink">{editItem ? 'Edit item' : 'Add item'}</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Item name"
              placeholderTextColor={THEME.muted}
              className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
            />
            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={manualQty}
                onChangeText={setManualQty}
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={THEME.muted}
                className="w-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
              <TextInput
                value={manualUnit}
                onChangeText={setManualUnit}
                placeholder="Unit"
                placeholderTextColor={THEME.muted}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base text-ink"
              />
            </View>
            <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              {PANTRY_CATEGORIES.map((cat) => {
                const selected = manualCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setManualCategory(cat);
                      if (!editItem) {
                        setManualLocation(suggestStorageLocationForCategory(cat));
                      }
                    }}
                    className={`mr-2 rounded-full px-3 py-2 ${selected ? 'bg-emerald' : 'border border-border bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-on-emerald' : 'text-slate'}`}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="mt-4">
              <PantryStorageLocationChips
                selected={manualLocation}
                onSelect={setManualLocation}
              />
            </View>
            {editItem?.scanPhotoPath ? (
              <ViewScanPhotoButton scanPhotoPath={editItem.scanPhotoPath} />
            ) : null}
            {formError ? <Text className="mt-2 text-xs font-semibold text-danger">{formError}</Text> : null}
            {editItem ? (
              <Pressable
                onPress={requestDeleteItem}
                className="mt-4 rounded-2xl border border-danger/30 py-3"
              >
                <Text className="text-center font-bold text-danger">Delete item</Text>
              </Pressable>
            ) : null}
            <View className="mt-6 flex-row gap-2">
              <Pressable onPress={closeManualModal} className="flex-1 rounded-2xl border border-border py-3">
                <Text className="text-center font-bold text-slate">Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void submitManualForm()} className="flex-1 rounded-2xl bg-emerald py-3">
                <Text className="text-center font-bold text-on-emerald">{editItem ? 'Save changes' : 'Add to pantry'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmAction !== null && confirmCopy !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmLabel={confirmCopy?.confirmLabel}
        destructive={confirmCopy?.destructive}
        loading={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
        onConfirm={() => void runConfirmAction()}
      />
    </>
  );
}
