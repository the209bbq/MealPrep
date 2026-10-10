/**
 * Photo scan allowance: a monthly cap for Plus and one-time free shelf scans for free accounts.
 * The server side is exercised in pantry-vision-handler-check; this covers the app side and
 * the migration. Run from mobile/: npm run test:pantry-vision
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_PHOTO_SCANS, PLANS_COPY } from '../config/plans';
import { freeScansRemaining, freeScansUsedFromServer } from '../lib/pantry/freeScanAllowance';
import { photoScanAccessState, type PhotoScanAccessInput } from '../lib/plans/photoScanAccess';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8').replace(/\r\n/g, '\n');

// --- Counting ---
assert.equal(FREE_PHOTO_SCANS, 3);
assert.equal(freeScansRemaining(0), 3);
assert.equal(freeScansRemaining(2), 1);
assert.equal(freeScansRemaining(3), 0);
assert.equal(freeScansRemaining(7), 0, 'never negative');
assert.equal(freeScansRemaining(null), 0, 'unknown count: nothing is promised');
assert.equal(freeScansRemaining(Number.NaN), 0);

assert.equal(freeScansUsedFromServer({ isPlus: false, limit: 3, remaining: 2 }), 1);
assert.equal(freeScansUsedFromServer({ isPlus: false, limit: 3, remaining: 0 }), 3);
assert.equal(freeScansUsedFromServer({ isPlus: true, limit: 40, remaining: 39 }), null, 'Plus answers do not touch the free count');
assert.equal(freeScansUsedFromServer({ isPlus: true, limit: null, remaining: null }), null);
assert.equal(freeScansUsedFromServer(undefined), null, 'an older function that sends no usage changes nothing');

// --- Who may start a shelf scan ---
const base: PhotoScanAccessInput = {
  demoMode: false,
  authReady: true,
  hasSession: true,
  plan: 'free',
  role: 'member' as PhotoScanAccessInput['role'],
  profileReady: true,
};
assert.equal(photoScanAccessState(base), 'plan_blocked', 'free account, no free scans passed in: Plus only (receipts, price tags)');
assert.equal(photoScanAccessState({ ...base, freeScansRemaining: 0 }), 'plan_blocked');
assert.equal(photoScanAccessState({ ...base, freeScansRemaining: 2 }), 'allowed', 'free account with free scans left');
assert.equal(photoScanAccessState({ ...base, plan: 'paid' }), 'allowed');
assert.equal(photoScanAccessState({ ...base, role: 'admin' as PhotoScanAccessInput['role'] }), 'allowed');
// Free scans never let a signed-out visitor through, or skip the wait for the profile.
assert.equal(photoScanAccessState({ ...base, hasSession: false, freeScansRemaining: 3 }), 'guest_blocked');
assert.equal(photoScanAccessState({ ...base, profileReady: false, freeScansRemaining: 3 }), 'profile_loading');

// --- Wording ---
assert.equal(PLANS_COPY.freeScansLeftBadge(3), '3 free');
assert.match(PLANS_COPY.freeScansLeftNote(1), /^You have 1 free scan left\./);
assert.match(PLANS_COPY.freeScansLeftNote(2), /^You have 2 free scans left\./);

// --- Screen wiring ---
const screen = read('app/(tabs)/pantry.tsx');
// Receipts use the Plus-only gate everywhere; shelf scans use the gate that knows about free scans.
assert.match(screen, /isReceipt \? plusOnlyScanAccess : photoScanAccess/);
assert.equal((screen.match(/kind === 'receipt' \? plusOnlyScanAccess : photoScanAccess/g) ?? []).length, 2);
const receiptCard = screen.slice(screen.indexOf('variant="receipt"'), screen.indexOf('<PantryScanTip />'));
assert.match(receiptCard, /photoScanAccess=\{plusOnlyScanAccess\}/);
assert.doesNotMatch(receiptCard, /badgeText=/, 'the receipt card never shows a free-scans badge');
assert.match(screen, /badgeText=\{freeScanBadge\}/);
assert.match(screen, /freeScans\.setUsed\(freeUsed\)/);

const hook = read('hooks/useFreeScanAllowance.ts');
assert.match(hook, /\.from\('photo_scan_usage'\)[\s\S]{0,160}\.eq\('period', 'free'\)/);
assert.match(hook, /remaining: enabled \? freeScansRemaining\(used\) : 0/);

// Price-tag scanning in Smart Shop passes no free scans, so it stays Plus only.
assert.doesNotMatch(read('components/smartShop/SmartShopAddPriceSheet.tsx'), /freeScansRemaining/);

// --- Migration ---
const sql = read('supabase/migrations/20261010040000_photo_scan_usage.sql');
assert.match(sql, /create table if not exists public\.photo_scan_usage/);
assert.match(sql, /references auth\.users \(id\) on delete cascade/, 'counts go when the account is deleted');
assert.match(sql, /alter table public\.photo_scan_usage enable row level security/);
assert.match(sql, /for select to authenticated\s+using \(user_id = auth\.uid\(\)\)/, 'a user can read only their own row');
assert.match(sql, /revoke all on public\.photo_scan_usage from anon, authenticated/);
assert.match(sql, /grant select on public\.photo_scan_usage to authenticated/);
assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]*to (anon|authenticated)/i, 'clients can never write their own count');
for (const fn of ['claim_photo_scan(uuid, text, integer)', 'settle_photo_scan(uuid, text, integer, integer, boolean)']) {
  assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon, authenticated`), `${fn} locked down`);
  assert.ok(sql.includes(`grant execute on function public.${fn} to service_role`));
}
assert.match(sql, /and scans < p_limit/, 'the claim is a single guarded update, safe under parallel scans');
assert.doesNotMatch(sql, /drop table|truncate|delete from|alter table public\.(profiles|pantry_items)/i, 'additive only');

// Privacy page says a count is kept.
assert.ok(read('public/privacy.html').replace(/\s+/g, ' ').includes('We keep a count of how many scans'));

console.log('photo-scan-allowance-check: ok');
