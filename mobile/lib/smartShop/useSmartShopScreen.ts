import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readCachedZipPlaceLabel, resolveZipPlaceLabel } from '../stores/zipPlaceLabel';
import { Linking } from 'react-native';
import { useHydrated } from '../../hooks/useHydrated';
import { SMART_SHOP_COPY, SMART_SHOP_STORES } from '../../config/smartShop';
import { SMART_SHOP } from '../../config/appConfig';
import type { GroceryListItem, UserProfile } from '../../types/mealprep';
import { mergeCommunityDealsIntoSearchResult } from '../communityDeals/mergeIntoDeals';
import { chainKeysFromStores, useCommunityDealsForStores } from '../communityDeals/useCommunityDeals';
import { searchDeals, searchNearbyStores, type DealsSearchResult, type StoreLocation } from '../deals';
import { geocodeUsZip } from '../stores';
import { mapsDirectionsUrl, manualStoreFromInput } from '../stores';
import { sortStoreLocationsForDisplay } from '../stores/groceryFilter';
import { resolveStoreChainKey } from '../../config/weeklyAds';
import { openGroceryItems } from './aggregateDeals';
import { isValidUsZip, requestDeviceLocation } from './location';
import {
  loadFavoriteStoreIds,
  persistFavoriteStores,
  persistHomeLocation,
  readInitialCoords,
  readInitialZip,
} from './profileLocation';
import { readSavedZip } from './storage';

export interface UseSmartShopScreenInput {
  grocery: GroceryListItem[];
  profile: UserProfile;
}

