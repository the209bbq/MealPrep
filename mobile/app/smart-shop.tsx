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
import { OrderListDeliveryButtons, StoreDeliveryButtons } from '../components/smartShop/StoreDeliveryButtons';
import { StoreCommunityDealsSection } from '../components/smartShop/StoreCommunityDealsSection';
import { StoreWeeklyAdButton } from '../components/smartShop/StoreWeeklyAdButton';
import { SMART_SHOP_STORES } from '../config/smartShop';
import { DELIVERY_CLIPBOARD_TOAST } from '../config/smartShopDelivery';
import { mapsDirectionsUrl, manualStoreFromInput } from '../lib/stores';
import { sortStoreLocationsForDisplay } from '../lib/stores/groceryFilter';
import { copyTextToClipboard } from '../lib/smartShop/copyToClipboard';
import {
  deliveryListOrderUrl,
  formatGroceryListPlainText,
} from '../lib/smartShop/deliveryLinks';
import type { DeliveryServiceId } from '../config/smartShopChains';
import { openExternalUrl } from '../lib/smartShop/openExternalUrl';
import { searchDeals, searchNearbyStores, type DealsSearchResult, type StoreLocation } from '../lib/deals';
import { mergeCommunityDealsIntoSearchResult } from '../lib/communityDeals/mergeIntoDeals';
import { chainKeysFromStores, useCommunityDealsForStores } from '../lib/communityDeals/useCommunityDeals';
import { resolveStoreChainKey } from '../config/weeklyAds';
import {
  bestDealAcrossStores,
  bestDealPerStoreForItem,
  dealsSummaryLabel,
  estimateSmartShopSavings,
  formatMoney,
  openGroceryItems,
  pricingBadgeForStore,
} from '../lib/smartShop/aggregateDeals';
import { isValidUsZip, requestDeviceLocation } from '../lib/smartShop/location';
import {
  loadFavoriteStoreIds,
  persistFavoriteStores,
  persistHomeLocation,
  readInitialCoords,
  readInitialZip,
} from '../lib/smartShop/profileLocation';
import { SMART_SHOP, THEME } from '../config/appConfig';
import { useApp } from '../context/AppContext';

