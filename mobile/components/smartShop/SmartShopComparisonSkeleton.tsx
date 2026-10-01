import { Text, View } from 'react-native';
import { SMART_SHOP_COPY } from '../../config/smartShop';

export function SmartShopComparisonSkeleton() {
  return (
    <View className="mt-4">
      <Text className="mb-3 text-center text-sm text-muted">{SMART_SHOP_COPY.loadingComparison}</Text>
      {[0, 1, 2].map((i) => (
        <View key={i} className="mb-3 rounded-xl border border-border bg-card px-4 py-4 opacity-70">
          <View className="h-4 rounded bg-border" style={{ width: '45%' }} />
          <View className="mt-3 h-6 rounded bg-emerald-light" style={{ width: '28%' }} />
          <View className="mt-2 h-3 rounded bg-border" style={{ width: '60%' }} />
        </View>
      ))}
    </View>
  );
}
