import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MEAL_CALENDAR } from '../../config/mealCalendar';
import { MEAL_SLOTS, type MealSlot, type Recipe } from '../../types/mealprep';
import { buildMealPickerRecipeOptions } from '../../lib/mealCalendar/recipePickerOptions';
import type { PantryMatchIndex } from '../../lib/recipeMatch';

interface AddMealPickerSheetProps {
  visible: boolean;
  isoDate: string;
  defaultSlot: MealSlot;
  recipes: Recipe[];
  pantryMatches: PantryMatchIndex;
  onClose: () => void;
  onPick: (input: {
    recipeId: string;
    recipeSlug: string | null;
    recipeApiId: number | null;
    title: string;
    imageUrl: string | null;
    mealSlot: MealSlot;
    makesLeftovers: boolean;
  }) => void;
}

function resolveRecipeRefs(recipeId: string, recipes: Recipe[]): {
  recipeSlug: string | null;
  recipeApiId: number | null;
  title: string;
  imageUrl: string | null;
} {
  const recipe = recipes.find((row) => row.id === recipeId);
  if (recipeId.startsWith('recipeapi-')) {
    const apiId = Number.parseInt(recipeId.replace(/^recipeapi-(\d+).*/, '$1'), 10);
    return {
      recipeSlug: recipe?.id ?? null,
      recipeApiId: Number.isFinite(apiId) ? apiId : null,
      title: recipe?.name ?? 'Recipe',
      imageUrl: null,
    };
  }
  return {
    recipeSlug: recipeId,
    recipeApiId: null,
    title: recipe?.name ?? recipeId,
    imageUrl: null,
  };
}

export function AddMealPickerSheet({
  visible,
  isoDate,
  defaultSlot,
  recipes,
  pantryMatches,
  onClose,
  onPick,
}: AddMealPickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {visible ? (
        <AddMealPickerSheetForm
          key={`${isoDate}-${defaultSlot}`}
          isoDate={isoDate}
          defaultSlot={defaultSlot}
          recipes={recipes}
          pantryMatches={pantryMatches}
          onClose={onClose}
          onPick={onPick}
        />
      ) : null}
    </Modal>
  );
}

function AddMealPickerSheetForm({
  isoDate,
  defaultSlot,
  recipes,
  pantryMatches,
  onClose,
  onPick,
}: Omit<AddMealPickerSheetProps, 'visible'>) {
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [makesLeftovers, setMakesLeftovers] = useState(false);

  const options = useMemo(
    () =>
      buildMealPickerRecipeOptions(
        recipes,
        pantryMatches.ranked,
        MEAL_CALENDAR.picker.maxRecipes,
      ),
    [pantryMatches.ranked, recipes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((row) => row.title.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="max-h-[80%] rounded-t-3xl bg-card px-4 pb-8 pt-4" onPress={() => undefined}>
          <Text className="text-lg font-bold text-ink">Add meal</Text>
          <Text className="mt-1 text-sm text-muted">{isoDate}</Text>

          <View className="mt-3 flex-row gap-2">
            {MEAL_SLOTS.map((value) => (
              <Pressable
                key={value}
                onPress={() => setSlot(value)}
                className={`rounded-full px-3 py-1.5 ${slot === value ? 'bg-primary' : 'bg-primary-light'}`}
              >
                <Text className={`text-xs font-bold ${slot === value ? 'text-onPrimary' : 'text-primary-dark'}`}>
                  {MEAL_CALENDAR.slotLabels[value]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => setMakesLeftovers((prev) => !prev)}
            className="mt-3 flex-row items-center justify-between rounded-xl border border-border px-3 py-2"
          >
            <Text className="text-sm font-semibold text-ink">{MEAL_CALENDAR.makesLeftoversLabel}</Text>
            <Text className="text-xs font-bold text-primary-dark">{makesLeftovers ? 'On' : 'Off'}</Text>
          </Pressable>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes"
            className="mt-3 rounded-xl border border-border bg-paper px-3 py-2 text-ink"
          />

          <ScrollView className="mt-3 max-h-80">
            {filtered.map((row) => (
              <Pressable
                key={row.recipeId}
                onPress={() => {
                  const refs = resolveRecipeRefs(row.recipeId, recipes);
                  onPick({ ...refs, recipeId: row.recipeId, mealSlot: slot, makesLeftovers });
                  onClose();
                }}
                className="border-t border-border py-3"
              >
                <Text className="font-semibold text-ink">{row.title}</Text>
                {row.pantryPercent > 0 ? (
                  <Text className="mt-0.5 text-xs text-muted">
                    Pantry match {row.pantryPercent}% ({row.matchedCount} items)
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-xs text-muted">Saved recipe</Text>
                )}
              </Pressable>
            ))}
            {filtered.length === 0 ? (
              <Text className="py-6 text-center text-sm text-muted">No recipes match that search.</Text>
            ) : null}
          </ScrollView>

          <Pressable onPress={onClose} className="mt-4 items-center rounded-xl border border-border py-3">
            <Text className="font-bold text-muted">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
  );
}
