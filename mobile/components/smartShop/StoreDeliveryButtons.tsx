import { Pressable, Text, View } from 'react-native';
import type { DeliveryServiceId } from '../../config/smartShopChains';
import { DELIVERY_URL_TEMPLATES } from '../../config/smartShopDelivery';
import type { StoreLocation } from '../../lib/deals/types';
import {
  doordashStoreUrl,
  instacartStoreUrl,
  isDeliveryServiceAvailable,
} from '../../lib/smartShop/deliveryLinks';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';

type Props = {
  store: StoreLocation;
};

export function StoreDeliveryButtons({ store }: Props) {
  const showInstacart = isDeliveryServiceAvailable('instacart', store);
  const showDoordash = isDeliveryServiceAvailable('doordash', store);
  if (!showInstacart && !showDoordash) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {showInstacart ? (
        <DeliveryChip
          label={DELIVERY_URL_TEMPLATES.instacart.label}
          onPress={() => void openExternalUrl(instacartStoreUrl(store))}
        />
      ) : null}
      {showDoordash ? (
        <DeliveryChip
          label={DELIVERY_URL_TEMPLATES.doordash.label}
          onPress={() => void openExternalUrl(doordashStoreUrl(store))}
        />
      ) : null}
    </View>
  );
}

function DeliveryChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-lg border border-border bg-paper px-2 py-1">
      <Text className="text-xs font-semibold text-success-dark">{label}</Text>
    </Pressable>
  );
}

export function OrderListDeliveryButtons({
  onOrder,
}: {
  onOrder: (service: DeliveryServiceId) => void;
}) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      <DeliveryChip label="Order this list on Instacart" onPress={() => onOrder('instacart')} />
      <DeliveryChip label="Order this list on DoorDash" onPress={() => onOrder('doordash')} />
    </View>
  );
}
