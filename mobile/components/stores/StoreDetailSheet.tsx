import { Ionicons } from '../../lib/icons/Ionicons';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { STORES_TAB_COPY } from '../../config/storesTab';
import { THEME } from '../../config/appConfig';
import { mapsDirectionsUrl } from '../../config/smartShop';
import type { StoreLocation } from '../../lib/deals/types';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import { resolveStoreOrderUrl, resolveStorePhone } from '../../lib/stores/storeLinks';
import { formatStoreAddress } from '../../lib/stores/formatAddress';

type Props = {
  store: StoreLocation | null;
  onClose: () => void;
};

export function StoreDetailSheet({ store, onClose }: Props) {
  if (!store) return null;

  const phone = resolveStorePhone(store);
  const order = resolveStoreOrderUrl(store);
  const directionsUrl = store.url ?? mapsDirectionsUrl(store);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] rounded-t-3xl border border-border bg-card px-4 pb-8 pt-4">
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-xl font-bold text-ink">{store.chain || store.name}</Text>
              {store.chain && store.name !== store.chain ? (
                <Text className="mt-0.5 text-sm text-muted">{store.name}</Text>
              ) : null}
              <Text className="mt-2 text-sm text-muted">{formatStoreAddress(store)}</Text>
              {store.openNow != null ? (
                <Text
                  className={`mt-2 text-xs font-semibold ${store.openNow ? 'text-success-dark' : 'text-muted'}`}
                >
                  {store.openNow ? STORES_TAB_COPY.openNow : STORES_TAB_COPY.closedNow}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close store details" className="rounded-full p-2">
              <Ionicons name="close" size={24} color={THEME.muted} />
            </Pressable>
          </View>

          {store.pricingTeaser === 'coming_soon' ? (
            <View className="mb-4 rounded-xl border border-border bg-paper px-3 py-2">
              <Text className="text-sm text-muted">{STORES_TAB_COPY.pricesComingSoon}</Text>
            </View>
          ) : null}

          <View className="gap-2">
            <Pressable
              onPress={() => void openExternalUrl(directionsUrl)}
              className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3"
            >
              <Ionicons name="navigate" size={20} color={THEME.onPrimary} />
              <Text className="font-bold text-on-primary">{STORES_TAB_COPY.detailDirections}</Text>
            </Pressable>

            {phone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
                className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-paper px-4 py-3"
              >
                <Ionicons name="call-outline" size={20} color={THEME.primary} />
                <Text className="font-bold text-primary">{STORES_TAB_COPY.detailCall}</Text>
              </Pressable>
            ) : null}

            {order ? (
              <Pressable
                onPress={() => void openExternalUrl(order.url)}
                className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-paper px-4 py-3"
              >
                <Ionicons name="cart-outline" size={20} color={THEME.primary} />
                <Text className="font-bold text-primary">
                  {order.label === 'order' ? STORES_TAB_COPY.detailOrderOnline : STORES_TAB_COPY.detailWebsite}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
