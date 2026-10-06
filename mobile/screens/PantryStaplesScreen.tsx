import { Ionicons } from '../lib/icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StapleFollowUpChips } from '../components/pantry/StapleFollowUpChips';
import { THEME } from '../config/appConfig';
import { PANTRY_STAPLES_COPY, writePantryStaplesPromptDismissed } from '../config/pantryStaples';
import { useApp } from '../context/AppContext';
import {
  defaultStapleSelection,
  getStapleById,
  staplesBySection,
  type StapleSelectionState,
} from '../lib/pantry/stapleCatalog';

export default function PantryStaplesScreen() {
  const insets = useSafeAreaInsets();
  const { addPantryStaples } = useApp();
  const [selections, setSelections] = useState<Map<string, StapleSelectionState>>(() => new Map());
  const [expandedFollowUpId, setExpandedFollowUpId] = useState<string | null>(null);
  const [dateInputOpenId, setDateInputOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCount = selections.size;

  const sections = useMemo(() => staplesBySection(), []);

  const toggleStaple = useCallback((stapleId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(stapleId)) {
        next.delete(stapleId);
        setExpandedFollowUpId((id) => (id === stapleId ? null : id));
        setDateInputOpenId((id) => (id === stapleId ? null : id));
        return next;
      }
      const staple = getStapleById(stapleId);
      if (!staple) return prev;
      next.set(stapleId, defaultStapleSelection(staple));
      setExpandedFollowUpId(stapleId);
      return next;
    });
  }, []);

  const updateSelection = useCallback((stapleId: string, patch: StapleSelectionState) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(stapleId, patch);
      return next;
    });
  }, []);

  const handleSkip = useCallback(() => {
    writePantryStaplesPromptDismissed(true);
    router.back();
  }, []);

  const handleDone = useCallback(async () => {
    if (selectedCount === 0) {
      handleSkip();
      return;
    }
    setSaving(true);
    try {
      await addPantryStaples([...selections.values()]);
      writePantryStaplesPromptDismissed(true);
      router.back();
    } finally {
      setSaving(false);
    }
  }, [addPantryStaples, handleSkip, selectedCount, selections]);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable onPress={handleSkip} className="mr-2 rounded-full p-2" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={THEME.ink} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-ink">{PANTRY_STAPLES_COPY.screenTitle}</Text>
        <Pressable
          disabled={saving}
          onPress={() => void handleDone()}
          className={`rounded-full px-4 py-2 ${saving ? 'opacity-50' : 'bg-primary'}`}
        >
          <Text className="text-sm font-bold text-on-primary">
            {PANTRY_STAPLES_COPY.done}
            {selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-3" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {sections.map((section) => (
          <View key={section.section} className="mt-4">
            <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted">{section.label}</Text>
            <View className="flex-row flex-wrap">
              {section.items.map((staple) => {
                const selected = selections.has(staple.id);
                const selection = selections.get(staple.id);
                const showFollowUp = selected && expandedFollowUpId === staple.id && selection;
                return (
                  <View key={staple.id} className="mb-2 w-1/3 px-1">
                    <Pressable
                      onPress={() => toggleStaple(staple.id)}
                      className={`items-center rounded-2xl border px-1 py-3 ${
                        selected ? 'border-primary bg-primary-light' : 'border-border bg-card'
                      }`}
                    >
                      <Text className="text-2xl">{staple.emoji}</Text>
                      <Text
                        className={`mt-1 text-center text-xs font-semibold ${selected ? 'text-primary-dark' : 'text-ink'}`}
                        numberOfLines={2}
                      >
                        {staple.name}
                      </Text>
                      {selected ? (
                        <View className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5">
                          <Ionicons name="checkmark" size={12} color={THEME.onPrimary} />
                        </View>
                      ) : null}
                    </Pressable>
                    {showFollowUp ? (
                      <StapleFollowUpChips
                        staple={staple}
                        selection={selection}
                        onChange={(next) => updateSelection(staple.id, next)}
                        showDateInput={dateInputOpenId === staple.id}
                        onToggleDateInput={(open) => setDateInputOpenId(open ? staple.id : null)}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
