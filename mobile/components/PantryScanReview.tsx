import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CATEGORY_LABELS, PHOTO_SCAN } from '../config/appConfig';
import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  PANTRY_SCAN_TIP,
  suggestStorageLocationForCategory,
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
  saving: boolean;
  modelLabel?: string;
  saveError?: string | null;
}

export function PantryScanReview({
  items,
  onChange,
  onSave,
  onCancel,
  saving,
  modelLabel,
  saveError,
}: PantryScanReviewProps) {
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [batchLocation, setBatchLocation] = useState<PantryStorageLocation>(DEFAULT_PANTRY_STORAGE_LOCATION);

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);
  const showFewItemsTip = items.length > 0 && items.length <= PANTRY_SCAN_TIP.fewItemsThreshold;

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

  function applyMerge() {
    if (mergeSelection.length < 2) return;
    onChange(mergeReviewItems(items, mergeSelection));
    setMergeSelection([]);
  }

  return (
    <View className="mt-3 rounded-xl border border-border bg-card p-3">
      <Text className="text-base font-bold text-ink">Review detected items</Text>
      <Text className="mt-1 text-xs text-muted">
        Edit names and quantities, turn off items you do not want, or merge duplicates before saving.
        {modelLabel ? ` Model: ${modelLabel}.` : ''}
      </Text>

      {showFewItemsTip ? <PantryScanTip className="mt-2" /> : null}

      <View className="mt-3 rounded-lg border border-border bg-paper p-2">
        <PantryStorageLocationChips
          label="Storage for all items"
          selected={batchLocation}
          onSelect={setBatchLocationForAll}
        />
        <Text className="mt-1 text-[10px] text-muted">Override storage per item below.</Text>
      </View>

      {items.map((item) => (
        <View key={item.key} className="mt-3 border-t border-border pt-3">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => updateItem(item.key, { enabled: !item.enabled })} className="flex-row items-center gap-2">
              <View
                className={`h-5 w-5 rounded border ${item.enabled ? 'border-emerald bg-emerald' : 'border-muted bg-paper'}`}
              />
              <Text className="text-sm font-semibold text-ink">{item.enabled ? 'Include' : 'Skip'}</Text>
            </Pressable>
            <Pressable onPress={() => toggleMerge(item.key)}>
              <Text className={`text-xs ${mergeSelection.includes(item.key) ? 'font-bold text-emerald' : 'text-muted'}`}>
                {mergeSelection.includes(item.key) ? 'Selected to merge' : 'Select to merge'}
              </Text>
            </Pressable>
          </View>

          {item.isDemoSample ? (
            <Text className="mt-1 text-xs font-semibold text-danger">Demo sample detection (not from your photo)</Text>
          ) : null}

          <TextInput
            value={item.name}
            onChangeText={(name) => updateItem(item.key, { name })}
            className="mt-2 rounded-lg border border-border bg-paper px-3 py-2 text-sm text-ink"
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
              className="w-20 rounded-lg border border-border bg-paper px-3 py-2 text-sm text-ink"
            />
            <TextInput
              value={item.unit}
              onChangeText={(unit) => updateItem(item.key, { unit })}
              className="flex-1 rounded-lg border border-border bg-paper px-3 py-2 text-sm text-ink"
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
                    location: suggestStorageLocationForCategory(category),
                  })
                }
                className={`rounded-full px-2 py-1 ${item.category === category ? 'bg-emerald-light' : 'bg-paper'}`}
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

          <Text className="mt-1 text-[10px] text-muted">
            Confidence {(item.confidence * 100).toFixed(0)}% · matched id {item.ingredientId}
          </Text>
        </View>
      ))}

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          disabled={mergeSelection.length < 2}
          onPress={applyMerge}
          className={`rounded-xl border px-3 py-2 ${mergeSelection.length < 2 ? 'border-border opacity-50' : 'border-emerald'}`}
        >
          <Text className="text-xs font-bold text-slate">Merge selected ({mergeSelection.length})</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row gap-2">
        <Pressable onPress={onCancel} className="flex-1 rounded-xl border border-border px-3 py-3">
          <Text className="text-center text-sm font-bold text-slate">Cancel</Text>
        </Pressable>
        <Pressable
          disabled={saving || enabledCount === 0}
          onPress={onSave}
          className={`flex-1 rounded-xl px-3 py-3 ${saving || enabledCount === 0 ? 'bg-slate/40' : 'bg-emerald'}`}
        >
          <Text className="text-center text-sm font-bold text-on-emerald">
            {saving ? 'Saving…' : `Save ${enabledCount} item${enabledCount === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      </View>

      {!PHOTO_SCAN.enabled ? (
        <Text className="mt-2 text-xs text-muted">Photo scan is disabled in feature flags.</Text>
      ) : null}

      {saveError ? (
        <Text className="mt-2 text-xs font-semibold text-danger">{saveError}</Text>
      ) : null}
    </View>
  );
}
