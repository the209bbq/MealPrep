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
import { PantryStorageScanButtons } from '../../components/PantryStorageScanButtons';
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
  previewResortFromDefaultPantry,
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
  | { kind: 'clear-all'; count: number }
  | { kind: 'resort'; toFridge: number; toSpiceRack: number };

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
  const [locationFilter, setLocationFilter] = useState<PantryStorageLocation | 'all'>('all');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<PantryScanReviewItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
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

  const visionReady = isPantryVisionConfigured();
  const accessToken = session?.access_token ?? null;

  const locationCounts = useMemo(
    () =>
      Object.fromEntries(
        PANTRY_STORAGE_LOCATIONS.map((location) => [location, countPantryItemsInLocation(pantry, location)]),
      ) as Record<PantryStorageLocation, number>,
    [pantry],
  );

  const resortPreview = useMemo(() => previewResortFromDefaultPantry(pantry), [pantry]);

  async function runVisionFromPrepared(
    prepared: PreparedPantryImage,
    scanLocation: PantryStorageLocation,
  ) {
    if (!featureFlags.photoScan) {
      Alert.alert('Feature off', 'Photo scan is disabled in feature toggles.');
      return;
    }

    setScanLocationHint(scanLocation);
    setScanError(null);
    setPhase('loading');
    setPreviewUri(prepared.uri);

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

  async function runVisionFromUri(uri: string, scanLocation: PantryStorageLocation) {
    setScanError(null);
    setPhase('loading');
    setPreviewUri(uri);
    try {
      const prepared = await preparePantryImage(uri);
      await runVisionFromPrepared(prepared, scanLocation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pantry scan failed';
      setScanError(message);
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

  const showSetupHint = !visionReady && !demoMode;
  const scanControlsVisible = phase !== 'review';

  return (
    <>
      <ScrollView className="flex-1 bg-paper px-4 pb-8">
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
              defaultBatchLocation={scanLocationHint}
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
          <Card className="mt-4" title="Storage helper" subtitle="Auto-place items still listed under Pantry">
            <Text className="mt-1 text-sm text-muted">
              Uses the same rules as photo scan: spices to the rack, perishables to the fridge, shelf-stable goods in the pantry.
            </Text>
            {resortPreview.total > 0 ? (
              <Text className="mt-2 text-sm font-semibold text-ink">
                {resortPreview.toFridge > 0
                  ? `${resortPreview.toFridge} → ${labelForPantryStorageLocation('fridge')}`
                  : null}
                {resortPreview.toFridge > 0 && resortPreview.toSpiceRack > 0 ? ' · ' : null}
                {resortPreview.toSpiceRack > 0
                  ? `${resortPreview.toSpiceRack} → ${labelForPantryStorageLocation('spice_rack')}`
                  : null}
              </Text>
            ) : (
              <Text className="mt-2 text-sm text-muted">No default-pantry items need re-sorting.</Text>
            )}
            <Pressable
              disabled={resortPreview.total === 0}
              onPress={() =>
                setConfirmAction({
                  kind: 'resort',
                  toFridge: resortPreview.toFridge,
                  toSpiceRack: resortPreview.toSpiceRack,
                })
              }
              className={`mt-3 rounded-xl px-3 py-3 ${resortPreview.total === 0 ? 'bg-sand' : 'bg-emerald'}`}
            >
              <Text
                className={`text-center text-sm font-bold ${resortPreview.total === 0 ? 'text-muted' : 'text-on-emerald'}`}
              >
                Re-sort items
              </Text>
            </Pressable>
          </Card>
        ) : null}

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
