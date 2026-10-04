import type { RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import type { ViralRecipeLinkItem } from '../viralRecipes/types';

export const MOCK_VIDEO_ITEM: ViralRecipeLinkItem = {
  videoId: 'mock-honey-garlic-chicken',
  category: 'quick',
  title: 'Honey Garlic Chicken Skillet',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  channelId: 'mock-channel',
  channelTitle: 'Weeknight Bites',
  channelUrl: 'https://www.youtube.com/@weeknightbites',
  watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  viewCount: 1_240_000,
  publishedAt: '2026-03-15T12:00:00Z',
};

export const MOCK_VIDEO_RECIPE: Recipe = {
  id: 'mock-imported-video-recipe',
  name: 'Honey Garlic Chicken Skillet',
  tag: 'YouTube',
  description: 'One-pan dinner with pantry-friendly staples.',
  servings: 4,
  minutes: 28,
  calories: 420,
  protein: 38,
  carbs: 12,
  fat: 22,
  ingredients: [
    { ingredientId: 'ing-1', name: 'Chicken thighs', quantity: 1.5, unit: 'lb' },
    { ingredientId: 'ing-2', name: 'Honey', quantity: 3, unit: 'tbsp' },
    { ingredientId: 'ing-3', name: 'Garlic cloves', quantity: 4, unit: 'each' },
    { ingredientId: 'ing-4', name: 'Soy sauce', quantity: 2, unit: 'tbsp' },
    { ingredientId: 'ing-5', name: 'Broccoli florets', quantity: 2, unit: 'cups' },
  ],
  steps: [
    'Pat chicken dry and season with salt and pepper.',
    'Sear chicken in a hot skillet until golden, then set aside.',
    'Sauté garlic 30 seconds, then stir in honey and soy sauce.',
    'Return chicken, simmer until sauce thickens and chicken cooks through.',
    'Add broccoli for the last 3 minutes; serve over rice if you like.',
  ],
  isMaster: false,
  createdAt: '',
  sourceUrl: MOCK_VIDEO_ITEM.watchUrl,
  sourceType: 'youtube',
  sourceChannelName: MOCK_VIDEO_ITEM.channelTitle,
  sourceChannelUrl: MOCK_VIDEO_ITEM.channelUrl,
  imageUrl: MOCK_VIDEO_ITEM.thumbnailUrl,
};

export const MOCK_VIDEO_MATCH: RecipePantryMatch = {
  recipeId: MOCK_VIDEO_RECIPE.id,
  recipeName: MOCK_VIDEO_RECIPE.name,
  totalIngredients: MOCK_VIDEO_RECIPE.ingredients.length,
  matchedCount: 3,
  missingCount: 2,
  percentMatch: 60,
  matched: [],
  missing: MOCK_VIDEO_RECIPE.ingredients.slice(3),
};
