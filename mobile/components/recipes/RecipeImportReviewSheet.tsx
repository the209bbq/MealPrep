import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECIPE_IMPORT_COPY } from '../../config/recipeImport';
import type { RecipeImportExtractedDto } from '../../lib/recipeImport/types';

interface RecipeImportReviewSheetProps {
  visible: boolean;
  draft: RecipeImportExtractedDto | null;
  onClose: () => void;
  onSave: (recipe: RecipeImportExtractedDto) => Promise<void>;
}

function RecipeImportReviewForm({
  draft,
  onClose,
  onSave,
}: {
  draft: RecipeImportExtractedDto;
  onClose: () => void;
  onSave: (recipe: RecipeImportExtractedDto) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(draft.title);
  const [stepsText, setStepsText] = useState(draft.steps.join('\n'));
  const [ingredientsText, setIngredientsText] = useState(
    draft.ingredients
      .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}${ing.note ? ` (${ing.note})` : ''}`)
      .join('\n'),
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const steps = stepsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const ingredients = ingredientsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^([\d./]+)\s+(\S+)\s+(.+)$/);
          if (!match) {
            return { name: line, quantity: 1, unit: 'each' };
          }
          const quantity = Number.parseFloat(match[1]) || 1;
          return { name: match[3], quantity, unit: match[2] };
        });

      const next: RecipeImportExtractedDto = {
        ...draft,
        title: title.trim() || draft.title,
        steps,
        ingredients: ingredients.length > 0 ? ingredients : draft.ingredients,
      };
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable onPress={onClose} accessibilityLabel="Close import review" className="mr-3 p-1">
          <Text className="text-base font-bold text-primary">{RECIPE_IMPORT_COPY.cancel}</Text>
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-ink">{RECIPE_IMPORT_COPY.reviewTitle}</Text>
      </View>
      <ScrollView className="flex-1 px-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="mt-3 text-sm text-muted">{RECIPE_IMPORT_COPY.reviewSubtitle}</Text>
        <Text className="mt-4 text-xs font-semibold uppercase text-muted">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          className="mt-1 rounded-xl border border-border bg-card px-3 py-2 text-base text-ink"
        />
        <Text className="mt-4 text-xs font-semibold uppercase text-muted">Ingredients (one per line)</Text>
        <TextInput
          value={ingredientsText}
          onChangeText={setIngredientsText}
          multiline
          className="mt-1 min-h-[120px] rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
        />
        <Text className="mt-4 text-xs font-semibold uppercase text-muted">Steps (one per line)</Text>
        <TextInput
          value={stepsText}
          onChangeText={setStepsText}
          multiline
          className="mt-1 min-h-[160px] rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
        />
        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          className="mt-6 items-center rounded-xl bg-primary py-4"
        >
          <Text className="text-base font-bold text-on-primary">
            {saving ? RECIPE_IMPORT_COPY.saving : RECIPE_IMPORT_COPY.saveCta}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function RecipeImportReviewSheet({
  visible,
  draft,
  onClose,
  onSave,
}: RecipeImportReviewSheetProps) {
  if (!draft) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RecipeImportReviewForm
        key={draft.source_url}
        draft={draft}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}
