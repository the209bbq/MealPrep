import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SMART_SHOP_COPY } from '../../config/smartShop';
import { SMART_SHOP, THEME } from '../../config/appConfig';
import type { StoreLocation } from '../../lib/deals/types';
import { pricingBadgeForStore } from '../../lib/smartShop/aggregateDeals';
import { formatStoreAddress } from '../../lib/stores/formatAddress';

type SectionProps = {
  activeStores: StoreLocation[];
  savedStoreIds: string[];
  sortedNearbyStores: StoreLocation[];
  loadingStores: boolean;
  storeHasCommunityDeals: (store: StoreLocation) => boolean;
  onEditPress: () => void;
  resultMode?: 'live' | 'sample';
  onAddPrice?: (store: StoreLocation) => void;
};

export function SmartShopCompareStoresSection({
  activeStores,
  savedStoreIds,
  sortedNearbyStores,
  loadingStores,
  storeHasCommunityDeals,
  onEditPress,
  resultMode,
  onAddPrice,
}: SectionProps) {
  return (
    <View className="mt-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wide text-muted">{SMART_SHOP_COPY.compareStoresTitle}</Text>
        <Pressable onPress={onEditPress}>
          <Text className="text-xs font-semibold text-emerald-dark">{SMART_SHOP_COPY.compareStoresEdit}</Text>
        </Pressable>
      </View>
      {loadingStores && sortedNearbyStores.length === 0 ? (
        <Text className="text-sm text-muted">{SMART_SHOP_COPY.loadingStores}</Text>
      ) : null}
      {!loadingStores && sortedNearbyStores.length === 0 ? (
        <Text className="text-sm text-muted">{SMART_SHOP_COPY.compareStoresEmpty}</Text>
      ) : null}
      {activeStores.map((store) => {
        const key = store.krogerLocationId ?? store.id;
        const selected = savedStoreIds.includes(key);
        return (
          <View key={store.id} className="mb-2 rounded-xl border border-emerald bg-emerald-light/40 px-3 py-2">
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-ink">{store.chain || store.name}</Text>
                <Text className="text-xs text-muted">
                  {store.distanceMiles != null ? `${store.distanceMiles.toFixed(1)} mi · ` : ''}
                  {pricingBadgeForStore(store, {
                    hasCommunityDeals: storeHasCommunityDeals(store),
                    resultMode,
                  })}
                  {selected ? '' : ' · nearby default'}
                </Text>
              </View>
              {onAddPrice ? (
                <Pressable onPress={() => onAddPrice(store)} className="rounded-lg bg-emerald px-2 py-1">
                  <Text className="text-xs font-bold text-on-emerald">{SMART_SHOP_COPY.addPriceButton}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  sortedNearbyStores: StoreLocation[];
  savedStoreIds: string[];
  storeHasCommunityDeals: (store: StoreLocation) => boolean;
  onToggleStore: (store: StoreLocation) => void;
  onAddManualStore: (name: string, address: string) => void;
  maxStores: number;
  resultMode?: 'live' | 'sample';
};

export function SmartShopStorePickerModal({
  visible,
  onClose,
  sortedNearbyStores,
  savedStoreIds,
  storeHasCommunityDeals,
  onToggleStore,
  onAddManualStore,
  maxStores,
  resultMode,
}: ModalProps) {
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] rounded-t-3xl border border-border bg-paper px-4 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink">{SMART_SHOP_COPY.compareStoresPickerTitle}</Text>
            <Pressable onPress={onClose} className="rounded-full bg-card px-3 py-1">
              <Text className="text-sm font-bold text-emerald-dark">{SMART_SHOP_COPY.compareStoresPickerDone}</Text>
            </Pressable>
          </View>
          <Text className="mb-2 text-xs text-muted">Select up to {maxStores} stores. Changes refresh prices right away.</Text>
          <ScrollView className="max-h-96">
            {sortedNearbyStores.map((store) => {
              const key = store.krogerLocationId ?? store.id;
              const selected = savedStoreIds.includes(key);
              return (
                <Pressable
                  key={store.id}
                  onPress={() => void onToggleStore(store)}
                  className={`mb-2 rounded-2xl border px-4 py-3 ${selected ? 'border-emerald bg-emerald-light' : 'border-border bg-card'}`}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="font-bold text-ink">{store.name}</Text>
                      <Text className="text-sm text-muted">{formatStoreAddress(store)}</Text>
                      <Text className="mt-1 text-xs text-muted">
                        {store.distanceMiles != null ? `${store.distanceMiles.toFixed(1)} mi · ` : ''}
                        {pricingBadgeForStore(store, {
                hasCommunityDeals: storeHasCommunityDeals(store),
                resultMode,
              })}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? THEME.emerald : THEME.muted}
                    />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="mt-4 rounded-2xl border border-border bg-card p-3">
            <Text className="text-sm font-bold text-ink">Add a store manually</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Store name"
              placeholderTextColor={THEME.muted}
              className="mt-2 rounded-xl border border-border bg-paper px-3 py-2 text-ink"
            />
            <TextInput
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="Street address"
              placeholderTextColor={THEME.muted}
              className="mt-2 rounded-xl border border-border bg-paper px-3 py-2 text-ink"
            />
            <Pressable
              onPress={() => {
                void onAddManualStore(manualName, manualAddress);
                setManualName('');
                setManualAddress('');
              }}
              className="mt-3 rounded-xl bg-slate px-4 py-2"
            >
              <Text className="text-center font-bold text-on-emerald">Add store</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
