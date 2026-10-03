import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  VIRAL_RECIPES,
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

const migrationPath = path.join(process.cwd(), VIRAL_RECIPES.migrationFilePath.replace(/^mobile\//, ''));
assert.ok(fs.existsSync(migrationPath), `migration file exists: ${VIRAL_RECIPES.migrationFilePath}`);
assert.match(
  fs.readFileSync(migrationPath, 'utf8'),
  /primary key \(category, video_id\)/,
  'composite primary key on category + video_id',
);

console.log('OK: viral-recipes checks passed');
