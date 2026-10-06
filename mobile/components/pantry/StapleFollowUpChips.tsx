import { Pressable, Text, TextInput, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { PANTRY_STAPLES_COPY } from '../../config/pantryStaples';
import { addDaysToIsoDate, todayIsoDate } from '../../lib/pantry/expiry';
import {
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
  const hasSizes = (staple.sizeOptions?.length ?? 0) > 0;
  const showExpiry = Boolean(staple.perishable);

  if (!hasSizes && !showExpiry) return null;

  return (
    <View className="mt-2 rounded-xl border border-border bg-paper px-2 py-2">
      {hasSizes ? (
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
      ) : null}

      {showExpiry ? (
        <View className={`flex-row flex-wrap gap-2 ${hasSizes ? 'mt-2' : ''}`}>
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
