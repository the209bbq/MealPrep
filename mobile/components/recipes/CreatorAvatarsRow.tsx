import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { CreatorListItem } from '../../lib/creatorVideos/types';
import { CREATOR_RECIPES_COPY } from '../../config/creatorRecipes';

export function CreatorAvatarsRow({
  creators,
  onSelect,
}: {
  creators: readonly CreatorListItem[];
  onSelect: (creator: CreatorListItem) => void;
}) {
  if (creators.length === 0) return null;

  return (
    <View className="mt-3">
      <Text className="mb-2 text-xs font-semibold text-muted" accessibilityRole="header">
        Creators
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="list"
        accessibilityLabel={CREATOR_RECIPES_COPY.creatorRowAccessibility}
        contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      >
        {creators.map((creator) => (
          <Pressable
            key={creator.id}
            onPress={() => onSelect(creator)}
            accessibilityRole="button"
            accessibilityLabel={`${creator.displayName} recipes`}
            className="items-center"
            style={{ width: 72 }}
          >
            {creator.avatarUrl ? (
              <Image
                source={{ uri: creator.avatarUrl }}
                className="h-14 w-14 rounded-full border border-border bg-card"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
                <Text className="text-lg font-bold text-primary">
                  {creator.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="mt-1 text-center text-[11px] font-medium text-ink" numberOfLines={2}>
              {creator.displayName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
