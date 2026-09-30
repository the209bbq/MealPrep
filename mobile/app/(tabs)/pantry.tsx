import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
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
import { PantryLocationSections } from '../../components/PantryLocationSections';
import { PantryPhotoCapture } from '../../components/PantryPhotoCapture';
import { PantryScanReview } from '../../components/PantryScanReview';
import { PantryScanTip } from '../../components/PantryScanTip';
import {
  PantryStorageLocationChips,
  PantryStorageLocationFilterChips,
} from '../../components/PantryStorageLocationChips';
import { CATEGORY_LABELS, isPantryVisionConfigured, PHOTO_SCAN, THEME } from '../../config/appConfig';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  labelForPantryStorageLocation,
  PANTRY_STORAGE_LOCATIONS,
  suggestStorageLocationForCategory,
  type PantryStorageLocation,
} from '../../config/pantryStorage';
import { useApp } from '../../context/AppContext';
import { countPantryItemsInLocation } from '../../lib/pantryGrouping';
import {
  analyzePantryPhoto,
  PantryVisionAuthError,
  PantryVisionNotConfiguredError,
  PantryVisionRateLimitError,
} from '../../lib/pantryVision/client';
import { preparePantryImage } from '../../lib/pantryVision/prepareImage';
import { detectionsToReviewItems } from '../../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem, PreparedPantryImage } from '../../lib/pantryVision/types';
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from '../../types/mealprep';

type ScanPhase = 'idle' | 'loading' | 'review';

type PantryConfirmAction =
  | { kind: 'delete-item'; item: PantryItem }
  | { kind: 'clear-location'; location: PantryStorageLocation; count: number }
  | { kind: 'clear-all'; count: number };

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
  } = useApp();
  const [filter, setFilter] = useState<PantryCategory | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<PantryStorageLocation | 'all'>('all');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<PantryScanReviewItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
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

  const visionReady = isPantryVisionConfigured();
  const accessToken = session?.access_token ?? null;

  const locationCounts = useMemo(
    () =>
      Object.fromEntries(
        PANTRY_STORAGE_LOCATIONS.map((location) => [location, countPantryItemsInLocation(pantry, location)]),
      ) as Record<PantryStorageLocation, number>,
    [pantry],
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
    try {
      await savePantryScanReview(reviewItems);
      setPhase('idle');
      setReviewItems([]);
      setPreviewUri(null);
      setScanError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save pantry items';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelReview() {
    setPhase('idle');
    setReviewItems([]);
    setPreviewUri(null);
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
    return {
      title: 'Clear entire pantry?',
      message: `Remove all ${confirmAction.count} item(s) from every storage location? This cannot be undone.`,
      confirmLabel: 'Clear everything',
      destructive: true,
    };
  }, [confirmAction]);

  const showSetupHint = !visionReady && !demoMode;
  const scanControlsVisible = phase !== 'review';

  return (
    <>
      <ScrollView className="flex-1 bg-paper px-4 pb-8">
        <Card className="mt-4" title="Pantry inventory" subtitle="Filter by category or scan new items">
          {scanControlsVisible ? (
            <>
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

              {featureFlags.photoScan ? <PantryScanTip className="mt-2" /> : null}
            </>
          ) : null}

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
            />
          ) : null}

          <Pressable
            onPress={openAddModal}
            className="mt-4 rounded-xl border border-border bg-card px-3 py-3"
          >
            <Text className="text-center text-sm font-bold text-emerald-dark">Add item manually</Text>
          </Pressable>
        </Card>

        <Text className="mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-muted">Storage</Text>
        <PantryStorageLocationFilterChips selected={locationFilter} onSelect={setLocationFilter} />

        <CategoryChips selected={filter} onSelect={setFilter} />

        {actionError ? <Text className="mb-2 text-xs font-semibold text-danger">{actionError}</Text> : null}

        <PantryLocationSections
          items={pantry}
          categoryFilter={filter}
          locationFilter={locationFilter}
          onPressItem={openEditModal}
        />

        {pantry.length > 0 ? (
          <Card className="mb-6" title="Clear inventory" subtitle="Remove items you no longer track">
            {PANTRY_STORAGE_LOCATIONS.map((location) => {
              const count = locationCounts[location];
              if (count === 0) return null;
              const label = labelForPantryStorageLocation(location);
              return (
                <Pressable
                  key={location}
                  onPress={() => setConfirmAction({ kind: 'clear-location', location, count })}
                  className="mt-2 rounded-xl border border-danger/20 bg-paper px-3 py-3"
                >
                  <Text className="text-center text-sm font-bold text-danger">
                    Clear {label} ({count})
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setConfirmAction({ kind: 'clear-all', count: pantry.length })}
              className="mt-2 rounded-xl border border-danger/40 bg-card px-3 py-3"
            >
              <Text className="text-center text-sm font-bold text-danger">Clear everything ({pantry.length})</Text>
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>

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
