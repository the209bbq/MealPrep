import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '../../lib/icons/Ionicons';
import { THEME } from '../../config/appConfig';
import { PANTRY_STAPLES_COPY } from '../../config/pantryStaples';
import { addDaysToIsoDate, todayIsoDate } from '../../lib/pantry/expiry';
import {
  resolveStaplePickerQuantity,
  resolveStapleQuantityUnit,
  resolveStapleVarietyIds,
  stapleHasSizeOptions,
  STAPLE_EXPIRY_QUICK_CHIPS,
  type StapleCatalogEntry,
  type StapleSelectionState,
} from '../../lib/pantry/stapleCatalog';

interface StapleFollowUpChipsProps {
  staple: StapleCatalogEntry;
  selection: StapleSelectionState;
  onChange: (next: StapleSelectionState) => void;
  showDateInput: boolean;
  onToggleDateInput: (open: boolean) => void;
}

function chipClass(selected: boolean): string {
  return selected
    ? 'rounded-full bg-primary px-3 py-1.5'
    : 'rounded-full border border-border bg-card px-3 py-1.5';
}

function chipTextClass(selected: boolean): string {
  return `text-xs font-semibold ${selected ? 'text-on-primary' : 'text-slate'}`;
}

export function StapleFollowUpChips({
  staple,
  selection,
  onChange,
  showDateInput,
  onToggleDateInput,
}: StapleFollowUpChipsProps) {
  const hasSizes = stapleHasSizeOptions(staple);
  const hasVarieties = (staple.varietyOptions?.length ?? 0) > 0;
  const showExpiry = Boolean(staple.perishable);
  const activeVarietyIds = resolveStapleVarietyIds(staple, selection);
  const pickerQty = resolveStaplePickerQuantity(staple, selection);
  const resolvedQty = resolveStapleQuantityUnit(staple, selection);
  const sizeId = selection.sizeOptionId ?? staple.defaultSizeId;
  const activeSizeLabel = staple.sizeOptions?.find((opt) => opt.id === sizeId)?.label;

  const setPickerQuantity = (next: number) => {
    const clamped = Math.max(1, Math.round(next * 100) / 100);
    onChange({ ...selection, quantity: clamped });
  };

  const toggleVariety = (varietyId: string) => {
    const current = resolveStapleVarietyIds(staple, selection);
    const selected = current.includes(varietyId);
    if (selected) {
      const next = current.filter((id) => id !== varietyId);
      if (next.length === 0) return;
      onChange({ ...selection, varietyOptionIds: next });
      return;
    }
    onChange({ ...selection, varietyOptionIds: [...current, varietyId] });
  };

  return (
    <View className="mt-2 rounded-xl border border-border bg-paper px-2 py-2">
      <View>
        <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
          {PANTRY_STAPLES_COPY.quantityHeading}
          {hasSizes && activeSizeLabel ? ` · ${activeSizeLabel}` : ''}
        </Text>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => setPickerQuantity(pickerQty - 1)}
            disabled={pickerQty <= 1}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            className={`rounded-full border border-border bg-card p-1 ${pickerQty <= 1 ? 'opacity-40' : ''}`}
          >
            <Ionicons name="remove" size={18} color={THEME.ink} />
          </Pressable>
          <View className="items-center px-2">
            <Text className="text-base font-bold text-ink">{pickerQty}</Text>
            {!hasSizes ? (
              <Text className="text-[10px] text-muted">{resolvedQty.unit}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => setPickerQuantity(pickerQty + 1)}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            className="rounded-full border border-border bg-card p-1"
          >
            <Ionicons name="add" size={18} color={THEME.ink} />
          </Pressable>
        </View>
      </View>

      {hasVarieties ? (
        <View className="mt-2">
          <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
            {PANTRY_STAPLES_COPY.varietyHeading}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {staple.varietyOptions!.map((opt) => {
              const selected = activeVarietyIds.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggleVariety(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label}${selected ? ', selected' : ''}`}
                  className={chipClass(selected)}
                >
                  <Text className={chipTextClass(selected)}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {hasSizes ? (
        <View className={hasVarieties ? 'mt-2' : ''}>
          <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">Size</Text>
          <View className="flex-row flex-wrap gap-2">
            {staple.sizeOptions!.map((opt) => {
              const selected = (selection.sizeOptionId ?? staple.defaultSizeId) === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => onChange({ ...selection, sizeOptionId: opt.id })}
                  className={chipClass(selected)}
                >
                  <Text className={chipTextClass(selected)}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showExpiry ? (
        <View className={`flex-row flex-wrap gap-2 ${hasSizes || hasVarieties ? 'mt-2' : ''}`}>
          {STAPLE_EXPIRY_QUICK_CHIPS.map((chip) => {
            const target = addDaysToIsoDate(todayIsoDate(), chip.days);
            const selected = selection.expiresOn === target && !selection.expirySkipped;
            return (
              <Pressable
                key={chip.id}
                onPress={() =>
                  onChange({ ...selection, expiresOn: target, expirySkipped: false })
                }
                className={chipClass(selected)}
              >
                <Text className={chipTextClass(selected)}>{chip.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => onToggleDateInput(!showDateInput)}
            className={chipClass(showDateInput)}
          >
            <Text className={chipTextClass(showDateInput)}>{PANTRY_STAPLES_COPY.pickDate}</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange({ ...selection, expiresOn: null, expirySkipped: true })}
            className={chipClass(selection.expirySkipped === true)}
          >
            <Text className={chipTextClass(selection.expirySkipped === true)}>No date</Text>
          </Pressable>
        </View>
      ) : null}

      {showExpiry && showDateInput ? (
        <TextInput
          value={selection.expiresOn ?? ''}
          onChangeText={(text) => onChange({ ...selection, expiresOn: text.trim(), expirySkipped: false })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={THEME.muted}
          autoCapitalize="none"
          className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
        />
      ) : null}
    </View>
  );
}
