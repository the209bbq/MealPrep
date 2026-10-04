import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CREATOR_RECIPES_FEED_MODES } from '../config/creatorRecipes';
import { VIRAL_RECIPES_FEED_MODES } from '../config/viralRecipes';
import { savedRefKeyCreator, savedRefKeyKitchen, savedRefKeyMealDb } from '../lib/savedRecipes/keys';
import { savedRecordFromKitchenRecipe, savedRecordFromViralItem } from '../lib/savedRecipes/payloads';
import { buildSavedRecipeFeedRows } from '../lib/savedRecipes/resolveRows';
import { buildPantryMatchIndex } from '../lib/recipeMatch';
import type { Recipe } from '../types/mealprep';

assert.equal(CREATOR_RECIPES_FEED_MODES.includes('my_recipes' as never), false);
assert.equal(VIRAL_RECIPES_FEED_MODES.includes('my_recipes' as never), false);

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20261004200000_user_saved_recipes.sql',
);
assert.ok(fs.existsSync(migrationPath), 'saved recipes migration should exist');

const recipe: Recipe = {
  id: 'mealdb-52772',
  name: 'Teriyaki Chicken',
  tag: 'Classic',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [{ ingredientId: 'a', name: 'chicken', quantity: 1, unit: 'lb' }],
  steps: ['Cook'],
  isMaster: false,
  createdAt: '',
  sourceType: 'themealdb',
};

const record = savedRecordFromKitchenRecipe(recipe);
assert.equal(record.refKey, savedRefKeyMealDb('52772'));
assert.equal(record.sourceType, 'mealdb');

const viral = savedRecordFromViralItem({
  videoId: 'abc123',
  category: 'quick',
  title: 'Easy pasta',
  thumbnailUrl: 'https://example.com/t.jpg',
  channelId: 'ch',
  channelTitle: 'Chef',
  channelUrl: 'https://youtube.com/channel/ch',
  watchUrl: 'https://youtube.com/watch?v=abc123',
  viewCount: 1,
  publishedAt: null,
});
assert.equal(viral.refKey, savedRefKeyCreator('abc123'));

const kitchenOnly: Recipe = { ...recipe, id: 'link-import-1', sourceType: 'web', sourceUrl: 'https://x.com/r' };
const kitchenRecord = savedRecordFromKitchenRecipe(kitchenOnly);
assert.equal(kitchenRecord.refKey, savedRefKeyKitchen('link-import-1'));

const matches = buildPantryMatchIndex([recipe], []);
const rows = buildSavedRecipeFeedRows([record], [recipe], [], matches);
assert.equal(rows.length, 1);
assert.equal(rows[0]?.recipe.name, 'Teriyaki Chicken');

console.log('saved-recipes-check: ok');