export default function SmartShopScreen() {
  const insets = useSafeAreaInsets();
  const { grocery, featureFlags, profile } = useApp();
  const items = useMemo(() => openGroceryItems(grocery), [grocery]);

  const [zip, setZip] = useState(() => readInitialZip(profile) || '');
  const [savedStoreIds, setSavedStoreIds] = useState<string[]>([]);
  const [nearbyStores, setNearbyStores] = useState<StoreLocation[]>([]);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [dealsResult, setDealsResult] = useState<DealsSearchResult | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeSearchWarning, setStoreSearchWarning] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [autoCompared, setAutoCompared] = useState(false);
  const [showAllStores, setShowAllStores] = useState(false);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);

  const hasLocation = useMemo(() => {
    const coords = readInitialCoords(profile);
    return Boolean(coords) || isValidUsZip(zip);
  }, [profile, zip]);

  const savingsEstimate = useMemo(
    () => (dealsResult ? estimateSmartShopSavings(dealsResult, items.length) : null),
    [dealsResult, items.length],
  );

  const sortedNearbyStores = useMemo(
    () => sortStoreLocationsForDisplay(nearbyStores, savedStoreIds),
    [nearbyStores, savedStoreIds],
  );

  const visibleStores = useMemo(() => {
    if (showAllStores) return sortedNearbyStores;
    return sortedNearbyStores.slice(0, SMART_SHOP_STORES.defaultVisibleStores);
  }, [showAllStores, sortedNearbyStores]);

  const activeStores = useMemo(() => {
    const picked = sortedNearbyStores.filter((s) => savedStoreIds.includes(s.krogerLocationId ?? s.id));
    if (picked.length > 0) return picked;
    return sortedNearbyStores.slice(0, Math.min(3, SMART_SHOP.maxSavedStores));
  }, [sortedNearbyStores, savedStoreIds]);

  const communityStoreKeys = useMemo(() => chainKeysFromStores(nearbyStores), [nearbyStores]);
  const {
    deals: communityDeals,
    loading: loadingCommunityDeals,
    tableMissing: communityTableMissing,
    hint: communityMigrationHint,
    refresh: refreshCommunityDeals,
  } = useCommunityDealsForStores(communityStoreKeys);

  const communityDealsByStoreKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of communityDeals) {
      map.set(deal.storeKey, (map.get(deal.storeKey) ?? 0) + 1);
    }
    return map;
  }, [communityDeals]);

  function storeHasCommunityDeals(store: StoreLocation): boolean {
    const key = resolveStoreChainKey(store);
    return key ? (communityDealsByStoreKey.get(key) ?? 0) > 0 : false;
  }

  const persistSavedStores = useCallback(
    async (ids: string[]) => {
      setSavedStoreIds(ids);
      const stores = nearbyStores.filter((s) => ids.includes(s.krogerLocationId ?? s.id));
      await persistFavoriteStores(stores);
    },
    [nearbyStores],
  );

  const loadStores = useCallback(
    async (coords?: { lat: number; lng: number }) => {
      setLoadingStores(true);
      setError(null);
      try {
        const zipCode = isValidUsZip(zip) ? zip.trim() : undefined;
        const { stores, originLabel: label, storeSearchWarning: warning } = await searchNearbyStores({
          lat: coords?.lat,
          lng: coords?.lng,
          zip: coords ? undefined : zipCode,
          radiusMiles: SMART_SHOP.defaultRadiusMiles,
        });
        setNearbyStores(stores);
        setShowAllStores(false);
        setOriginLabel(label);
        setStoreSearchWarning(warning ?? null);
        const favorites = await loadFavoriteStoreIds();
        if (favorites.length > 0) {
          setSavedStoreIds(favorites);
        } else if (stores.length > 0) {
          const defaults = stores.slice(0, Math.min(3, SMART_SHOP.maxSavedStores)).map((s) => s.krogerLocationId ?? s.id);
          setSavedStoreIds(defaults);
          await persistFavoriteStores(stores.slice(0, Math.min(3, SMART_SHOP.maxSavedStores)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load stores');
      } finally {
        setLoadingStores(false);
      }
    },
    [zip],
  );

  useEffect(() => {
    void loadFavoriteStoreIds().then(setSavedStoreIds);
    void loadStores(readInitialCoords(profile));
  }, []);

  async function handleUseLocation() {
    setLocationHint(null);
    const resolved = await requestDeviceLocation();
    if (!resolved) {
      setLocationHint('Location unavailable — enter a ZIP code below.');
      return;
    }
    await persistHomeLocation({ lat: resolved.lat, lng: resolved.lng, zip: isValidUsZip(zip) ? zip : undefined });
    setLocationHint(`Using ${resolved.source === 'gps' ? 'device' : 'saved'} location`);
    await loadStores({ lat: resolved.lat, lng: resolved.lng });
  }

  async function handleSaveZip() {
    if (!isValidUsZip(zip)) {
      setError('Enter a valid 5-digit US ZIP code.');
      return;
    }
    await persistHomeLocation({ zip });
    setError(null);
    await loadStores(readInitialCoords(profile));
  }

  async function toggleSavedStore(store: StoreLocation) {
    const key = store.krogerLocationId ?? store.id;
    if (savedStoreIds.includes(key)) {
      await persistSavedStores(savedStoreIds.filter((id) => id !== key));
      return;
    }
    if (savedStoreIds.length >= SMART_SHOP.maxSavedStores) {
      setError(`You can save up to ${SMART_SHOP.maxSavedStores} stores. Deselect one first.`);
      return;
    }
    setError(null);
    await persistSavedStores([...savedStoreIds, key]);
  }

  async function handleAddManualStore() {
    if (!manualName.trim() || !manualAddress.trim()) {
      setError('Enter a store name and street address.');
      return;
    }
    const store = manualStoreFromInput({
      name: manualName.trim(),
      addressLine: manualAddress.trim(),
      city: '',
      state: '',
      zip: isValidUsZip(zip) ? zip.trim() : '',
    });
    const mapped: StoreLocation = {
      ...store,
      url: mapsDirectionsUrl(store),
    };
    setNearbyStores((prev) => [mapped, ...prev]);
    await toggleSavedStore(mapped);
    setManualName('');
    setManualAddress('');
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
      setDealsResult(mergeCommunityDealsIntoSearchResult(result, communityDeals, items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deals');
    } finally {
      setLoadingDeals(false);
    }
  }

  useEffect(() => {
    if (!dealsResult || communityDeals.length === 0) return;
    setDealsResult((prev) =>
      prev ? mergeCommunityDealsIntoSearchResult(prev, communityDeals, items) : prev,
    );
  }, [communityDeals, items]);

  useEffect(() => {
    if (autoCompared) return;
    if (items.length === 0 || activeStores.length === 0 || !hasLocation || loadingStores || loadingDeals) return;
    setAutoCompared(true);
    void handleFetchDeals();
  }, [activeStores.length, autoCompared, hasLocation, items.length, loadingDeals, loadingStores]);

  function openDirections(store: StoreLocation) {
    const url = store.url ?? mapsDirectionsUrl(store);
    void Linking.openURL(url);
  }

  async function handleOrderList(service: DeliveryServiceId) {
    if (items.length === 0) {
      setError('Add unchecked items on your grocery list first.');
      return;
    }
    setError(null);
    const text = formatGroceryListPlainText(items);
    await copyTextToClipboard(text);
    setClipboardToast(DELIVERY_CLIPBOARD_TOAST);
    setTimeout(() => setClipboardToast(null), 3500);
    await openExternalUrl(deliveryListOrderUrl(service));
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
          <Text className="text-xs text-muted">
            {items.length} list item(s) · stores near {originLabel ?? 'you'}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pb-12" contentContainerStyle={{ paddingBottom: 40 }}>
        {!hasLocation ? (
          <View className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-4">
            <Text className="text-sm font-bold text-amber-950">Add your location</Text>
            <Text className="mt-1 text-sm text-amber-900">
              Smart Shop needs a ZIP or device location to find stores and compare prices.
            </Text>
          </View>
        ) : null}

        {dealsResult?.mode === 'sample' ? (
          <View className="mt-4 rounded-2xl border-2 border-amber-500 bg-amber-100 px-4 py-3">
            <Text className="text-center text-sm font-bold text-amber-950">Demo prices — not real savings</Text>
          </View>
        ) : null}

        <View className="mt-4 rounded-3xl border border-border bg-card p-4">
          <Text className="text-base font-bold text-ink">Your location</Text>
          <Text className="mt-1 text-sm text-muted">Saved to your profile when signed in. Used for nearby stores and Kroger specials.</Text>
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
            <Pressable onPress={() => void handleSaveZip()} className="rounded-xl bg-slate px-4 py-3">
              <Text className="font-bold text-on-emerald">Save</Text>
            </Pressable>
          </View>
          {loadingStores ? (
            <View className="mt-3 flex-row items-center gap-2">
              <ActivityIndicator color={THEME.emerald} />
              <Text className="text-sm text-muted">Finding stores via OpenStreetMap…</Text>
            </View>
          ) : null}
          {storeSearchWarning ? (
            <Text className="mt-2 text-xs text-muted">{storeSearchWarning}</Text>
          ) : null}
        </View>

        {items.length > 0 ? (
          <View className="mt-4 rounded-2xl border border-border bg-card p-4">
            <Text className="text-sm font-bold text-ink">Delivery</Text>
            <Text className="mt-1 text-xs text-muted">
              Copy your list, then paste into the store search on Instacart or DoorDash.
            </Text>
            <OrderListDeliveryButtons onOrder={(service) => void handleOrderList(service)} />
            {clipboardToast ? (
              <Text className="mt-2 text-xs font-semibold text-emerald-dark">{clipboardToast}</Text>
            ) : null}
          </View>
        ) : null}

        {sortedNearbyStores.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">My stores (tap to favorite)</Text>
            {visibleStores.map((store) => {
              const key = store.krogerLocationId ?? store.id;
              const selected = savedStoreIds.includes(key);
              return (
                <View
                  key={store.id}
                  className={`mb-2 rounded-2xl border px-4 py-3 ${selected ? 'border-emerald bg-emerald-light' : 'border-border bg-card'}`}
                >
                  <Pressable onPress={() => void toggleSavedStore(store)}>
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="font-bold text-ink">{store.name}</Text>
                        <Text className="text-sm text-muted">
                          {store.addressLine}
                          {store.city ? `, ${store.city}` : ''} {store.state} {store.zip}
                        </Text>
                        <Text className="mt-1 text-xs text-muted">
                          {store.distanceMiles != null ? `${store.distanceMiles.toFixed(1)} mi · ` : ''}
                          {pricingBadgeForStore(store, { hasCommunityDeals: storeHasCommunityDeals(store) })}
                        </Text>
                      </View>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={selected ? THEME.emerald : THEME.muted}
                      />
                    </View>
                  </Pressable>
                  <View className="mt-2 flex-row flex-wrap items-center gap-2">
                    <Pressable onPress={() => openDirections(store)} className="self-start">
                      <Text className="text-xs font-semibold text-emerald-dark">Directions</Text>
                    </Pressable>
                    <StoreWeeklyAdButton store={store} />
                  </View>
                  <View className="mt-2">
                    <StoreDeliveryButtons store={store} />
                  </View>
                  <StoreCommunityDealsSection
                    store={store}
                    deals={communityDeals}
                    loading={loadingCommunityDeals}
                    tableMissing={communityTableMissing}
                    migrationHint={communityMigrationHint}
                    onRefresh={() => void refreshCommunityDeals()}
                  />
                </View>
              );
            })}
            {sortedNearbyStores.length > SMART_SHOP_STORES.defaultVisibleStores ? (
              <Pressable
                onPress={() => setShowAllStores((v) => !v)}
                className="mb-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Text className="text-center text-sm font-bold text-emerald-dark">
                  {showAllStores
                    ? 'Show fewer stores'
                    : `Show more (${sortedNearbyStores.length - SMART_SHOP_STORES.defaultVisibleStores} more)`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="mt-4 rounded-2xl border border-border bg-card p-4">
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
          <Pressable onPress={() => void handleAddManualStore()} className="mt-3 rounded-xl bg-slate px-4 py-2">
            <Text className="text-center font-bold text-on-emerald">Add to My stores</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void handleFetchDeals()}
          disabled={loadingDeals}
          className="mt-4 min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-emerald px-4 py-3"
        >
          {loadingDeals ? <ActivityIndicator color={THEME.onEmerald} /> : <Ionicons name="sparkles" size={20} color={THEME.onEmerald} />}
          <Text className="text-base font-bold text-on-emerald">{loadingDeals ? 'Loading deals…' : 'Compare prices for my list'}</Text>
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
              {dealsResult.pricingNote ? <Text className="mt-1 text-xs text-muted">{dealsResult.pricingNote}</Text> : null}
              {savingsEstimate ? (
                <View className="mt-3 rounded-xl bg-emerald-light px-3 py-2">
                  <Text className="text-sm font-bold text-emerald-dark">
                    {savingsEstimate.isDemoPricing ? 'Demo savings up to ' : 'Save up to '}
                    {formatMoney(savingsEstimate.savingsAmount)} vs highest store
                  </Text>
                  <Text className="mt-1 text-xs text-emerald-dark">
                    Priced {savingsEstimate.pricedItemCount} of {savingsEstimate.listItemCount} list items
                    {savingsEstimate.isDemoPricing ? ' (sample mode)' : ''}
                  </Text>
                </View>
              ) : null}
              <Text className="mt-2 text-lg font-bold text-ink">{dealsResult.suggestion.label}</Text>
              <Text className="mt-1 text-2xl font-bold text-emerald-dark">{formatMoney(dealsResult.suggestion.estimatedTotal)}</Text>
              {dealsResult.suggestion.note ? (
                <Text className="mt-2 text-sm text-muted">{dealsResult.suggestion.note}</Text>
              ) : null}
            </View>

            <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Store suggestions</Text>
            {dealsResult.storeTotals.map((total) => {
              const store = activeStores.find((s) => s.id === total.storeId) ?? nearbyStores.find((s) => s.id === total.storeId);
              if (!store) return null;
              const onSale = dealsResult.deals.filter((d) => d.storeId === store.id && d.promoLabel);
              return (
                <View key={total.storeId} className="mb-3 rounded-xl border border-border bg-card px-4 py-3">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="font-bold text-ink">{store.chain || store.name}</Text>
                      <Text className="text-xs text-muted">{pricingBadgeForStore(store, { hasCommunityDeals: storeHasCommunityDeals(store) })}</Text>
                      <Text className="mt-1 text-xs text-muted">
                        {total.itemCount}/{items.length} items priced
                        {total.promoCount ? ` · ${total.promoCount} on sale` : ''}
                        {total.missingCount ? ` · ${total.missingCount} not found` : ''}
                      </Text>
                    </View>
                    {total.pricesAvailable ? (
                      <Text className="text-lg font-bold text-emerald-dark">{formatMoney(total.subtotal)}</Text>
                    ) : (
                      <Text className="text-sm font-semibold text-muted">—</Text>
                    )}
                  </View>
                  {onSale.length > 0 ? (
                    <View className="mt-2 border-t border-border pt-2">
                      {onSale.slice(0, 4).map((d) => (
                        <Text key={`${d.groceryItemId}-${d.promoLabel}`} className="text-xs text-danger">
                          {items.find((i) => i.id === d.groceryItemId)?.name}: {d.promoLabel} · {formatMoney(d.lineTotal)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <View className="mt-2 flex-row flex-wrap items-center gap-2">
                    <Pressable onPress={() => openDirections(store)} className="self-start">
                      <Text className="text-xs font-semibold text-emerald-dark">Directions</Text>
                    </Pressable>
                    <StoreWeeklyAdButton store={store} />
                  </View>
                  <StoreCommunityDealsSection
                    store={store}
                    deals={communityDeals}
                    loading={loadingCommunityDeals}
                    tableMissing={communityTableMissing}
                    migrationHint={communityMigrationHint}
                    onRefresh={() => void refreshCommunityDeals()}
                  />
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
                    <Text className="mt-2 text-sm text-muted">No priced match at selected stores</Text>
                  )}
                  <View className="mt-3 border-t border-border pt-2">
                    {activeStores.map((store) => {
                      const deal = bestDealPerStoreForItem(dealsResult.deals, item.id, store.id);
                      return (
                        <View key={store.id} className="mb-1 flex-row justify-between">
                          <Text className="text-xs text-muted">{store.chain}</Text>
                          <Text className="text-xs font-semibold text-ink">
                            {deal ? formatMoney(deal.lineTotal) : totalLabelForStore(store)}
                          </Text>
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

function totalLabelForStore(store: StoreLocation): string {
  if (store.pricingSource === 'kroger' || store.pricingSource === 'sample') return '—';
  return 'n/a';
}
