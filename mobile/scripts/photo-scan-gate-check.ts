/**
 * Regression tests for pantry photo scan sign-in gate.
 * Run from mobile/: npx tsx scripts/photo-scan-gate-check.ts
 */

import {
  pantryPhotoScanGateState,
  shouldBlockGuestPantryPhotoScan,
  shouldDeferPantryPhotoScanForAuth,
} from '../lib/guest/pantryPhotoScanGate';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function main(): void {
  assert(pantryPhotoScanGateState({ demoMode: true, authReady: false, hasSession: false }) === 'allowed', 'demo skips gate');
  assert(
    pantryPhotoScanGateState({ demoMode: false, authReady: false, hasSession: false }) === 'auth_loading',
    'live + auth loading defers',
  );
  assert(
    pantryPhotoScanGateState({ demoMode: false, authReady: true, hasSession: false }) === 'guest_blocked',
    'live guest blocked after auth',
  );
  assert(
    pantryPhotoScanGateState({ demoMode: false, authReady: true, hasSession: true }) === 'allowed',
    'signed-in allowed',
  );
  assert(
    !shouldBlockGuestPantryPhotoScan({ demoMode: false, authReady: false, hasSession: false }),
    'do not block as guest while auth loading',
  );
  assert(
    shouldBlockGuestPantryPhotoScan({ demoMode: false, authReady: true, hasSession: false }),
    'block guest after auth ready',
  );
  assert(
    shouldDeferPantryPhotoScanForAuth({ demoMode: false, authReady: false, hasSession: false }),
    'defer while auth loading',
  );
  assert(
    !shouldDeferPantryPhotoScanForAuth({ demoMode: false, authReady: true, hasSession: true }),
    'no defer when signed in',
  );

  console.log('photo-scan-gate-check: OK');
}

main();
