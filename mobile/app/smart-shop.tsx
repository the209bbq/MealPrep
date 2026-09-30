import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchDeals, searchNearbyStores, type DealsSearchResult, type StoreLocation } from '../lib/deals';
import {
  bestDealAcrossStores,
  bestDealPerStoreForItem,
  dealsSummaryLabel,
  formatMoney,
  openGroceryItems,
} from '../lib/smartShop/aggregateDeals';
import { isValidUsZip, requestDeviceLocation } from '../lib/smartShop/location';
import {
  readSavedCoords,
  readSavedStoreIds,
  readSavedZip,
  writeSavedCoords,
  writeSavedStoreIds,
  writeSavedZip,
} from '../lib/smartShop/storage';
import { SMART_SHOP, THEME } from '../config/appConfig';
import { useApp } from '../context/AppContext';

export default function SmartShopScreen() {
  const insets = useSafeAreaInsets();
  const { grocery, featureFlags } = useApp();
  const items = useMemo(() => openGroceryItems(grocery), [grocery]);

  const [zip, setZip] = useState(() => readSavedZip() || '95350');
  const [savedStoreIds, setSavedStoreIds] = useState<string[]>(() => readSavedStoreIds());
  const [nearbyStores, setNearbyStores] = useState<StoreLocation[]>([]);
  const [dealsResult, setDealsResult] = useState<DealsSearchResult | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeStores = useMemo(() => {
    if (savedStoreIds.length === 0) return nearbyStores.slice(0, SMART_SHOP.maxSavedStores);
    return nearbyStores.filter((s) => savedStoreIds.includes(s.id));
  }, [nearbyStores, savedStoreIds]);

  const persistSavedStores = useCallback((ids: string[]) => {
    setSavedStoreIds(ids);
    writeSavedStoreIds(ids);
  }, []);

  const loadStores = useCallback(
    async (coords?: { lat: number; lng: number }) => {
      setLoadingStores(true);
      setError(null);
      try {
        const zipCode = isValidUsZip(zip) ? zip.trim() : undefined;
        const { stores } = await searchNearbyStores({
          lat: coords?.lat,
          lng: coords?.lng,
          zip: zipCode,
          radiusMiles: SMART_SHOP.defaultRadiusMiles,
        });
        setNearbyStores(stores);
        if (savedStoreIds.length === 0 && stores.length > 0) {
          persistSavedStores(stores.slice(0, Math.min(3, SMART_SHOP.maxSavedStores)).map((s) => s.id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load stores');
      } finally {
        setLoadingStores(false);
      }
    },
    [persistSavedStores, savedStoreIds.length, zip],
  );

  useEffect(() => {
    void loadStores(readSavedCoords() ?? undefined);
  }, []);

  async function handleUseLocation() {
    setLocationHint(null);
    const resolved = await requestDeviceLocation();
    if (!resolved) {
      setLocationHint('Location unavailable — enter a ZIP code below.');
      return;
    }
    writeSavedCoords({ lat: resolved.lat, lng: resolved.lng, updatedAt: new Date().toISOString() });
    setLocationHint(`Using ${resolved.source === 'gps' ? 'device' : 'saved'} location`);
    await loadStores({ lat: resolved.lat, lng: resolved.lng });
  }

  function handleSaveZip() {
    if (!isValidUsZip(zip)) {
      setError('Enter a valid 5-digit US ZIP code.');
      return;
    }
    writeSavedZip(zip);
    setError(null);
    void loadStores(readSavedCoords() ?? undefined);
  }

  function toggleSavedStore(storeId: string) {
    if (savedStoreIds.includes(storeId)) {
      persistSavedStores(savedStoreIds.filter((id) => id !== storeId));
      return;
    }
    if (savedStoreIds.length >= SMART_SHOP.maxSavedStores) {
      setError(`You can save up to ${SMART_SHOP.maxSavedStores} stores. Deselect one first.`);
      return;
    }
    setError(null);
    persistSavedStores([...savedStoreIds, storeId]);
  }

  async function handleFetchDeals() {
    if (items.length === 0) {
      setError('Add unchecked items on your grocery list first.');
      return;
    }
    if (activeStores.length === 0) {
      setError('Select at least one store.');
      return;
    }
    setLoadingDeals(true);
    setError(null);
    try {
      const result = await searchDeals({ stores: activeStores, items });
      setDealsResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deals');
    } finally {
      setLoadingDeals(false);
    }
  }

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

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center border-b border-border bg-card px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3 rounded-full p-2">
          <Ionicons name="chevron-back" size={24} color={THEME.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">Smart Shop</Text>
          <Text className="text-xs text-muted">{items.length} list item(s) to price</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pb-12" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-4 rounded-3xl border border-border bg-card p-4">
          <Text className="text-base font-bold text-ink">Your location</Text>
          <Text className="mt-1 text-sm text-muted">We use this to find nearby stores and local prices.</Text>
          <Pressable
            onPress={() => void handleUseLocation()}
            className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl bg-emerald px-4 py-3"
          >
            <Ionicons name="locate" size={20} color={THEME.onEmerald} />
            <Text className="font-bold text-on-emerald">Use my location</Text>
          </Pressable>
          {locationHint ? <Text className="mt-2 text-xs text-emerald-dark">{locationHint}</Text> : null}
          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={zip}
              onChangeText={setZip}
              keyboardType="number-pad"
              placeholder="ZIP code"
              placeholderTextColor={THEME.muted}
              maxLength={10}
              className="flex-1 rounded-xl border border-border bg-paper px-4 py-3 text-base text-ink"
            />
            <Pressable onPress={handleSaveZip} className="rounded-xl bg-slate px-4 py-3">
              <Text className="font-bold text-on-emerald">Save</Text>
            </Pressable>
          </View>
          {loadingStores ? (
            <View className="mt-3 flex-row items-center gap-2">
              <ActivityIndicator color={THEME.emerald} />
              <Text className="text-sm text-muted">Finding stores…</Text>
            </View>
          ) : null}
        </View>

        {nearbyStores.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">My stores</Text>
            {nearbyStores.map((store) => {
              const selected = savedStoreIds.includes(store.id);
              return (
                <Pressable
                  key={store.id}
                  onPress={() => toggleSavedStore(store.id)}
                  className={`mb-2 rounded-2xl border px-4 py-3 ${selected ? 'border-emerald bg-emerald-light' : 'border-border bg-card'}`}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="font-bold text-ink">{store.name}</Text>
                      <Text className="text-sm text-muted">
                        {store.addressLine}, {store.city} {store.state} {store.zip}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? THEME.emerald : THEME.muted}
                    />
                  </View>
                  {store.url ? (
                    <Pressable
                      onPress={() => void Linking.openURL(store.url!)}
                      className="mt-2 self-start"
                    >
                      <Text className="text-xs font-semibold text-emerald-dark">Open in maps</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Pressable
          onPress={() => void handleFetchDeals()}
          disabled={loadingDeals}
          className="mt-4 min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-emerald px-4 py-3"
        >
          {loadingDeals ? <ActivityIndicator color={THEME.onEmerald} /> : <Ionicons name="sparkles" size={20} color={THEME.onEmerald} />}
          <Text className="text-base font-bold text-on-emerald">{loadingDeals ? 'Loading deals…' : 'Compare prices'}</Text>
        </Pressable>

        {error ? (
          <View className="mt-3 rounded-xl bg-danger/10 px-3 py-2">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        {dealsResult ? (
          <View className="mt-6">
            <View className="rounded-2xl border border-border bg-card p-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted">{dealsSummaryLabel(dealsResult)}</Text>
              <Text className="mt-1 text-lg font-bold text-ink">{dealsResult.suggestion.label}</Text>
              <Text className="mt-1 text-2xl font-bold text-emerald-dark">{formatMoney(dealsResult.suggestion.estimatedTotal)}</Text>
              {dealsResult.suggestion.note ? (
                <Text className="mt-2 text-sm text-muted">{dealsResult.suggestion.note}</Text>
              ) : null}
            </View>

            <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Totals by store</Text>
            {dealsResult.storeTotals
              .filter((t) => activeStores.some((s) => s.id === t.storeId))
              .sort((a, b) => a.subtotal - b.subtotal)
              .map((total) => {
                const store = activeStores.find((s) => s.id === total.storeId);
                return (
                  <View key={total.storeId} className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                    <View>
                      <Text className="font-bold text-ink">{store?.chain ?? store?.name ?? 'Store'}</Text>
                      <Text className="text-xs text-muted">
                        {total.itemCount} priced · {total.missingCount} not found
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-emerald-dark">{formatMoney(total.subtotal)}</Text>
                  </View>
                );
              })}

            <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Best price per item</Text>
            {items.map((item) => {
              const best = bestDealAcrossStores(dealsResult.deals, item.id);
              return (
                <View key={item.id} className="mb-3 rounded-2xl border border-border bg-card p-4">
                  <Text className="font-bold text-ink">{item.name}</Text>
                  <Text className="text-sm text-muted">
                    Need {item.quantity} {item.unit}
                  </Text>
                  {best ? (
                    <View className="mt-2">
                      <Text className="text-base font-bold text-emerald-dark">
                        {formatMoney(best.lineTotal)} at {activeStores.find((s) => s.id === best.storeId)?.chain ?? 'store'}
                      </Text>
                      {best.promoLabel ? <Text className="text-xs text-danger">{best.promoLabel}</Text> : null}
                    </View>
                  ) : (
                    <Text className="mt-2 text-sm text-muted">No match at selected stores</Text>
                  )}
                  <View className="mt-3 border-t border-border pt-2">
                    {activeStores.map((store) => {
                      const deal = bestDealPerStoreForItem(dealsResult.deals, item.id, store.id);
                      return (
                        <View key={store.id} className="mb-1 flex-row justify-between">
                          <Text className="text-xs text-muted">{store.chain}</Text>
                          <Text className="text-xs font-semibold text-ink">{deal ? formatMoney(deal.lineTotal) : '—'}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {best?.productUrl ? (
                    <Pressable onPress={() => void Linking.openURL(best.productUrl!)} className="mt-2">
                      <Text className="text-xs font-semibold text-emerald-dark">View at store</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
