import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CATEGORY_LABELS, PHOTO_SCAN } from '../config/appConfig';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  PANTRY_SCAN_TIP,
  suggestStorageLocationForPantryItem,
  type PantryStorageLocation,
} from '../config/pantryStorage';
import { mergeReviewItems } from '../lib/pantryVision/matchIngredients';
import { applyBatchStorageLocation } from '../lib/pantryVision/reviewItems';
import type { PantryScanReviewItem } from '../lib/pantryVision/types';
import { PANTRY_CATEGORIES, type PantryCategory } from '../types/mealprep';
import { PantryScanTip } from './PantryScanTip';
import { PantryStorageLocationChips } from './PantryStorageLocationChips';

interface PantryScanReviewProps {
  items: PantryScanReviewItem[];
  onChange: (items: PantryScanReviewItem[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onScanAgain?: () => void;
  scanAgainBusy?: boolean;
  saving: boolean;
  modelLabel?: string;
  saveError?: string | null;
  defaultBatchLocation?: PantryStorageLocation;
  /** When true, omits bottom action row (parent renders sticky footer). */
  stickyFooter?: boolean;
}

export function PantryScanReview({
  items,
  onChange,
  onSave,
  onCancel,
  onScanAgain,
  scanAgainBusy = false,
  saving,
  modelLabel,
  saveError,
  defaultBatchLocation = DEFAULT_PANTRY_STORAGE_LOCATION,
  stickyFooter = false,
}: PantryScanReviewProps) {
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [batchLocation, setBatchLocation] = useState<PantryStorageLocation>(defaultBatchLocation);

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);
  const showFewItemsTip = items.length > 0 && items.length <= PANTRY_SCAN_TIP.fewItemsThreshold;

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  function updateItem(key: string, patch: Partial<PantryScanReviewItem>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function setBatchLocationForAll(location: PantryStorageLocation) {
    setBatchLocation(location);
    onChange(applyBatchStorageLocation(items, location));
  }

  function toggleMerge(key: string) {
    setMergeSelection((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyMerge() {
    if (mergeSelection.length < 2) return;
    onChange(mergeReviewItems(items, mergeSelection));
    setMergeSelection([]);
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
          {saving ? 'Saving…' : `Save ${enabledCount} item${enabledCount === 1 ? '' : 's'}`}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View className="mt-3 rounded-xl border border-border bg-card p-3">
      <Text className="text-base font-bold text-ink">Review scan</Text>
      <Text className="mt-1 text-xs text-muted">
        All items are included by default. Expand a row only if you need to edit.
        {modelLabel ? ` Model: ${modelLabel}.` : ''}
      </Text>

      {showFewItemsTip ? <PantryScanTip className="mt-2" /> : null}

      <View className="mt-3 rounded-lg border border-border bg-paper p-2">
        <PantryStorageLocationChips
          label="Storage for all"
          selected={batchLocation}
          onSelect={setBatchLocationForAll}
        />
      </View>

      {items.map((item) => {
        const expanded = expandedKeys.has(item.key);
        return (
          <View key={item.key} className="mt-2 rounded-lg border border-border bg-paper px-3 py-2">
            <View className="flex-row items-center justify-between gap-2">
              <Pressable
                onPress={() => updateItem(item.key, { enabled: !item.enabled })}
                className="flex-row items-center gap-2"
              >
                <View
                  className={`h-5 w-5 rounded border ${item.enabled ? 'border-primary bg-primary' : 'border-muted bg-card'}`}
                />
              </Pressable>
              <Pressable onPress={() => toggleExpanded(item.key)} className="flex-1">
                <View className="flex-row flex-wrap items-center gap-1">
                  <Text
                    className={`font-semibold text-ink ${item.enabled ? '' : 'text-muted line-through'}`}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.needsReview ? (
                    <Text className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                      Check this
                    </Text>
                  ) : null}
                </View>
                <Text className="text-[10px] text-muted">
                  {item.quantity} {item.unit} · {CATEGORY_LABELS[item.category]}
                </Text>
              </Pressable>
              <Pressable onPress={() => toggleExpanded(item.key)}>
                <Text className="text-xs font-bold text-primary-dark">{expanded ? 'Less' : 'Edit'}</Text>
              </Pressable>
            </View>

            {expanded ? (
              <View className="mt-2 border-t border-border pt-2">
                {item.isDemoSample ? (
                  <Text className="text-xs font-semibold text-danger">Demo sample (not from your photo)</Text>
                ) : null}
                <Pressable onPress={() => toggleMerge(item.key)} className="mt-1">
                  <Text className={`text-xs ${mergeSelection.includes(item.key) ? 'font-bold text-primary' : 'text-muted'}`}>
                    {mergeSelection.includes(item.key) ? 'Selected to merge' : 'Select to merge duplicates'}
                  </Text>
                </Pressable>
                <TextInput
                  value={item.name}
                  onChangeText={(name) => updateItem(item.key, { name })}
                  className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
                  placeholder="Item name"
                />
                <View className="mt-2 flex-row gap-2">
                  <TextInput
                    value={String(item.quantity)}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => {
                      const quantity = Number(text);
                      updateItem(item.key, { quantity: Number.isFinite(quantity) ? quantity : 0 });
                    }}
                    className="w-20 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
                  />
                  <TextInput
                    value={item.unit}
                    onChangeText={(unit) => updateItem(item.key, { unit })}
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
                    placeholder="Unit"
                  />
                </View>
                <View className="mt-2 flex-row flex-wrap gap-1">
                  {PANTRY_CATEGORIES.map((category) => (
                    <Pressable
                      key={category}
                      onPress={() =>
                        updateItem(item.key, {
                          category: category as PantryCategory,
                          location: suggestStorageLocationForPantryItem(item.name, category as PantryCategory),
                        })
                      }
                      className={`rounded-full px-2 py-1 ${item.category === category ? 'bg-primary-light' : 'bg-card'}`}
                    >
                      <Text className="text-[10px] font-semibold text-slate">{CATEGORY_LABELS[category]}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="mt-2">
                  <PantryStorageLocationChips
                    label="Storage"
                    compact
                    selected={item.location}
                    onSelect={(location) => updateItem(item.key, { location })}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      {mergeSelection.length >= 2 ? (
        <Pressable onPress={applyMerge} className="mt-3 rounded-xl border border-primary px-3 py-2">
          <Text className="text-center text-xs font-bold text-primary-dark">Merge {mergeSelection.length} selected</Text>
        </Pressable>
      ) : null}

      {onScanAgain ? (
        <Pressable
          disabled={scanAgainBusy || saving}
          onPress={onScanAgain}
          className={`mt-3 rounded-xl border border-border px-3 py-2.5 ${scanAgainBusy ? 'opacity-60' : ''}`}
        >
          <Text className="text-center text-xs font-bold text-slate">
            {scanAgainBusy ? 'Scanning again…' : 'Scan again (merge new finds)'}
          </Text>
        </Pressable>
      ) : null}

      {!stickyFooter ? <View className="mt-4">{actionRow}</View> : null}

      {!PHOTO_SCAN.enabled ? (
        <Text className="mt-2 text-xs text-muted">Photo scan is disabled in feature flags.</Text>
      ) : null}

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
            {saving ? 'Saving…' : `Save ${enabledCount} item${enabledCount === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
