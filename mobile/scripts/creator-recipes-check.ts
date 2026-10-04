import assert from 'node:assert/strict';
import {
  CREATOR_RECIPES_FEED_MODES,
  CREATOR_RECIPES_FEED_MODE_LABELS,
  CREATOR_RECIPES_FEED_MODE_SHORT_LABELS,
  isClassicRecipesFeedMode,
  isCreatorBrowseMode,
} from '../config/creatorRecipes';
import { RECIPE_SOURCES } from '../config/recipeSources';
import { getCreatorVideosUrl, isCreatorRecipesConfigured } from '../config/appConfig';
import { compareCreatorsByFitAndSubscribers, creatorFitSortRank } from '../lib/creatorVideos/fitOrder';
import { parseSubscriberDisplayString } from '../lib/creatorVideos/parseSubscribers';
import { mergeRecipeSearchResults } from '../lib/recipes/mergeSearchResults';
import { isRecipeLikeVideo } from '../supabase/functions/creator-videos/recipeVideoFilter.ts';
import fs from 'node:fs';
import path from 'node:path';

assert.equal(RECIPE_SOURCES.creatorRecipesPrimaryFeed, true);
assert.equal(RECIPE_SOURCES.viralRecipesPrimaryFeed, false);
assert.equal(CREATOR_RECIPES_FEED_MODES.includes('popular'), true);
assert.equal(CREATOR_RECIPES_FEED_MODE_LABELS.classic_recipes, 'Classic recipes');
assert.equal(CREATOR_RECIPES_FEED_MODE_SHORT_LABELS.classic_recipes, 'Classic');
assert.equal(CREATOR_RECIPES_FEED_MODE_SHORT_LABELS.popular, 'Popular');
assert.equal(isCreatorBrowseMode('quick'), true);
assert.equal(isClassicRecipesFeedMode('classic_recipes'), true);
assert.equal(CREATOR_RECIPES_FEED_MODES.includes('my_recipes' as never), false);
assert.equal(typeof isCreatorRecipesConfigured(), 'boolean');
assert.equal(typeof getCreatorVideosUrl(), 'string');

assert.equal(isRecipeLikeVideo('Easy chicken dinner recipe', 'weeknight cook'), true);
assert.equal(isRecipeLikeVideo('My grocery haul vlog', 'shopping'), false);

assert.deepEqual(mergeRecipeSearchResults([], []), []);

assert.equal(parseSubscriberDisplayString('4.7M'), 4_700_000);
assert.equal(parseSubscriberDisplayString('892K'), 892_000);
assert.equal(creatorFitSortRank('Medium/High'), 1);
assert.equal(creatorFitSortRank('Low/Medium'), 2);

const seedPath = path.join(process.cwd(), 'supabase/migrations/20261004130000_recipe_creators_seed.sql');
assert.ok(fs.existsSync(seedPath), 'seed migration should exist');
const seedSql = fs.readFileSync(seedPath, 'utf8');
const insertCount = (seedSql.match(/\n  \(/g) ?? []).length;
assert.equal(insertCount, 39, 'seed should include 39 creators');

assert.equal(
  compareCreatorsByFitAndSubscribers(
    { fit: 'High', subscriberCount: 1 },
    { fit: 'Low', subscriberCount: 99_000_000 },
  ),
  -2,
);

console.log('creator-recipes-check: ok');
