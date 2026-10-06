/**
 * Home classic category chips are fixed, not tied to loaded feed size.
 * Run from mobile/: npm run test:category-chips-home
 */

import assert from 'node:assert/strict';
import { HOME_CLASSIC_CATEGORY_CHIPS } from '../config/recipesTabSurface';
import { DEFAULT_USER_DIET_PREFS } from '../lib/diet/prefs';
import { emptyEngagementIndexForGhost } from '../lib/recipeRanking/engagementIndexHelpers';
import { buildCategoryRotation } from '../lib/recipesTab/categoryRotation';

const categories = HOME_CLASSIC_CATEGORY_CHIPS.map((category) => ({
  category,
  thumbUrl: null,
  passingRecipeCount: 0,
}));

const chips = buildCategoryRotation({
  visitId: 'home-chip-visit',
  categories: [
    ...categories,
    { category: 'Miscellaneous', thumbUrl: null, passingRecipeCount: 99 },
  ],
  prefs: DEFAULT_USER_DIET_PREFS,
  householdSize: 2,
  index: emptyEngagementIndexForGhost(),
  surfaceEvents: [],
  visitState: {
    lastVisitAt: 0,
    lastVisitId: 'home-chip-visit',
    lastFirst5Creators: [],
    lastFirst3Categories: [],
    recentFirst5Visits: [],
  },
  nowMs: Date.now(),
});

for (const expected of HOME_CLASSIC_CATEGORY_CHIPS) {
  assert(chips.some((chip) => chip.category === expected), `missing home chip ${expected}`);
}
const seafoodIdx = HOME_CLASSIC_CATEGORY_CHIPS.indexOf('Seafood');
const pastaIdx = HOME_CLASSIC_CATEGORY_CHIPS.indexOf('Pasta');
assert.ok(seafoodIdx >= 0 && pastaIdx === seafoodIdx + 1, 'Pasta chip follows Seafood');
assert.equal(chips.some((chip) => chip.category === 'Miscellaneous'), false);
console.log('category-chips-home-check: ok');
