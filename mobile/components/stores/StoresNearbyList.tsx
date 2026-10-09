import { Ionicons } from '../../lib/icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { THEME } from '../../config/appConfig';
import { mapsDirectionsUrl } from '../../config/smartShop';
import { STORES_TAB_COPY } from '../../config/storesTab';
import type { StoreLocation } from '../../lib/deals/types';
import { openExternalUrl } from '../../lib/smartShop/openExternalUrl';
import { formatDistanceMiles } from '../../lib/stores/storeDistance';
import { resolveWeeklyAdLink } from '../../lib/stores/storeLinks';

type Props = {
  stores: StoreLocation[];
  onSelectStore: (store: StoreLocation) => void;
};

export function StoresNearbyList({ stores, onSelectStore }: Props) {
  if (stores.length === 0) {
    return <Text className="mt-3.5 text-sm text-muted">{STORES_TAB_COPY.emptySearch}</Text>;
  }

  return (
    <View className="mt-3.5">
      {stores.map((store) => {
        const displayName = store.chain || store.name;
        const town = [store.city, store.state].filter(Boolean).join(', ');
        const distance = store.distanceMiles != null ? formatDistanceMiles(store.distanceMiles) : '';
        const townAndDistance = [town, distance].filter(Boolean).join(' \u00b7 ');
        const weeklyAd = resolveWeeklyAdLink(store);
        const weeklyAdLabel = weeklyAd?.thirdParty
          ? STORES_TAB_COPY.detailWeeklyAdThirdParty
          : STORES_TAB_COPY.detailWeeklyAd;
        const noPricesYet =
          store.pricingTeaser === 'coming_soon' || !store.pricingSource || store.pricingSource === 'none';
        return (
          <View key={store.id} className="mb-3.5 rounded-[20px] border border-border bg-card px-4 py-3.5">
            <Pressable
              onPress={() => onSelectStore(store)}
              accessibilityRole="button"
              className="min-h-[44px] flex-row items-start justify-between gap-2 active:opacity-80"
            >
              <View className="min-w-0 flex-1">
                <Text className="text-[17px] font-extrabold text-ink">{displayName}</Text>
                <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
                  {townAndDistance ? <Text className="text-sm text-muted">{townAndDistance}</Text> : null}
                  {store.openNow != null ? (
                    <Text className={`text-[13px] font-semibold ${store.openNow ? 'text-primary' : 'text-muted'}`}>
                      {store.openNow ? STORES_TAB_COPY.openNow : STORES_TAB_COPY.closedNow}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View className="h-11 items-center justify-center">
                <Ionicons name="chevron-forward" size={20} color={THEME.muted} />
              </View>
            </Pressable>

            <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
              <Pressable
                onPress={() => void openExternalUrl(mapsDirectionsUrl(store))}
                accessibilityRole="button"
                accessibilityLabel={`${STORES_TAB_COPY.detailDirections}: ${displayName}`}
                className="min-h-[44px] items-center justify-center rounded-full bg-primary px-4 active:opacity-80"
              >
                <Text className="text-sm font-bold text-on-primary">{STORES_TAB_COPY.detailDirections}</Text>
              </Pressable>
              {weeklyAd ? (
                <Pressable
                  onPress={() => void openExternalUrl(weeklyAd.url)}
                  accessibilityRole="button"
                  accessibilityLabel={`${weeklyAdLabel}: ${displayName}`}
                  className="min-h-[44px] items-center justify-center rounded-full border border-primary bg-card px-4 active:opacity-80"
                >
                  <Text className="text-sm font-bold text-primary">{weeklyAdLabel}</Text>
                </Pressable>
              ) : null}
              {noPricesYet ? (
                <Text className="ml-auto text-[13px] font-semibold text-muted">{STORES_TAB_COPY.noPricesYet}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
