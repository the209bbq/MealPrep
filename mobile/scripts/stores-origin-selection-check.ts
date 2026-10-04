/**
 * Stores tab origin selection — ZIP vs GPS, permission pre-prompt, auto-locate.
 * Run from mobile/: npm run test:stores-origin-selection
 */

import type { UserProfile } from '../types/mealprep';
import { removeStorageKey } from '../lib/storage';
import { writeSavedCoords, writeSavedZip } from '../lib/smartShop/storage';
import {
  effectiveStoresSearchZip,
  readStoresOriginMode,
  resolveInitialStoresZipInput,
  resolveStoresSearchCoords,
  shouldAutoLocateStoresOnOpen,
  shouldShowStoresLocationPrePrompt,
  storesPrefersManualZip,
  writeStoresOriginMode,
} from '../lib/stores/storesOriginSelection';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const baseProfile: UserProfile = {
  id: 'user-1',
  name: 'Test',
  email: 't@example.com',
};

function resetStorage(): void {
  removeStorageKey('stores:originMode');
  removeStorageKey('mealprep.smartShop.zip');
  removeStorageKey('mealprep.smartShop.coords');
  removeStorageKey('stores:geolocation:denied');
}

resetStorage();

assert(
  shouldShowStoresLocationPrePrompt({
    hydrated: true,
    geoPermission: 'prompt',
    geolocationDeniedLocal: false,
    prefersManualZip: false,
    hasGpsOriginSaved: false,
  }),
  'prompt shows pre-prompt card',
);

assert(
  !shouldShowStoresLocationPrePrompt({
    hydrated: true,
    geoPermission: 'granted',
    geolocationDeniedLocal: false,
    prefersManualZip: false,
    hasGpsOriginSaved: false,
  }),
  'granted skips pre-prompt',
);

assert(
  !shouldShowStoresLocationPrePrompt({
    hydrated: true,
    geoPermission: 'denied',
    geolocationDeniedLocal: true,
    prefersManualZip: false,
    hasGpsOriginSaved: false,
  }),
  'denied never shows pre-prompt',
);

writeStoresOriginMode('zip');
assert(storesPrefersManualZip(), 'zip mode prefers manual');
assert(
  !shouldShowStoresLocationPrePrompt({
    hydrated: true,
    geoPermission: 'prompt',
    geolocationDeniedLocal: false,
    prefersManualZip: true,
    hasGpsOriginSaved: false,
  }),
  'manual zip skips pre-prompt even when prompt',
);
resetStorage();

assert(
  shouldAutoLocateStoresOnOpen({
    hydrated: true,
    geoPermission: 'granted',
    geolocationDeniedLocal: false,
    prefersManualZip: false,
    autoLocateAlreadyAttempted: false,
  }),
  'granted auto-locates on open',
);

assert(
  !shouldAutoLocateStoresOnOpen({
    hydrated: true,
    geoPermission: 'granted',
    geolocationDeniedLocal: false,
    prefersManualZip: true,
    autoLocateAlreadyAttempted: false,
  }),
  'manual zip blocks auto-locate',
);

assert(
  !shouldAutoLocateStoresOnOpen({
    hydrated: true,
    geoPermission: 'denied',
    geolocationDeniedLocal: true,
    prefersManualZip: false,
    autoLocateAlreadyAttempted: false,
  }),
  'denied blocks auto-locate',
);

const profileOldZip: UserProfile = { ...baseProfile, homeZip: '95361' };
writeSavedZip('90210');
writeStoresOriginMode('zip');
assert(
  resolveInitialStoresZipInput(profileOldZip) === '90210',
  'saved ZIP ahead of stale profile wins for display',
);
assert(
  effectiveStoresSearchZip(profileOldZip, '90210') === '90210',
  'typed valid ZIP is search ZIP',
);
assert(
  resolveStoresSearchCoords(profileOldZip, '90210') === undefined,
  'manual ZIP mode searches by centroid not GPS',
);
assert(readStoresOriginMode() === 'zip', 'origin mode persisted');

writeStoresOriginMode('gps');
writeSavedCoords({
  lat: 37.77,
  lng: -120.85,
  updatedAt: new Date().toISOString(),
});
const gpsCoords = resolveStoresSearchCoords(profileOldZip, '90210');
assert(gpsCoords?.lat === 37.77, 'gps mode uses saved coords');

resetStorage();
writeSavedZip('10001');
const profileSync: UserProfile = { ...baseProfile, homeZip: '95361' };
const initial = resolveInitialStoresZipInput(profileSync);
assert(initial === '10001', 'local saved ZIP not reverted to profile ZIP before sync');

assert(
  effectiveStoresSearchZip(profileSync, '60601') === '60601',
  'user ZIP change stays as search origin',
);

console.log('stores-origin-selection-check: ok');
