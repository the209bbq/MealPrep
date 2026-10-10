/**
 * Pantry photo scans run in the background: the app stays usable, more photos can be added
 * while earlier ones are scanning, and their results join one list.
 * Run from mobile/: npm run test:pantry-vision
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PANTRY_SCAN_UI_COPY } from '../config/pantryScan';
import {
  MAX_PARALLEL_SCANS,
  canStartAnotherScan,
  getScanActivity,
  pantryTabBadge,
  placeScanResult,
  resetScanActivity,
  setScanReviewReady,
  setScanningCount,
  subscribeScanActivity,
} from '../lib/pantry/scanActivity';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8').replace(/\r\n/g, '\n');

// --- Where a finished photo's items go ---
// First photo back, nothing open yet: open the list.
assert.equal(placeScanResult({ reviewOpen: false, newItemCount: 12, othersScanning: 1 }), 'open-review');
// Second photo back while the list from the first is open: join it, even with nothing new.
assert.equal(placeScanResult({ reviewOpen: true, newItemCount: 7, othersScanning: 0 }), 'merge-into-review');
assert.equal(placeScanResult({ reviewOpen: true, newItemCount: 0, othersScanning: 0 }), 'merge-into-review');
// Nothing found and nothing else pending: tell the shopper.
assert.equal(placeScanResult({ reviewOpen: false, newItemCount: 0, othersScanning: 0 }), 'nothing-found');
// Nothing found but other photos are still out: stay quiet, their results may still come.
assert.equal(placeScanResult({ reviewOpen: false, newItemCount: 0, othersScanning: 2 }), 'nothing-found-quiet');

// --- How many at once ---
assert.ok(MAX_PARALLEL_SCANS >= 2, 'more than one photo can scan at a time');
assert.ok(MAX_PARALLEL_SCANS <= 6, 'well under the server limit of 12 scans a minute');
assert.equal(canStartAnotherScan(0), true);
assert.equal(canStartAnotherScan(MAX_PARALLEL_SCANS - 1), true);
assert.equal(canStartAnotherScan(MAX_PARALLEL_SCANS), false);

// --- Shared activity for the tab bar ---
resetScanActivity();
assert.deepEqual(getScanActivity(), { scanning: 0, reviewReady: false });
assert.equal(pantryTabBadge(getScanActivity()), undefined, 'no badge when idle');

let notified = 0;
const unsubscribe = subscribeScanActivity(() => {
  notified += 1;
});
setScanningCount(1);
assert.equal(notified, 1);
assert.equal(pantryTabBadge(getScanActivity()), 1);
setScanningCount(1);
assert.equal(notified, 1, 'no notification when nothing changed');
setScanningCount(3);
assert.equal(pantryTabBadge(getScanActivity()), 3);
setScanReviewReady(true);
assert.equal(pantryTabBadge(getScanActivity()), '!', 'a waiting list outranks the count');
setScanningCount(-5);
assert.equal(getScanActivity().scanning, 0, 'count never goes below zero');
setScanReviewReady(false);
assert.equal(pantryTabBadge(getScanActivity()), undefined);
const before = notified;
unsubscribe();
setScanningCount(2);
assert.equal(notified, before, 'unsubscribed listeners are not called');
resetScanActivity();

// --- Wording ---
assert.equal(PANTRY_SCAN_UI_COPY.scanningPhotos(1), 'Scanning 1 photo…');
assert.equal(PANTRY_SCAN_UI_COPY.scanningPhotos(3), 'Scanning 3 photos…');
assert.match(PANTRY_SCAN_UI_COPY.moreStillScanning(1), /^1 more photo is still scanning/);
assert.match(PANTRY_SCAN_UI_COPY.moreStillScanning(2), /^2 more photos are still scanning/);
assert.match(PANTRY_SCAN_UI_COPY.tooManyScans(4), /^4 photos are already scanning/);

// --- The pantry screen is wired the background way ---
const pantry = read('app/(tabs)/pantry.tsx');
assert.doesNotMatch(pantry, /setPhase\('loading'\)/, 'a scan no longer puts the screen in a blocking loading state');
assert.doesNotMatch(pantry, /disabled=\{phase === 'loading'/, 'the scan button stays usable while a photo is scanning');
assert.match(pantry, /disabled=\{!featureFlags\.photoScan\}/);
assert.match(pantry, /beginScan\(\);/);
assert.match(pantry, /\} finally \{\s*endScan\(\);\s*\}/, 'the count goes down whether the scan worked or failed');
assert.equal((pantry.match(/beginScan\(\);/g) ?? []).length, 1, 'one place starts a scan');
assert.equal((pantry.match(/endScan\(\);/g) ?? []).length, 1, 'and one place ends it');
// Placement is decided from the live phase when the answer arrives, not from a stale closure.
assert.match(pantry, /reviewOpen: phaseRef\.current === 'review'/);
assert.match(pantry, /if \(!canStartAnotherScan\(activeScansRef\.current\)\)/);
// A failed photo must not close a list that another photo opened.
const failureBlock = pantry.slice(pantry.indexOf('const canRetry ='), pantry.indexOf('async function runVisionFromUri'));
assert.doesNotMatch(failureBlock, /setPhase\('idle'\)/);
const uriBlock = pantry.slice(pantry.indexOf('async function runVisionFromUri'), pantry.indexOf('async function handleAddAnotherPhotoFromReview'));
assert.doesNotMatch(uriBlock, /setPhase\(/);
// Progress is shown without covering the screen, in both states.
assert.match(pantry, /activeScans > 0 && phase !== 'review'/);
assert.match(pantry, /phase === 'review' && activeScans > 0/);
assert.match(pantry, /setScanReviewReady\(phase === 'review'\)/);

const layout = read('app/(tabs)/_layout.tsx');
assert.match(layout, /tabBarBadge: tab\.name === 'pantry' \? pantryBadge : undefined/);

console.log('pantry-scan-background-check: ok');
