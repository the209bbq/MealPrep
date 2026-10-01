import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmartShopComparisonResults, resolveCheapestStoreId } from '../components/smartShop/SmartShopComparisonResults';
import { SmartShopComparisonSkeleton } from '../components/smartShop/SmartShopComparisonSkeleton';
import { SmartShopDeliveryBox } from '../components/smartShop/SmartShopDeliveryBox';
import { SmartShopLocationLine } from '../components/smartShop/SmartShopLocationLine';
import { SmartShopLocationModal } from '../components/smartShop/SmartShopLocationModal';
import {
  SmartShopCompareStoresSection,
  SmartShopStorePickerModal,
} from '../components/smartShop/SmartShopStorePicker';
import { SMART_SHOP_COPY } from '../config/smartShop';
import { SMART_SHOP, THEME } from '../config/appConfig';
import { useApp } from '../context/AppContext';
import { useSmartShopScreen } from '../lib/smartShop/useSmartShopScreen';
import {
  SmartShopAddPriceSheet,
  type SmartShopAddPriceTarget,
} from '../components/smartShop/SmartShopAddPriceSheet';
import type { StoreLocation } from '../lib/deals';
import { communityDealsForGroceryList } from '../lib/communityDeals/filterDeals';

export default function SmartShopScreen() {
  const insets = useSafeAreaInsets();
  const { grocery, featureFlags, profile } = useApp();
  const shop = useSmartShopScreen({ grocery, profile });
  const [addPriceTarget, setAddPriceTarget] = useState<SmartShopAddPriceTarget | null>(null);

  const openAddPrice = useCallback((store?: StoreLocation, itemName?: string) => {
    setAddPriceTarget({ store, itemName });
  }, []);

  const handlePriceSaved = useCallback(() => {
    void shop.community.refresh();
    void shop.refreshComparison();
  }, [shop.community.refresh, shop.refreshComparison]);

  if (!featureFlags.smartShop) {
    return (
      <View className="flex-1 bg-paper px-4" style={{ paddingTop: insets.top }}>
        <Text className="mt-8 text-lg font-bold text-ink">Smart Shop is turned off</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-2xl bg-emerald px-4 py-3">
          <Text className="text-center font-bold text-on-emerald">Back</Text>
        </Pressable>
      </View>
    );
  }

  const cheapestStoreId = shop.dealsResult ? resolveCheapestStoreId(shop.dealsResult) : null;
  const showComparisonSkeleton = shop.loadingDeals && !shop.dealsResult && shop.items.length > 0 && shop.hasLocation;
  const listCommunityDeals = communityDealsForGroceryList(shop.community.deals, shop.items);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3 rounded-full p-2">
          <Ionicons name="chevron-back" size={24} color={THEME.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">Smart Shop</Text>
          <Text className="text-xs text-muted">
            {shop.items.length} list item(s)
            {shop.originLabel ? ` · ${shop.originLabel}` : ''}
          </Text>
        </View>
        {shop.items.length > 0 ? (
          <Pressable
            onPress={() => openAddPrice()}
            className="rounded-xl bg-primary px-3 py-2"
          >
            <Text className="text-xs font-bold text-on-primary">{SMART_SHOP_COPY.addPriceButton}</Text>
          </Pressable>
        ) : null}
      </View>

      {shop.hasLocation ? (
        <SmartShopLocationLine
          locationSummary={shop.locationSummary}
          onChangePress={() => shop.setLocationModalOpen(true)}
        />
      ) : null}

      <ScrollView className="flex-1 px-4 pb-12" contentContainerStyle={{ paddingBottom: 40 }}>
        <SmartShopDeliveryBox grocery={grocery} onError={(message) => shop.setError(message)} />

        {shop.dealsResult?.mode === 'sample' ? (
          <View className="mt-3 rounded-2xl border-2 border-amber-500 bg-amber-100 px-4 py-3">
            <Text className="text-center text-sm font-bold text-amber-950">{SMART_SHOP_COPY.estimatesBanner}</Text>
          </View>
        ) : null}

        {shop.hasLocation ? (
          <SmartShopCompareStoresSection
            activeStores={shop.activeStores}
            savedStoreIds={shop.savedStoreIds}
            sortedNearbyStores={shop.sortedNearbyStores}
            loadingStores={shop.loadingStores}
            storeHasCommunityDeals={shop.storeHasCommunityDeals}
            onEditPress={() => shop.setStorePickerOpen(true)}
            resultMode={shop.dealsResult?.mode}
            onAddPrice={(store) => openAddPrice(store)}
          />
        ) : null}

        {shop.storeSearchWarning ? (
          <Text className="mt-2 text-xs text-muted">{shop.storeSearchWarning}</Text>
        ) : null}

        {shop.error ? (
          <View className="mt-3 rounded-xl bg-danger/10 px-3 py-2">
            <Text className="text-sm text-danger">{shop.error}</Text>
          </View>
        ) : null}

        {showComparisonSkeleton ? <SmartShopComparisonSkeleton /> : null}

        {shop.dealsResult ? (
          <SmartShopComparisonResults
            dealsResult={shop.dealsResult}
            items={shop.items}
            activeStores={shop.activeStores}
            nearbyStores={shop.nearbyStores}
            storeHasCommunityDeals={shop.storeHasCommunityDeals}
            communityDeals={listCommunityDeals}
            loadingCommunityDeals={shop.community.loading}
            communityTableMissing={shop.community.tableMissing}
            communityMigrationHint={shop.community.hint}
            onRefreshCommunityDeals={() => void shop.community.refresh()}
            onOpenDirections={shop.openDirections}
            cheapestStoreId={cheapestStoreId}
            onAddPrice={openAddPrice}
          />
        ) : null}

        {shop.items.length === 0 ? (
          <View className="mt-6 rounded-2xl border border-border bg-card px-4 py-5">
            <Text className="text-center text-sm text-muted">Add unchecked items on your grocery list to compare prices.</Text>
          </View>
        ) : null}
      </ScrollView>

      <SmartShopLocationModal
        visible={shop.locationModalOpen}
        zip={shop.zip}
        onZipChange={shop.setZip}
        locationHint={shop.locationHint}
        loadingStores={shop.loadingStores}
        onUseLocation={() => void shop.handleUseLocation()}
        onSaveZip={() => void shop.handleSaveZip()}
        onRequestClose={() => {
          if (shop.hasLocation) shop.setLocationModalOpen(false);
        }}
      />

      <SmartShopAddPriceSheet
        target={addPriceTarget}
        ownerId={profile.id}
        groceryItems={shop.items}
        nearbyStores={shop.sortedNearbyStores}
        communityDeals={listCommunityDeals}
        dealsResult={shop.dealsResult}
        onClose={() => setAddPriceTarget(null)}
        onSaved={handlePriceSaved}
      />

      <SmartShopStorePickerModal
        visible={shop.storePickerOpen}
        onClose={() => shop.setStorePickerOpen(false)}
        sortedNearbyStores={shop.sortedNearbyStores}
        savedStoreIds={shop.savedStoreIds}
        storeHasCommunityDeals={shop.storeHasCommunityDeals}
        onToggleStore={(store) => void shop.toggleSavedStore(store)}
        onAddManualStore={(name, address) => void shop.addManualStore(name, address)}
        maxStores={SMART_SHOP.maxSavedStores}
        resultMode={shop.dealsResult?.mode}
      />
    </View>
  );
}
