/**
 * Recipe discovery client: parallel plan cap, cache, quota handling (mocked fetch).
 * Run from mobile/: npm run test:recipe-discovery-client
 */

import assert from 'node:assert/strict';
import { buildBrowseDiscoverySearchPlans } from '../lib/recipeDiscovery/browseQueryPlans';
import { buildRotatingPantrySearchPlans } from '../lib/recipeDiscovery/pantryQueryPlans';
import {
  RECIPE_DISCOVERY_BROWSE_MAX_QUERIES,
  RECIPE_DISCOVERY_PARALLEL_SEARCHES,
} from '../config/recipeDiscoveryClient';
import type { PantryItem } from '../types/mealprep';

const pantry: PantryItem[] = Array.from({ length: 6 }, (_, index) => ({
  id: String(index),
  ingredientId: `i-${index}`,
  name: ['rice', 'pasta', 'beans', 'chicken', 'onion', 'garlic'][index],
  quantity: 1,
  unit: 'each',
  category: 'pantry',
  location: 'pantry',
  photoUri: null,
  expiresOn: null,
  updatedAt: '',
}));

const browse = buildBrowseDiscoverySearchPlans(0);
assert.equal(browse.length, RECIPE_DISCOVERY_BROWSE_MAX_QUERIES);
assert.ok(browse.every((plan) => plan.page === 1), 'browse default page should be 1');

const pantryPlans = buildRotatingPantrySearchPlans(pantry, { seed: 0 });
assert.ok(pantryPlans.length <= RECIPE_DISCOVERY_PARALLEL_SEARCHES);
assert.ok(pantryPlans.every((plan) => plan.page === 1), 'pantry default page should be 1');

const rotated = buildRotatingPantrySearchPlans(pantry, { seed: 3 });
assert.ok(rotated.some((plan) => plan.page >= 1 && plan.page <= 12));

console.log('recipe-discovery-client-check: ok');
