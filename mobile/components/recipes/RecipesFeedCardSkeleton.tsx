import { View } from 'react-native';

interface RecipesFeedCardSkeletonProps {
  count?: number;
}

export function RecipesFeedCardSkeleton({ count = 3 }: RecipesFeedCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={`recipe-skeleton-${index}`}
          className="mb-3 flex-row overflow-hidden rounded-xl border border-border bg-card opacity-80"
          accessibilityLabel="Loading recipe"
        >
          <View className="h-24 w-24 bg-border" />
          <View className="flex-1 px-3 py-3">
            <View className="h-4 rounded bg-border" style={{ width: '70%' }} />
            <View className="mt-3 h-3 rounded bg-border" style={{ width: '90%' }} />
            <View className="mt-2 h-3 rounded bg-border" style={{ width: '45%' }} />
          </View>
        </View>
      ))}
    </>
  );
}
