import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { THEME } from '../config/appConfig';
import { PANTRY_SCAN_UI_COPY } from '../config/pantryScan';
import { SCAN_CORRECTIONS_UI } from '../config/scanCorrections';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  PANTRY_SCAN_TIP,
  type PantryStorageLocation,
} from '../config/pantryStorage';
import { buildIngredientCatalog } from '../lib/pantryVision/matchIngredients';
import { applyBatchStorageLocation, createManualPantryReviewItem } from '../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem } from '../lib/pantryVision/types';
import type { PantryItem, Recipe } from '../types/mealprep';
import { PantryScanTip } from './PantryScanTip';
import { PantryStorageLocationChips } from './PantryStorageLocationChips';

interface PantryScanReviewProps {
  items: PantryScanReviewItem[];
  onChange: (items: PantryScanReviewItem[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddAnotherPhoto?: () => void;
  addPhotoBusy?: boolean;
  saving: boolean;
  modelLabel?: string;
  saveError?: string | null;
  defaultBatchLocation?: PantryStorageLocation;
  onBatchLocationChange?: (location: PantryStorageLocation) => void;
  /** When true, omits bottom action row (parent renders sticky footer). */
  stickyFooter?: boolean;
  pantry: PantryItem[];
  recipes: Recipe[];
  scanLocationHint: PantryStorageLocation;
  shareTrainingPhoto: boolean;
  onShareTrainingPhotoChange: (value: boolean) => void;
}

export function PantryScanReview({
  items,
  onChange,
  onSave,
  onCancel,
  onAddAnotherPhoto,
  addPhotoBusy = false,
  saving,
  modelLabel,
  saveError,
  defaultBatchLocation = DEFAULT_PANTRY_STORAGE_LOCATION,
  onBatchLocationChange,
  stickyFooter = false,
  pantry,
  recipes,
  scanLocationHint,
  shareTrainingPhoto,
  onShareTrainingPhotoChange,
}: PantryScanReviewProps) {
  const [batchLocation, setBatchLocation] = useState<PantryStorageLocation>(defaultBatchLocation);
  const [missedOpen, setMissedOpen] = useState(false);
  const [missedName, setMissedName] = useState('');

  const catalogNames = useMemo(
    () => buildIngredientCatalog(pantry, recipes).map((entry) => entry.name),
    [pantry, recipes],
  );

  const missedSuggestions = useMemo(() => {
    const query = missedName.trim().toLowerCase();
    if (query.length < 2) return [];
    return catalogNames
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [catalogNames, missedName]);

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);
  const showFewItemsTip = items.length > 0 && items.length <= PANTRY_SCAN_TIP.fewItemsThreshold;

  function updateItem(key: string, patch: Partial<PantryScanReviewItem>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function setBatchLocationForAll(location: PantryStorageLocation) {
    setBatchLocation(location);
    onBatchLocationChange?.(location);
    onChange(applyBatchStorageLocation(items, location));
  }

  function addMissedItem(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const photoUri = items[0]?.photoUri ?? null;
    const row = createManualPantryReviewItem(trimmed, pantry, recipes, photoUri, scanLocationHint);
    onChange([...items, row]);
    setMissedName('');
    setMissedOpen(false);
  }

  const actionRow = (
    <View className="flex-row gap-2">
      <Pressable onPress={onCancel} className="flex-1 rounded-xl border border-border px-3 py-3">
        <Text className="text-center text-sm font-bold text-slate">Cancel</Text>
      </Pressable>
      <Pressable
        disabled={saving || enabledCount === 0}
        onPress={onSave}
        className={`flex-1 rounded-xl px-3 py-3 ${saving || enabledCount === 0 ? 'bg-slate/40' : 'bg-primary'}`}
      >
        <Text className="text-center text-sm font-bold text-on-primary">
          {saving ? 'Saving…' : PANTRY_SCAN_UI_COPY.addItems(enabledCount)}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View className="mt-3 rounded-xl border border-border bg-card p-3">
      <Text className="text-base font-bold text-ink">Review scan</Text>
      <Text className="mt-1 text-xs text-muted">
        Uncheck anything you do not want. Tap a name to fix it.
        {modelLabel ? ` Model: ${modelLabel}.` : ''}
      </Text>

      {showFewItemsTip ? <PantryScanTip className="mt-2" /> : null}

      <View className="mt-2 rounded-lg border border-border bg-paper p-2">
        <PantryStorageLocationChips
          label="Storage for all"
          compact
          selected={batchLocation}
          onSelect={setBatchLocationForAll}
        />
      </View>

      {items.map((item) => (
        <View key={item.key} className="mt-2 flex-row items-center gap-2 rounded-lg border border-border bg-paper px-2 py-1.5">
          <Pressable
            onPress={() => updateItem(item.key, { enabled: !item.enabled })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.enabled }}
            className={`h-5 w-5 shrink-0 rounded border ${item.enabled ? 'border-primary bg-primary' : 'border-muted bg-card'}`}
          />
          <TextInput
            value={item.name}
            onChangeText={(name) => updateItem(item.key, { name })}
            editable={item.enabled}
            className={`min-w-0 flex-1 px-1 py-1 text-sm font-semibold text-ink ${item.enabled ? '' : 'text-muted line-through'}`}
            placeholder="Item name"
          />
          {item.quantity > 0 ? (
            <Text className="shrink-0 text-[10px] text-muted">
              {item.quantity} {item.unit}
            </Text>
          ) : null}
          {item.needsReview ? (
            <Text className="shrink-0 text-[9px] font-bold text-amber-800">?</Text>
          ) : null}
        </View>
      ))}

      <View className="mt-2">
        <Pressable onPress={() => setMissedOpen((open) => !open)} className="self-start py-1">
          <Text className="text-xs font-bold text-primary-dark">{SCAN_CORRECTIONS_UI.missedAnythingLabel}</Text>
        </Pressable>
        {missedOpen ? (
          <View className="mt-1 rounded-lg border border-border bg-paper p-2">
            <TextInput
              value={missedName}
              onChangeText={setMissedName}
              placeholder={SCAN_CORRECTIONS_UI.addMissedPlaceholder}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
              onSubmitEditing={() => addMissedItem(missedName)}
              returnKeyType="done"
            />
            {missedSuggestions.length > 0 ? (
              <View className="mt-1 flex-row flex-wrap gap-1">
                {missedSuggestions.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => addMissedItem(name)}
                    className="rounded-full border border-border bg-card px-2 py-0.5"
                  >
                    <Text className="text-[10px] font-semibold text-slate">{name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable
              disabled={!missedName.trim()}
              onPress={() => addMissedItem(missedName)}
              className={`mt-2 self-start rounded-lg px-3 py-1.5 ${missedName.trim() ? 'bg-primary' : 'bg-slate/30'}`}
            >
              <Text className="text-[11px] font-bold text-on-primary">{SCAN_CORRECTIONS_UI.addMissedButton}</Text>
            </Pressable>
            <View className="mt-2 flex-row items-center justify-between gap-2 border-t border-border pt-2">
              <Text className="flex-1 text-[10px] text-muted">{SCAN_CORRECTIONS_UI.sharePhotoToggleLabel}</Text>
              <Switch
                value={shareTrainingPhoto}
                onValueChange={onShareTrainingPhotoChange}
                trackColor={{ true: THEME.primary, false: THEME.border }}
              />
            </View>
          </View>
        ) : null}
      </View>

      {onAddAnotherPhoto ? (
        <Pressable
          disabled={addPhotoBusy || saving}
          onPress={onAddAnotherPhoto}
          className={`mt-3 rounded-xl border border-border px-3 py-2.5 ${addPhotoBusy ? 'opacity-60' : ''}`}
        >
          <Text className="text-center text-xs font-bold text-slate">
            {addPhotoBusy ? PANTRY_SCAN_UI_COPY.addAnotherPhotoBusy : PANTRY_SCAN_UI_COPY.addAnotherPhoto}
          </Text>
        </Pressable>
      ) : null}

      {!stickyFooter ? <View className="mt-4">{actionRow}</View> : null}

      {saveError ? <Text className="mt-2 text-xs font-semibold text-danger">{saveError}</Text> : null}
    </View>
  );
}

export function PantryScanReviewStickyFooter(props: {
  saving: boolean;
  enabledCount: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { saving, enabledCount, onSave, onCancel } = props;
  return (
    <View className="border-t border-border bg-card px-4 py-3">
      <View className="flex-row gap-2">
        <Pressable onPress={onCancel} className="flex-1 rounded-xl border border-border py-3">
          <Text className="text-center text-sm font-bold text-slate">Cancel</Text>
        </Pressable>
        <Pressable
          disabled={saving || enabledCount === 0}
          onPress={onSave}
          className={`flex-[2] rounded-xl py-3 ${saving || enabledCount === 0 ? 'bg-slate/40' : 'bg-primary'}`}
        >
          <Text className="text-center text-sm font-bold text-on-primary">
            {saving ? 'Saving…' : PANTRY_SCAN_UI_COPY.addItems(enabledCount)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
