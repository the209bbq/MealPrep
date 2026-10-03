import assert from 'node:assert/strict';
import {
  VIRAL_RECIPES_CATEGORIES,
  VIRAL_RECIPES_CATEGORY_LABELS,
  VIRAL_RECIPES_CATEGORY_QUERIES,
} from '../config/viralRecipes.ts';
import { getViralRecipesUrl, isViralRecipesConfigured } from '../config/appConfig.ts';

for (const category of VIRAL_RECIPES_CATEGORIES) {
  assert.ok(VIRAL_RECIPES_CATEGORY_LABELS[category], `label for ${category}`);
  assert.ok(VIRAL_RECIPES_CATEGORY_QUERIES[category]?.length > 2, `query for ${category}`);
}

assert.equal(typeof getViralRecipesUrl(), 'string');
assert.equal(typeof isViralRecipesConfigured(), 'boolean');

console.log('OK: viral-recipes checks passed');
