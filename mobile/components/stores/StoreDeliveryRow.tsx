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
            className="min-h-[40px] flex-row items-center justify-center rounded-xl border border-border bg-paper px-3 py-2"
          >
            <Text className="text-xs font-semibold text-primary">{service.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
