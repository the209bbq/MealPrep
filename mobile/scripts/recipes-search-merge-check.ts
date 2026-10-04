import assert from 'node:assert/strict';
import type { Recipe } from '../types/mealprep';
import type { RecipesTabRow } from '../config/recipesTabFilters';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { CreatorVideoItem } from '../lib/creatorVideos/types';
import { buildCreatorFeedCardModels } from '../lib/recipes/creatorFeedRows';
import { mergeRecipeSearchResults } from '../lib/recipes/mergeSearchResults';

function matchStub(recipeId: string): RecipePantryMatch {
  return {
    recipeId,
    recipeName: recipeId,
    totalIngredients: 3,
    matchedCount: 1,
    missingCount: 2,
    percentMatch: 33,
    matched: [],
    missing: [],
  };
}

const classicRow: RecipesTabRow = {
  kind: 'kitchen',
  recipe: {
    id: 'mealdb-1',
    name: 'Tomato Pasta',
    tag: 'Classic',
    description: '',
    servings: 4,
    minutes: 25,
    calories: 400,
    protein: 12,
    carbs: 60,
    fat: 8,
    ingredients: [],
    steps: [],
    isMaster: false,
    createdAt: '',
  },
  match: matchStub('mealdb-1'),
};

const video: CreatorVideoItem = {
  videoId: 'vid001',
  channelId: 'UCdemo',
  creatorName: 'Test Chef',
  creatorHandle: '@testchef',
  creatorAvatarUrl: null,
  channelUrl: 'https://www.youtube.com/@testchef',
  title: 'Creamy Tomato Pasta',
  descriptionSnippet: 'dinner recipe',
  thumbnailUrl: 'https://i.ytimg.com/vi/vid001/hqdefault.jpg',
  publishedAt: '2026-01-01T00:00:00Z',
  viewCount: 1000,
  likeCount: 50,
  durationSeconds: 600,
  isShort: false,
  watchUrl: 'https://www.youtube.com/watch?v=vid001',
};

const pantryIndex = { byRecipeId: new Map<string, RecipePantryMatch>() };
const models = buildCreatorFeedCardModels([video], [] as Recipe[], pantryIndex);
const merged = mergeRecipeSearchResults([classicRow], models);

assert.equal(merged.length, 2);
assert.equal(merged[0]!.kind === 'classic' || merged[0]!.kind === 'creator_video', true);
assert.ok(merged.some((item) => item.kind === 'classic'));
assert.ok(merged.some((item) => item.kind === 'creator_video'));

const deduped = mergeRecipeSearchResults([classicRow], models);
assert.equal(deduped.length, 2);

console.log('recipes-search-merge-check: ok');
