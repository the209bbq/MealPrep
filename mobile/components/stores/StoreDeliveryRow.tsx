import { Pressable, Text, View } from 'react-native';
import { STORES_TAB_COPY } from '../../config/storesTab';
import type { StoreLocation } from '../../lib/deals/types';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import {
  isStoreDeliveryServiceAvailable,
  storeDeliveryUrl,
  type StoreDeliveryServiceId,
} from '../../lib/stores/storeLinks';

type Props = {
  store: StoreLocation;
};

const SERVICES: { id: StoreDeliveryServiceId; label: string }[] = [
  { id: 'instacart', label: STORES_TAB_COPY.deliveryInstacart },
  { id: 'doordash', label: STORES_TAB_COPY.deliveryDoordash },
  { id: 'ubereats', label: STORES_TAB_COPY.deliveryUbereats },
];

export function StoreDeliveryRow({ store }: Props) {
  const visible = SERVICES.filter((s) => isStoreDeliveryServiceAvailable(s.id, store));
  if (visible.length === 0) return null;

  return (
    <View className="mt-4">
      <Text className="text-xs font-bold uppercase tracking-wide text-muted">{STORES_TAB_COPY.detailGetDelivered}</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {visible.map((service) => (
          <Pressable
            key={service.id}
            onPress={() => void openExternalUrl(storeDeliveryUrl(service.id, store))}
            className="min-h-[44px] flex-row items-center justify-center rounded-full border border-primary bg-card px-4 active:opacity-80"
          >
            <Text className="text-sm font-bold text-primary">{service.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
