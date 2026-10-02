/**
 * Regression checks for account deletion helpers (storage paths + community anonymize policy).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectPathsFromListPage,
  flattenStorageTree,
  isSafeUserStoragePath,
} from '../lib/account/deleteUserServerLogic.ts';
import { githubPagesLegalUrl, GITHUB_PAGES_APP_PATH } from '../config/legalPages.ts';
import { LEGAL_LINKS } from '../config/account.ts';

const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

assert.equal(isSafeUserStoragePath(`${userId}/pantry/1.jpg`, userId), true);
assert.equal(isSafeUserStoragePath(`${userId}/price-tag/x.jpg`, userId), true);
assert.equal(isSafeUserStoragePath('other-user/pantry/1.jpg', userId), false);
assert.equal(isSafeUserStoragePath(`${userId}/../evil.jpg`, userId), false);

const listPages = {
  [userId]: [
    { name: 'pantry', id: null },
    { name: 'avatar-1.jpg', id: 'file-1' },
  ],
  [`${userId}/pantry`]: [
    { name: 'scan-a.jpg', id: 'file-2' },
    { name: 'nested', id: null },
  ],
  [`${userId}/pantry/nested`]: [{ name: 'deep.jpg', id: 'file-3' }],
};

const flat = flattenStorageTree(userId, listPages);
assert.deepEqual(flat.sort(), [
  `${userId}/avatar-1.jpg`,
  `${userId}/pantry/nested/deep.jpg`,
  `${userId}/pantry/scan-a.jpg`,
]);

const { filePaths, childFolderPrefixes } = collectPathsFromListPage(userId, userId, listPages[userId]);
assert.equal(childFolderPrefixes.length, 1);
assert.equal(filePaths.length, 1);

assert.ok(LEGAL_LINKS.privacy.includes(GITHUB_PAGES_APP_PATH));
assert.ok(LEGAL_LINKS.privacy.endsWith('/privacy'));
assert.equal(LEGAL_LINKS.privacy, githubPagesLegalUrl('privacy'));
assert.equal(LEGAL_LINKS.terms, githubPagesLegalUrl('terms'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deletionMigration = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261002150000_account_deletion_fks_and_rpc.sql'),
  'utf8',
);
assert.match(
  deletionMigration,
  /revoke execute on function public\.delete_user_owned_data\(uuid\) from anon,\s*authenticated/i,
  'migration must revoke EXECUTE from anon and authenticated (PostgREST exposure)',
);
assert.match(
  deletionMigration,
  /grant execute on function public\.delete_user_owned_data\(uuid\) to service_role/i,
);

console.log('delete-user-account-check: ok');
