import { Pressable, Text, View } from 'react-native';
import { STORES_TAB_COPY } from '../../config/storesTab';
import type { StoreLocation } from '../../lib/deals/types';
import { formatDistanceMiles } from '../../lib/stores/storeDistance';

type Props = {
  stores: StoreLocation[];
  onSelectStore: (store: StoreLocation) => void;
};

export function StoresNearbyList({ stores, onSelectStore }: Props) {
  if (stores.length === 0) {
    return <Text className="mt-4 text-sm text-muted">{STORES_TAB_COPY.emptySearch}</Text>;
  }

  return (
    <View className="mt-2">
      {stores.map((store) => {
        const town = [store.city, store.state].filter(Boolean).join(', ');
        return (
          <Pressable
            key={store.id}
            onPress={() => onSelectStore(store)}
            className="mb-2 rounded-2xl border border-border bg-card px-4 py-3 active:opacity-90"
          >
            <Text className="text-base font-semibold text-ink">{store.chain || store.name}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
              {town ? <Text className="text-sm text-muted">{town}</Text> : null}
              {store.distanceMiles != null ? (
                <Text className="text-sm text-muted">{formatDistanceMiles(store.distanceMiles)}</Text>
              ) : null}
              {store.openNow != null ? (
                <Text
                  className={`text-xs font-semibold ${store.openNow ? 'text-success-dark' : 'text-muted'}`}
                >
                  {store.openNow ? STORES_TAB_COPY.openNow : STORES_TAB_COPY.closedNow}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
