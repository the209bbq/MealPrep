import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { CREATOR_RECIPES_COPY } from '../../config/creatorRecipes';
import { sizedCreatorAvatarUrl } from '../../lib/images/sizedCreatorAvatarUrl';
import type { CreatorRotationSlot } from '../../lib/recipesTab/creatorRotation';
import { HalfVisibleOnce } from './HalfVisibleOnce';

export function CreatorAvatarsRow({
  slots,
  onSelect,
  onImpression,
}: {
  slots: readonly CreatorRotationSlot[];
  onSelect: (slot: CreatorRotationSlot) => void;
  onImpression: (slot: CreatorRotationSlot) => void;
}) {
  if (slots.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel={CREATOR_RECIPES_COPY.creatorRowAccessibility}
      contentContainerStyle={{ gap: 12, paddingRight: 4 }}
    >
      {slots.map((slot) => (
        <HalfVisibleOnce key={slot.creator.id} onVisible={() => onImpression(slot)}>
          <Pressable
            onPress={() => onSelect(slot)}
            accessibilityRole="button"
            accessibilityLabel={`${slot.creator.displayName} recipes`}
            className="items-center"
            style={{ width: 72 }}
          >
            {slot.creator.avatarUrl ? (
              <Image
                source={{ uri: sizedCreatorAvatarUrl(slot.creator.avatarUrl, 56) ?? slot.creator.avatarUrl }}
                className="h-14 w-14 rounded-full border border-border bg-card"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
                <Text className="text-lg font-bold text-primary">
                  {slot.creator.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="mt-1 text-center text-[11px] font-medium text-ink" numberOfLines={2}>
              {slot.creator.displayName}
            </Text>
          </Pressable>
        </HalfVisibleOnce>
      ))}
    </ScrollView>
  );
}