export function useSmartShopScreen({ grocery, profile }: UseSmartShopScreenInput) {
  const hydrated = useHydrated();
  const items = useMemo(() => openGroceryItems(grocery), [grocery]);

  const [zip, setZip] = useState('');
  const [savedStoreIds, setSavedStoreIds] = useState<string[]>([]);
  const [nearbyStores, setNearbyStores] = useState<StoreLocation[]>([]);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [dealsResult, setDealsResult] = useState<DealsSearchResult | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeSearchWarning, setStoreSearchWarning] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [zipPlaceLabel, setZipPlaceLabel] = useState<string | null>(null);
  const initialLocationChecked = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const initial = readInitialZip(profile);
    if (initial) setZip(initial);
  }, [hydrated, profile.homeZip, profile.id]);

  const hasLocation = useMemo(() => {
    if (!hydrated) return isValidUsZip(zip);
    const coords = readInitialCoords(profile);
    return Boolean(coords) || isValidUsZip(zip);
  }, [hydrated, profile, zip]);

  const locationSummary = useMemo(() => {
    if (isValidUsZip(zip)) {
      const normalized = zip.trim().slice(0, 5);
      return zipPlaceLabel ?? readCachedZipPlaceLabel(normalized) ?? normalized;
    }
    if (!hydrated) return originLabel ?? 'your area';
    const saved = readSavedZip();
    if (saved && isValidUsZip(saved)) {
      const normalized = saved.trim().slice(0, 5);
      return zipPlaceLabel ?? readCachedZipPlaceLabel(normalized) ?? normalized;
    }
    return originLabel ?? 'your area';
  }, [hydrated, originLabel, zip, zipPlaceLabel]);

  useEffect(() => {
    if (!hydrated) return;
    const code = isValidUsZip(zip) ? zip.trim().slice(0, 5) : readSavedZip();
    if (!code || !isValidUsZip(code)) {
      setZipPlaceLabel(null);
      return;
    }
    const cached = readCachedZipPlaceLabel(code);
    if (cached) {
      setZipPlaceLabel(cached);
      return;
    }
    void resolveZipPlaceLabel(code).then((label) => setZipPlaceLabel(label));
  }, [hydrated, zip]);

  const sortedNearbyStores = useMemo(
    () => sortStoreLocationsForDisplay(nearbyStores, savedStoreIds),
    [nearbyStores, savedStoreIds],
  );

  const activeStores = useMemo(() => {
    const picked = sortedNearbyStores.filter((s) => savedStoreIds.includes(s.krogerLocationId ?? s.id));
    if (picked.length > 0) return picked;
    const n = Math.min(SMART_SHOP_STORES.defaultComparisonStoreCount, SMART_SHOP.maxSavedStores);
    return sortedNearbyStores.slice(0, n);
  }, [sortedNearbyStores, savedStoreIds]);

  const communityStoreKeys = useMemo(() => chainKeysFromStores(nearbyStores), [nearbyStores]);
  const community = useCommunityDealsForStores(communityStoreKeys);

  const communityDealsByStoreKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of community.deals) {
      map.set(deal.storeKey, (map.get(deal.storeKey) ?? 0) + 1);
    }
    return map;
  }, [community.deals]);

  const storeHasCommunityDeals = useCallback(
    (store: StoreLocation): boolean => {
      const key = resolveStoreChainKey(store);
      return key ? (communityDealsByStoreKey.get(key) ?? 0) > 0 : false;
    },
    [communityDealsByStoreKey],
  );

  const persistSavedStores = useCallback(
    async (ids: string[], storeList?: StoreLocation[]) => {
      setSavedStoreIds(ids);
      const list = storeList ?? nearbyStores;
      const stores = list.filter((s) => ids.includes(s.krogerLocationId ?? s.id));
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
        setOriginLabel(label);
        setStoreSearchWarning(warning ?? null);
        const favorites = await loadFavoriteStoreIds();
        if (favorites.length > 0) {
          setSavedStoreIds(favorites);
        } else if (stores.length > 0) {
          const n = Math.min(SMART_SHOP_STORES.defaultComparisonStoreCount, SMART_SHOP.maxSavedStores);
          const defaults = stores.slice(0, n).map((s) => s.krogerLocationId ?? s.id);
          setSavedStoreIds(defaults);
          await persistFavoriteStores(stores.slice(0, n));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load stores');
      } finally {
        setLoadingStores(false);
      }
    },
    [zip],
  );

  const fetchDeals = useCallback(async () => {
    if (items.length === 0) {
      setDealsResult(null);
      return;
    }
    if (activeStores.length === 0) {
      setDealsResult(null);
      return;
    }
    setLoadingDeals(true);
    setError(null);
    try {
      const result = await searchDeals({ stores: activeStores, items });
      setDealsResult(mergeCommunityDealsIntoSearchResult(result, community.deals, items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deals');
    } finally {
      setLoadingDeals(false);
    }
  }, [activeStores, community.deals, items]);

  useEffect(() => {
    if (!hydrated) return;
    void loadFavoriteStoreIds().then(setSavedStoreIds);
    const coords = readInitialCoords(profile);
    const initialZip = readInitialZip(profile);
    if (coords || isValidUsZip(initialZip)) {
      void loadStores(coords);
    } else if (!initialLocationChecked.current) {
      initialLocationChecked.current = true;
      setLocationModalOpen(true);
    }
  }, [hydrated]);

  useEffect(() => {
    if (!dealsResult || community.deals.length === 0) return;
    setDealsResult((prev) =>
      prev ? mergeCommunityDealsIntoSearchResult(prev, community.deals, items) : prev,
    );
  }, [community.deals, items]);

  const comparisonToken = useMemo(
    () => `${savedStoreIds.join('|')}:${activeStores.map((s) => s.id).join('|')}:${items.map((i) => i.id).join('|')}`,
    [activeStores, items, savedStoreIds],
  );

  useEffect(() => {
    if (!hasLocation || loadingStores) return;
    if (items.length === 0 || activeStores.length === 0) return;
    void fetchDeals();
  }, [activeStores.length, comparisonToken, fetchDeals, hasLocation, items.length, loadingStores]);

  const finishLocationSetup = useCallback(
    async (coords?: { lat: number; lng: number }) => {
      setLocationModalOpen(false);
      await loadStores(coords ?? readInitialCoords(profile));
    },
    [loadStores, profile],
  );

  const handleUseLocation = useCallback(async () => {
    setLocationHint(null);
    const resolved = await requestDeviceLocation();
    if (!resolved) {
      setLocationHint(SMART_SHOP_COPY.locationUnavailable);
      return;
    }
    await persistHomeLocation({
      lat: resolved.lat,
      lng: resolved.lng,
      zip: isValidUsZip(zip) ? zip : undefined,
    });
    setLocationHint(`Using ${resolved.source === 'gps' ? 'device' : 'saved'} location`);
    await finishLocationSetup({ lat: resolved.lat, lng: resolved.lng });
  }, [finishLocationSetup, zip]);

  const handleSaveZip = useCallback(async () => {
    if (!isValidUsZip(zip)) {
      setError('Enter a valid 5-digit US ZIP code.');
      return false;
    }
    const trimmed = zip.trim();
    const geocodeResult = await geocodeUsZip(trimmed);
    if (!geocodeResult.ok) {
      setError('Could not look up that ZIP. Try again.');
      return false;
    }
    const geocoded = { lat: geocodeResult.point.lat, lng: geocodeResult.point.lng };
    await persistHomeLocation({ zip: trimmed, lat: geocoded.lat, lng: geocoded.lng });
    setError(null);
    await finishLocationSetup(geocoded);
    return true;
  }, [finishLocationSetup, zip]);

  const toggleSavedStore = useCallback(
    async (store: StoreLocation) => {
      const key = store.krogerLocationId ?? store.id;
      if (savedStoreIds.includes(key)) {
        if (savedStoreIds.length <= 1) {
          setError('Keep at least one store selected for comparison.');
          return;
        }
        await persistSavedStores(savedStoreIds.filter((id) => id !== key));
        return;
      }
      if (savedStoreIds.length >= SMART_SHOP.maxSavedStores) {
        setError(`You can compare up to ${SMART_SHOP.maxSavedStores} stores. Deselect one first.`);
        return;
      }
      setError(null);
      await persistSavedStores([...savedStoreIds, key]);
    },
    [persistSavedStores, savedStoreIds],
  );

  const addManualStore = useCallback(
    async (name: string, addressLine: string) => {
      if (!name.trim() || !addressLine.trim()) {
        setError('Enter a store name and street address.');
        return;
      }
      const store = manualStoreFromInput({
        name: name.trim(),
        addressLine: addressLine.trim(),
        city: '',
        state: '',
        zip: isValidUsZip(zip) ? zip.trim() : '',
      });
      const mapped: StoreLocation = {
        ...store,
        url: mapsDirectionsUrl(store),
      };
      const key = mapped.krogerLocationId ?? mapped.id;
      if (savedStoreIds.length >= SMART_SHOP.maxSavedStores) {
        setError(`You can compare up to ${SMART_SHOP.maxSavedStores} stores. Deselect one first.`);
        return;
      }
      const nextStores = [mapped, ...nearbyStores];
      setNearbyStores(nextStores);
      const nextIds = [...savedStoreIds, key];
      setError(null);
      await persistSavedStores(nextIds, nextStores);
    },
    [nearbyStores, persistSavedStores, savedStoreIds, zip],
  );

  const openDirections = useCallback((store: StoreLocation) => {
    const url = store.url ?? mapsDirectionsUrl(store);
    void Linking.openURL(url);
  }, []);

  return {
    items,
    zip,
    setZip,
    hasLocation,
    locationSummary,
    locationModalOpen,
    setLocationModalOpen,
    storePickerOpen,
    setStorePickerOpen,
    savedStoreIds,
    sortedNearbyStores,
    activeStores,
    nearbyStores,
    originLabel,
    dealsResult,
    loadingStores,
    loadingDeals,
    locationHint,
    setLocationHint,
    error,
    setError,
    storeSearchWarning,
    handleUseLocation,
    handleSaveZip,
    toggleSavedStore,
    addManualStore,
    openDirections,
    storeHasCommunityDeals,
    community,
    refreshComparison: fetchDeals,
  };
}
