import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { ALLERGEN_OPTIONS, DIET_OPTIONS, DIET_PREF_COPY } from '../../config/diet';
import type { UserDietPrefs } from '../../lib/diet/types';

type DietAllergiesSectionProps = {
  value: UserDietPrefs;
  onChange: (next: UserDietPrefs) => void;
  compact?: boolean;
};

function toggleInList<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function DietAllergiesSection({ value, onChange, compact }: DietAllergiesSectionProps) {
  const [dislikeDraft, setDislikeDraft] = useState('');

  function addDislike() {
    const trimmed = dislikeDraft.trim();
    if (!trimmed) return;
    if (value.dislikes.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      setDislikeDraft('');
      return;
    }
    onChange({ ...value, dislikes: [...value.dislikes, trimmed] });
    setDislikeDraft('');
  }

  const chipClass = (active: boolean) =>
    `mr-2 mb-2 rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'border border-border bg-paper'}`;
  const chipTextClass = (active: boolean) =>
    `text-xs font-semibold ${active ? 'text-on-primary' : 'text-muted'}`;

  return (
    <View className={compact ? 'mt-4' : 'mt-2'}>
      <Text className="text-sm font-bold text-ink">{DIET_PREF_COPY.sectionTitle}</Text>
      <Text className="mt-1 text-xs text-muted">{DIET_PREF_COPY.sectionBlurb}</Text>

      <Text className="mt-3 text-xs font-semibold text-muted">{DIET_PREF_COPY.dietsLabel}</Text>
      <View className="mt-2 flex-row flex-wrap">
        {DIET_OPTIONS.map((option) => {
          const active = value.diets.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange({ ...value, diets: toggleInList(value.diets, option.id) })}
              className={chipClass(active)}
            >
              <Text className={chipTextClass(active)}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-3 text-xs font-semibold text-muted">{DIET_PREF_COPY.allergensLabel}</Text>
      <View className="mt-2 flex-row flex-wrap">
        {ALLERGEN_OPTIONS.map((option) => {
          const active = value.allergens.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() =>
                onChange({ ...value, allergens: toggleInList(value.allergens, option.id) })
              }
              className={chipClass(active)}
            >
              <Text className={chipTextClass(active)}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-3 text-xs font-semibold text-muted">{DIET_PREF_COPY.dislikesLabel}</Text>
      <View className="mt-2 flex-row flex-wrap">
        {value.dislikes.map((dislike) => (
          <Pressable
            key={dislike}
            onPress={() =>
              onChange({ ...value, dislikes: value.dislikes.filter((d) => d !== dislike) })
            }
            className="mb-2 mr-2 flex-row items-center rounded-full border border-border bg-card px-3 py-1.5"
          >
            <Text className="text-xs font-semibold text-ink">{dislike}</Text>
            <Text className="ml-1 text-xs text-muted">×</Text>
          </Pressable>
        ))}
      </View>
      <View className="mt-1 flex-row gap-2">
        <TextInput
          value={dislikeDraft}
          onChangeText={setDislikeDraft}
          placeholder={DIET_PREF_COPY.dislikesPlaceholder}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
          onSubmitEditing={() => addDislike()}
          returnKeyType="done"
        />
        <Pressable onPress={() => addDislike()} className="rounded-xl bg-paper px-3 py-2 border border-border">
          <Text className="text-sm font-bold text-primary">{DIET_PREF_COPY.dislikesAdd}</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink">{DIET_PREF_COPY.hideConflictsLabel}</Text>
          <Text className="text-xs text-muted">{DIET_PREF_COPY.hideConflictsHint}</Text>
        </View>
        <Switch
          value={value.hideConflicts}
          onValueChange={(hideConflicts) => onChange({ ...value, hideConflicts })}
          trackColor={{ true: THEME.primary, false: THEME.border }}
        />
      </View>
    </View>
  );
}
