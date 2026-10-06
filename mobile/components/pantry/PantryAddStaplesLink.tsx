import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PANTRY_STAPLES_COPY } from '../../config/pantryStaples';
import { stapleLinkPreviewEntries } from '../../lib/pantry/stapleCatalog';

interface PantryAddStaplesLinkProps {
  onPress: () => void;
}

export function PantryAddStaplesLink({ onPress }: PantryAddStaplesLinkProps) {
  const previewStaples = useMemo(() => stapleLinkPreviewEntries(), []);

  const accessibilityLabel = useMemo(() => {
    const sample = previewStaples.slice(0, 3).map((row) => row.name.toLowerCase());
    if (sample.length === 0) return PANTRY_STAPLES_COPY.addStaplesLink;
    return `Add staples like ${sample.join(', ')}`;
  }, [previewStaples]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="mt-2 max-w-full flex-row items-center gap-2 self-start"
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View className="min-h-[44px] shrink-0 items-center justify-center rounded-full bg-primary-light px-4 py-2">
        <Text className="text-sm font-bold text-primary-dark">{PANTRY_STAPLES_COPY.addStaplesLink}</Text>
      </View>
      {previewStaples.length > 0 ? (
        <View className="min-w-0 shrink flex-row items-center overflow-hidden pr-1">
          {previewStaples.map((staple, index) => (
            <View
              key={staple.id}
              className="h-8 w-8 items-center justify-center rounded-full border border-primary/25 bg-card"
              style={{
                marginLeft: index === 0 ? 0 : -8,
                zIndex: previewStaples.length - index,
              }}
            >
              <Text className="text-lg leading-5" accessibilityElementsHidden importantForAccessibility="no">
                {staple.emoji}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
