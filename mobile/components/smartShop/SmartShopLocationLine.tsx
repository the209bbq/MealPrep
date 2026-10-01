import { Pressable, Text, View } from 'react-native';
import { SMART_SHOP_COPY } from '../../config/smartShop';

type Props = {
  locationSummary: string;
  onChangePress: () => void;
};

export function SmartShopLocationLine({ locationSummary, onChangePress }: Props) {
  return (
    <View className="border-b border-border bg-card px-4 py-2">
      <Pressable onPress={onChangePress} className="flex-row flex-wrap items-center gap-1">
        <Text className="text-xs text-muted">
          {SMART_SHOP_COPY.locationNearPrefix} {locationSummary}
        </Text>
        <Text className="text-xs font-semibold text-emerald-dark">· {SMART_SHOP_COPY.locationChange}</Text>
      </Pressable>
    </View>
  );
}
