import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORES_TAB_COPY, STORES_TAB_DISPLAY_LIMIT } from '../../config/storesTab';
import { useHydrated } from '../../hooks/useHydrated';
import type { UserProfile } from '../../types/mealprep';
import { nearbyStoresInstantPreview, searchNearbyStores, type StoreLocation } from '../deals';
import { geocodeUsZip } from './nominatim';
import { sortStoresByDistanceMiles, withDistancesFromOrigin } from './storeDistance';
import { resolveSearchOriginFast } from './resolveOrigin';
import { loadZctaCentroids } from './zctaCentroids';
import { isValidUsZip } from '../smartShop/location';
import { persistHomeLocation } from '../smartShop/profileLocation';
import { readCachedZipPlaceLabel, resolveZipPlaceLabel } from './zipPlaceLabel';
import { requestStoresDeviceLocation } from './requestStoresLocation';
import {
  markStoresGeolocationDenied,
  queryStoresGeolocationPermissionForPlatform,
  readStoresGeolocationDenied,
} from './storesGeolocation';
import {
  effectiveStoresSearchZip,
  resolveInitialStoresZipInput,
  resolveStoresSearchCoords,
  shouldAutoLocateStoresOnOpen,
  shouldShowStoresLocationPrePrompt,
  storesHasGpsOriginSaved,
  storesPrefersManualZip,
  writeStoresOriginMode,
} from './storesOriginSelection';

