import { View } from 'react-native';

interface RecipesFeedCardSkeletonProps {
  count?: number;
}

/** Placeholder cards in the same 2-column grid the Home recipe cards use. */
export function RecipesFeedCardSkeleton({ count = 3 }: RecipesFeedCardSkeletonProps) {
  return (
    <View className="flex-row flex-wrap justify-between">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={`recipe-skeleton-${index}`}
          className="mb-3 overflow-hidden rounded-[18px] border border-border bg-card opacity-80"
          style={{ width: '48.4%' }}
          accessibilityLabel="Loading recipe"
        >
          <View className="bg-border" style={{ height: 108 }} />
          <View className="p-3">
            <View className="h-4 rounded bg-border" style={{ width: '80%' }} />
            <View className="mt-3 h-5 rounded-[10px] bg-border" style={{ width: '60%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}
