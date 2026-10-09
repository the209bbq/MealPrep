import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREATOR_RECIPES } from '../config/creatorRecipes.ts';
import { selectCreatorPrefetchChannelIds } from '../lib/creatorVideos/prefetchSelection.ts';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Home must not request every creator: 48 creators used to mean 48 calls per device per open.
const many = Array.from({ length: 48 }, (_, index) => `UC_${index}`);
const limit = CREATOR_RECIPES.homePrefetchChannelLimit;
assert.ok(limit >= 1 && limit <= 6, 'home prefetch should stay small');
assert.deepEqual(selectCreatorPrefetchChannelIds(many, []), many.slice(0, limit));
assert.deepEqual(selectCreatorPrefetchChannelIds(undefined, many), many.slice(0, limit));
assert.deepEqual(selectCreatorPrefetchChannelIds([], many), many.slice(0, limit));
assert.deepEqual(selectCreatorPrefetchChannelIds(['a', '', 'a', 'b'], [], 5), ['a', 'b']);
assert.deepEqual(selectCreatorPrefetchChannelIds(many, [], 0), []);

// Creator data changes about daily; a short device cache multiplies calls for no benefit.
assert.ok(
  CREATOR_RECIPES.clientCacheTtlMs >= 6 * 60 * 60 * 1000,
  'creator device cache should last hours, not minutes',
);

const prefetchSource = fs.readFileSync(path.join(mobileRoot, 'lib/mealdb/homePrefetch.ts'), 'utf8');
assert.match(prefetchSource, /selectCreatorPrefetchChannelIds\(/, 'home prefetch must cap creator channels');
assert.doesNotMatch(
  prefetchSource,
  /\?\s*input\.creatorChannelIds\s*:/,
  'home prefetch must not pass the full creator list straight through',
);

console.log('creator-prefetch-limit-check: ok');
