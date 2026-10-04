import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORES_TAB_DEFAULT_ZIP } from '../../config/storesTab';
import { SMART_SHOP } from '../../config/appConfig';
import { useHydrated } from '../../hooks/useHydrated';
import type { UserProfile } from '../../types/mealprep';
import { nearbyStoresInstantPreview, searchNearbyStores, type StoreLocation } from '../deals';
import { geocodeUsZip } from './nominatim';
import { sortStoresByDistanceMiles, withDistancesFromOrigin } from './storeDistance';
import { resolveSearchOriginFast } from './resolveOrigin';
import { isValidUsZip, normalizeUsZipInput, requestDeviceLocation } from '../smartShop/location';
import {
  persistHomeLocation,
  readInitialCoords,
  readInitialZip,
} from '../smartShop/profileLocation';
import { readCachedZipPlaceLabel, resolveZipPlaceLabel } from './zipPlaceLabel';
import { readSavedZip } from '../smartShop/storage';
import { SMART_SHOP_COPY } from '../../config/smartShop';

function effectiveZip(profile: UserProfile, zipInput: string): string {
  if (isValidUsZip(zipInput)) return zipInput.trim().slice(0, 5);
  const initial = normalizeUsZipInput(readInitialZip(profile));
  if (isValidUsZip(initial)) return initial.slice(0, 5);
  const saved = readSavedZip();
  if (isValidUsZip(saved)) return saved.trim().slice(0, 5);
  return STORES_TAB_DEFAULT_ZIP;
}

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
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [zipPlaceLabel, setZipPlaceLabel] = useState<string | null>(null);
  const loadStoresGeneration = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const initial = normalizeUsZipInput(readInitialZip(profile));
    setZip(isValidUsZip(initial) ? initial : STORES_TAB_DEFAULT_ZIP);
  }, [hydrated, profile.homeZip, profile.id]);

  const searchZip = useMemo(() => effectiveZip(profile, zip), [profile, zip]);

  const locationSummary = useMemo(() => {
    if (originLabel && originLabel !== 'your location') return originLabel;
    const cached = readCachedZipPlaceLabel(searchZip);
    return zipPlaceLabel ?? cached ?? searchZip;
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
    const coords = readInitialCoords(profile);
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
    async (coords?: { lat: number; lng: number }) => {
      const generation = ++loadStoresGeneration.current;
      setError(null);
      setStoreSearchFailed(false);

      const zipCode = coords ? undefined : searchZip;
      const searchParams = {
        lat: coords?.lat,
        lng: coords?.lng,
        zip: zipCode,
        radiusMiles: SMART_SHOP.defaultRadiusMiles,
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
        const { stores, originLabel: label, storeSearchWarning: warning, storeSearchFailed: failed } =
          await searchNearbyStores(searchParams);
        if (generation !== loadStoresGeneration.current) return;
        setNearbyStores(stores);
        setOriginLabel(label);
        setStoreSearchWarning(warning ?? null);
        setStoreSearchFailed(Boolean(failed));
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
    [searchZip],
  );

  useEffect(() => {
    if (!hydrated) return;
    const coords = readInitialCoords(profile);
    void loadStores(coords ?? undefined);
  }, [hydrated, loadStores, profile.homeLat, profile.homeLng, profile.homeZip, profile.id, searchZip]);

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
    const trimmed = zip.trim().slice(0, 5);
    const geocodeResult = await geocodeUsZip(trimmed);
    if (!geocodeResult.ok) {
      setError('Could not look up that ZIP. Try again.');
      return false;
    }
    const geocoded = { lat: geocodeResult.point.lat, lng: geocodeResult.point.lng };
    await persistHomeLocation({ zip: trimmed, lat: geocoded.lat, lng: geocoded.lng });
    setZip(trimmed);
    setError(null);
    await finishLocationSetup(geocoded);
    return true;
  }, [finishLocationSetup, zip]);

  const retryStoreSearch = useCallback(() => {
    void loadStores(readInitialCoords(profile));
  }, [loadStores, profile]);

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
    locationSummary,
    locationModalOpen,
    setLocationModalOpen,
    locationHint,
    error,
    setError,
    handleUseLocation,
    handleSaveZip,
    retryStoreSearch,
  };
}
