/**
 * Regression tests for pantry photo scan sign-in + Plus plan gate.
 * Run from mobile/: npm run test:photo-scan-gate
 */

import {
  pantryPhotoScanGateState,
  shouldBlockGuestPantryPhotoScan,
  shouldDeferPantryPhotoScanForAuth,
} from '../lib/guest/pantryPhotoScanGate';
import {
  photoScanAccessState,
  shouldBlockPhotoScanForPlan,
  shouldDeferPhotoScanForProfile,
} from '../lib/plans/photoScanAccess';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const guestBase = { demoMode: false, authReady: true, hasSession: true, profileReady: true };

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

  assert(
    photoScanAccessState({ ...guestBase, hasSession: false, plan: 'free', role: 'member' }) === 'guest_blocked',
    'guest before plan check',
  );
  assert(
    photoScanAccessState({ ...guestBase, authReady: false, plan: 'paid', role: 'member' }) === 'auth_loading',
    'session loading defers before plan',
  );
  assert(
    photoScanAccessState({ ...guestBase, profileReady: false, plan: 'paid', role: 'member' }) === 'profile_loading',
    'profile loading defers',
  );
  assert(
    photoScanAccessState({ ...guestBase, plan: 'free', role: 'member' }) === 'plan_blocked',
    'free member blocked',
  );
  assert(
    photoScanAccessState({ ...guestBase, plan: 'paid', role: 'member' }) === 'allowed',
    'paid member allowed',
  );
  assert(
    photoScanAccessState({ ...guestBase, plan: 'free', role: 'admin' }) === 'allowed',
    'admin allowed on free plan',
  );
  assert(
    photoScanAccessState({ demoMode: true, authReady: false, hasSession: false, plan: 'free', role: 'member', profileReady: false }) === 'allowed',
    'demo skips plan gate',
  );
  assert(
    shouldBlockPhotoScanForPlan({ ...guestBase, plan: 'free', role: 'member' }),
    'shouldBlockPhotoScanForPlan free',
  );
  assert(
    !shouldBlockPhotoScanForPlan({ ...guestBase, plan: 'paid', role: 'member' }),
    'paid not blocked',
  );
  assert(
    shouldDeferPhotoScanForProfile({ ...guestBase, profileReady: false, plan: 'paid', role: 'member' }),
    'defer for profile',
  );

  console.log('photo-scan-gate-check: OK');
}

main();
