import assert from 'node:assert/strict';
import type { Recipe } from '../types/mealprep';
import {
  VIRAL_RECIPES_FEED_MODES,
  VIRAL_RECIPES_FEED_MODE_LABELS,
  isClassicRecipesFeedMode,
  isViralRecipesCategory,
} from '../config/viralRecipes';
import { MEALDB_COPY } from '../config/mealdb';
import { findKitchenRecipeBySourceUrl, recipeSourceUrlKey } from '../lib/recipes/recipeSourceUrl';
import {
  buildViralFeedCardModels,
  stubKitchenRecipeFromViralItem,
} from '../lib/recipes/viralFeedRows';
import type { ViralRecipeLinkItem } from '../lib/viralRecipes/types';
import { buildPantryMatchIndex } from '../lib/recipeMatch';

assert.equal(VIRAL_RECIPES_FEED_MODES.includes('my_recipes'), true);
assert.equal(VIRAL_RECIPES_FEED_MODES.includes('classic_recipes'), true);
assert.equal(VIRAL_RECIPES_FEED_MODE_LABELS.my_recipes, 'My recipes');
assert.equal(VIRAL_RECIPES_FEED_MODE_LABELS.classic_recipes, MEALDB_COPY.feedModeLabel);
assert.equal(isViralRecipesCategory('my_recipes'), false);
assert.equal(isViralRecipesCategory('classic_recipes'), false);
assert.equal(isClassicRecipesFeedMode('classic_recipes'), true);
assert.equal(isViralRecipesCategory('viral'), true);

assert.equal(
  recipeSourceUrlKey('https://www.youtube.com/watch?v=abc123'),
  recipeSourceUrlKey('https://youtu.be/abc123'),
);

const item: ViralRecipeLinkItem = {
  videoId: 'abc123',
  category: 'viral',
  title: 'Test viral pasta',
  channelTitle: 'Chef',
  channelUrl: 'https://www.youtube.com/@chef',
  thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
  watchUrl: 'https://www.youtube.com/watch?v=abc123',
  publishedAt: '2026-01-01T00:00:00Z',
};

const imported: Recipe = {
  ...stubKitchenRecipeFromViralItem(item),
  id: 'link-import-user-abc',
  ingredients: [{ ingredientId: 'a', name: 'pasta', quantity: 1, unit: 'lb' }],
  steps: ['Boil'],
};

assert.equal(findKitchenRecipeBySourceUrl([imported], item.watchUrl)?.id, imported.id);

const pantryIndex = buildPantryMatchIndex([imported], []);
const models = buildViralFeedCardModels([item], [imported], pantryIndex);
assert.equal(models.length, 1);
assert.equal(models[0]!.importedRecipe?.id, imported.id);
assert.equal(models[0]!.match?.missingCount, 1);

const pending = buildViralFeedCardModels([item], [], pantryIndex);
assert.equal(pending[0]!.match, null);

console.log('viral-recipes-feed-check: ok');