export function useNearbyStoresList(profile: UserProfile) {
  const hydrated = useHydrated();
  const [zip, setZip] = useState('');
  const [query, setQuery] = useState('');
  const [nearbyStores, setNearbyStores] = useState<StoreLocation[]>([]);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);
  const [updatingStores, setUpdatingStores] = useState(false);
  const [storeSearchFailed, setStoreSearchFailed] = useState(false);
  const [storeSearchWarning, setStoreSearchWarning] = useState<string | null>(null);
  const [canWidenSearch, setCanWidenSearch] = useState(false);
  const [radiusMultiplier, setRadiusMultiplier] = useState<1 | 2>(1);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [zipPlaceLabel, setZipPlaceLabel] = useState<string | null>(null);
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const loadStoresGeneration = useRef(0);
  const zipInitializedForProfile = useRef<string | null>(null);
  const autoLocateAttempted = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    void loadZctaCentroids();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void queryStoresGeolocationPermissionForPlatform().then((state) => {
      if (state) setGeoPermission(state);
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const profileKey = profile.id ?? 'guest';
    if (zipInitializedForProfile.current === profileKey) return;
    zipInitializedForProfile.current = profileKey;
    setZip(resolveInitialStoresZipInput(profile));
  }, [hydrated, profile.id]);

  const searchZip = useMemo(() => effectiveStoresSearchZip(profile, zip), [profile, zip]);

  const prefersManualZip = useMemo(() => storesPrefersManualZip(), [zip, profile.homeZip, profile.id]);

  const hasGpsOriginSaved = useMemo(
    () => storesHasGpsOriginSaved(profile),
    [profile.homeLat, profile.homeLng, profile.homeZip, profile.id],
  );

  const showLocationPrePrompt = useMemo(
    () =>
      shouldShowStoresLocationPrePrompt({
        hydrated,
        geoPermission,
        geolocationDeniedLocal: readStoresGeolocationDenied(),
        prefersManualZip,
        hasGpsOriginSaved,
      }),
    [geoPermission, hasGpsOriginSaved, hydrated, prefersManualZip],
  );

  const locationDeniedHelp = useMemo(() => {
    if (readStoresGeolocationDenied() || geoPermission === 'denied') {
      return STORES_TAB_COPY.locationDeniedHelp;
    }
    return null;
  }, [geoPermission]);

  const locationSummary = useMemo(() => {
    if (originLabel === STORES_TAB_COPY.nearYourLocation) return STORES_TAB_COPY.nearYourLocation;
    if (originLabel && originLabel !== STORES_TAB_COPY.nearYourLocation) return originLabel;
    const cached = readCachedZipPlaceLabel(searchZip);
    const place = zipPlaceLabel ?? cached;
    if (place && place !== searchZip) return `${place} (${searchZip})`;
    return searchZip;
  }, [originLabel, searchZip, zipPlaceLabel]);

  useEffect(() => {
    if (!hydrated) return;
    const cached = readCachedZipPlaceLabel(searchZip);
    if (cached) {
      setZipPlaceLabel(cached);
      return;
    }
    void resolveZipPlaceLabel(searchZip).then((label) => setZipPlaceLabel(label));
  }, [hydrated, searchZip]);

  const searchOrigin = useMemo(() => {
    const coords = resolveStoresSearchCoords(profile, searchZip);
    if (coords) return coords;
    return resolveSearchOriginFast({ zip: searchZip });
  }, [profile.homeLat, profile.homeLng, profile.homeZip, profile.id, searchZip]);

  const sortedStores = useMemo(() => {
    const withDistance = searchOrigin ? withDistancesFromOrigin(nearbyStores, searchOrigin) : nearbyStores;
    return sortStoresByDistanceMiles(withDistance);
  }, [nearbyStores, searchOrigin]);

  const filteredStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedStores;
    return sortedStores.filter((store) => {
      const haystack = `${store.chain} ${store.name} ${store.city} ${store.addressLine}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, sortedStores]);

  const loadStores = useCallback(
    async (coords?: { lat: number; lng: number }, options?: { radiusMultiplier?: 1 | 2 }) => {
      const generation = ++loadStoresGeneration.current;
      setError(null);
      setStoreSearchFailed(false);

      const isGpsOrigin = Boolean(coords);
      const mult = options?.radiusMultiplier ?? radiusMultiplier;
      const zipCode = coords ? undefined : searchZip;
      const searchParams = {
        lat: coords?.lat,
        lng: coords?.lng,
        zip: zipCode,
        isGpsOrigin,
        radiusMultiplier: mult,
        displayLimit: STORES_TAB_DISPLAY_LIMIT,
      };

      const instant = nearbyStoresInstantPreview(searchParams);
      const hadInstantStores = Boolean(instant?.stores.length);
      if (instant) {
        setNearbyStores(instant.stores);
        setOriginLabel(instant.originLabel);
        setLoadingStores(false);
        if (hadInstantStores) setUpdatingStores(true);
      } else {
        setLoadingStores(true);
      }

      try {
        const {
          stores,
          originLabel: label,
          storeSearchWarning: warning,
          storeSearchFailed: failed,
          canWidenSearch: widen,
        } = await searchNearbyStores(searchParams);
        if (generation !== loadStoresGeneration.current) return;
        setNearbyStores(stores);
        setOriginLabel(label);
        setStoreSearchWarning(warning ?? null);
        setStoreSearchFailed(Boolean(failed));
        setCanWidenSearch(Boolean(widen));
      } catch (err) {
        if (generation !== loadStoresGeneration.current) return;
        setError(err instanceof Error ? err.message : 'Could not load stores');
        if (!hadInstantStores) setStoreSearchFailed(true);
      } finally {
        if (generation === loadStoresGeneration.current) {
          setLoadingStores(false);
          setUpdatingStores(false);
        }
      }
    },
    [radiusMultiplier, searchZip],
  );

  useEffect(() => {
    if (!hydrated) return;
    const coords = resolveStoresSearchCoords(profile, searchZip);
    void loadStores(coords ?? undefined);
  }, [hydrated, loadStores, profile.homeLat, profile.homeLng, profile.homeZip, profile.id, searchZip]);

  const finishLocationSetup = useCallback(
    async (coords?: { lat: number; lng: number }) => {
      setLocationModalOpen(false);
      const resolved = coords ?? resolveStoresSearchCoords(profile, searchZip);
      await loadStores(resolved ?? undefined);
    },
    [loadStores, profile, searchZip],
  );

  const handleUseLocation = useCallback(async () => {
    setLocationHint(null);
    const perm = await queryStoresGeolocationPermissionForPlatform();
    if (perm) setGeoPermission(perm);
    if (perm === 'denied' || readStoresGeolocationDenied()) {
      markStoresGeolocationDenied();
      setGeoPermission('denied');
      return;
    }

    const resolved = await requestStoresDeviceLocation();
    if (!resolved) {
      markStoresGeolocationDenied();
      setGeoPermission('denied');
      await finishLocationSetup(undefined);
      return;
    }

    writeStoresOriginMode('gps');
    await persistHomeLocation({
      lat: resolved.lat,
      lng: resolved.lng,
      zip: isValidUsZip(zip) ? zip : undefined,
    });
    setLocationHint('Using your location');
    await finishLocationSetup({ lat: resolved.lat, lng: resolved.lng });
  }, [finishLocationSetup, zip]);

  useEffect(() => {
    if (
      !shouldAutoLocateStoresOnOpen({
        hydrated,
        geoPermission,
        geolocationDeniedLocal: readStoresGeolocationDenied(),
        prefersManualZip,
        autoLocateAlreadyAttempted: autoLocateAttempted.current,
      })
    ) {
      return;
    }
    autoLocateAttempted.current = true;
    void handleUseLocation();
  }, [geoPermission, handleUseLocation, hydrated, prefersManualZip]);

  const handleSaveZip = useCallback(async () => {
    if (!isValidUsZip(zip)) {
      setError('Enter a valid 5-digit US ZIP code.');
      return false;
    }
    const trimmed = zip.trim().slice(0, 5);
    const geocodeResult = await geocodeUsZip(trimmed);
    if (!geocodeResult.ok) {
      setError('Could not look up that ZIP. Try again.');
      return false;
    }
    writeStoresOriginMode('zip');
    await persistHomeLocation({ zip: trimmed });
    setZip(trimmed);
    setError(null);
    await finishLocationSetup(undefined);
    return true;
  }, [finishLocationSetup, zip]);

  const retryStoreSearch = useCallback(() => {
    const coords = resolveStoresSearchCoords(profile, searchZip);
    void loadStores(coords ?? undefined);
  }, [loadStores, profile, searchZip]);

  const widenStoreSearch = useCallback(() => {
    setRadiusMultiplier(2);
    const coords = resolveStoresSearchCoords(profile, searchZip);
    void loadStores(coords ?? undefined, { radiusMultiplier: 2 });
  }, [loadStores, profile, searchZip]);

  return {
    query,
    setQuery,
    zip,
    setZip,
    filteredStores,
    loadingStores,
    updatingStores,
    storeSearchFailed,
    storeSearchWarning,
    canWidenSearch,
    locationSummary,
    locationModalOpen,
    setLocationModalOpen,
    locationHint,
    showLocationPrePrompt,
    locationDeniedHelp,
    error,
    setError,
    handleUseLocation,
    handleSaveZip,
    retryStoreSearch,
    widenStoreSearch,
  };
}
