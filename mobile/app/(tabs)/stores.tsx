import { Ionicons } from '../../lib/icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SmartShopLocationLine } from '../../components/smartShop/SmartShopLocationLine';
import { SmartShopLocationModal } from '../../components/smartShop/SmartShopLocationModal';
import { StoreDetailSheet } from '../../components/stores/StoreDetailSheet';
import { StoresLocationPrePrompt } from '../../components/stores/StoresLocationPrePrompt';
import { StoresNearbyList } from '../../components/stores/StoresNearbyList';
import { STORES_TAB_COPY } from '../../config/storesTab';
import { THEME } from '../../config/appConfig';
import { useApp } from '../../context/AppContext';
import type { StoreLocation } from '../../lib/deals/types';
import { useNearbyStoresList } from '../../lib/stores/useNearbyStoresList';
import {
  storesTabShowsLoadError,
  storesTabShowsLoading,
  storesTabShowsNoSearchResults,
  storesTabShowsNoStoresNearby,
} from '../../lib/stores/storesTabEmptyState';

export default function StoresScreen() {
  const { profile } = useApp();
  const stores = useNearbyStoresList(profile);
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null);

  const listPhase = {
    loadingStores: stores.loadingStores,
    storeSearchFailed: stores.storeSearchFailed,
    filteredCount: stores.filteredStores.length,
    hasSearchQuery: Boolean(stores.query.trim()),
  };

  return (
    <View className="flex-1 bg-paper">
      <SmartShopLocationLine
        locationSummary={stores.locationSummary}
        onChangePress={() => stores.setLocationModalOpen(true)}
      />

      <ScrollView className="flex-1 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="mt-4 text-2xl font-bold text-ink">{STORES_TAB_COPY.title}</Text>

        {stores.showLocationPrePrompt ? (
          <StoresLocationPrePrompt
            onUseLocation={() => void stores.handleUseLocation()}
            onEnterZip={() => stores.setLocationModalOpen(true)}
            locationDeniedHelp={stores.locationDeniedHelp}
            showZipField={Boolean(stores.locationDeniedHelp)}
            zip={stores.zip}
            onZipChange={stores.setZip}
            onSaveZip={() => void stores.handleSaveZip()}
          />
        ) : null}

        <View className="mt-3 flex-row items-center rounded-2xl border border-border bg-card px-3">
          <Ionicons name="search" size={20} color={THEME.muted} />
          <TextInput
            value={stores.query}
            onChangeText={stores.setQuery}
            placeholder={STORES_TAB_COPY.searchPlaceholder}
            placeholderTextColor={THEME.muted}
            className="ml-2 flex-1 py-3 text-base text-ink"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {stores.updatingStores ? (
          <Text className="mt-2 text-xs text-muted">{STORES_TAB_COPY.updating}</Text>
        ) : null}
        {stores.storeSearchWarning && stores.filteredStores.length > 0 ? (
          <Text className="mt-2 text-xs text-muted">{stores.storeSearchWarning}</Text>
        ) : null}

        {storesTabShowsLoading(listPhase) ? (
          <View className="mt-8 items-center">
            <ActivityIndicator color={THEME.primary} />
            <Text className="mt-3 text-sm text-muted">{STORES_TAB_COPY.loading}</Text>
          </View>
        ) : null}

        {storesTabShowsLoadError(listPhase) ? (
          <View className="mt-6 rounded-2xl border border-border bg-card px-4 py-4">
            <Text className="text-sm text-muted">{STORES_TAB_COPY.loadFailed}</Text>
            <Pressable
              onPress={stores.retryStoreSearch}
              className="mt-3 self-start rounded-xl bg-primary px-4 py-2"
            >
              <Text className="text-xs font-bold text-on-primary">{STORES_TAB_COPY.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {storesTabShowsNoSearchResults(listPhase) ? (
          <Text className="mt-6 text-sm text-muted">{STORES_TAB_COPY.emptySearch}</Text>
        ) : null}

        {storesTabShowsNoStoresNearby(listPhase) ? (
          <View className="mt-6">
            <Text className="text-sm text-muted">{STORES_TAB_COPY.noStores}</Text>
            {stores.canWidenSearch ? (
              <Pressable
                onPress={stores.widenStoreSearch}
                className="mt-3 self-start rounded-xl border border-border bg-card px-4 py-2"
              >
                <Text className="text-xs font-bold text-ink">{STORES_TAB_COPY.widenSearch}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!storesTabShowsLoading(listPhase) || stores.filteredStores.length > 0 ? (
          <StoresNearbyList stores={stores.filteredStores} onSelectStore={setSelectedStore} />
        ) : null}

        {stores.error && !storesTabShowsLoadError(listPhase) ? (
          <Text className="mt-3 text-sm text-danger">{stores.error}</Text>
        ) : null}

        <Text className="mt-8 text-center text-[10px] leading-4 text-muted">{STORES_TAB_COPY.attribution}</Text>
      </ScrollView>

      <SmartShopLocationModal
        visible={stores.locationModalOpen}
        zip={stores.zip}
        onZipChange={stores.setZip}
        locationHint={stores.locationHint}
        loadingStores={stores.loadingStores}
        onUseLocation={() => void stores.handleUseLocation()}
        onSaveZip={() => void stores.handleSaveZip()}
        onRequestClose={() => stores.setLocationModalOpen(false)}
      />

      <StoreDetailSheet store={selectedStore} onClose={() => setSelectedStore(null)} />
    </View>
  );
}
