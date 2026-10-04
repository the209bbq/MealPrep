import assert from 'node:assert/strict';
import {
  isRecipeLikeVideo,
  matchesQuickFeed,
} from '../supabase/functions/creator-videos/recipeVideoFilter.ts';

const JUNK_TITLES = [
  'I Tried 100 Years of Spicy Challenges',
  'Does a Higher Price Mean a Better Blender?',
  'Our Top Knives Cost Less Than $50',
  "I'm taking a break my friends",
  'Thank you to our 3 million subscribers!',
  'Beat Bobby Flay Full Episode Recap',
  '14 Air Fryer Hacks You Need to Know',
  'I Ranked EVERY Food at Costco',
  '$1 vs $100,000 Hotel Food',
  'Why I Started Growing My Own Cigars',
];

const KEEP_TITLES = [
  'Better Than Beef Bolognese!',
  'Easy Sheet Pan Chicken with Caramelized Vegetables',
  "Chef John's Perfect One Egg Shakshuka",
  '8 Tasty 3-Ingredient Recipes | Cheap Meals',
  '$25 Grocery Challenge | 7 Cheap Dinners',
  'Budget Turkey and Pork Ragù',
  "The Best Steak Tacos You'll Ever Make",
  'Orange Chicken - Chicken Tenders',
];

for (const title of JUNK_TITLES) {
  assert.equal(
    isRecipeLikeVideo(title, ''),
    false,
    `expected junk: ${title}`,
  );
}

for (const title of KEEP_TITLES) {
  assert.equal(
    isRecipeLikeVideo(title, ''),
    true,
    `expected keep: ${title}`,
  );
}

assert.equal(
  isRecipeLikeVideo('Tuesday Night Dinner', 'Ingredients\n2 cups flour\n1 tbsp salt'),
  true,
  'description ingredients list should qualify',
);

assert.equal(matchesQuickFeed('Random chicken video', '', 120, true), false);
assert.equal(matchesQuickFeed('15 minute garlic pasta', '', 600, false), true);
assert.equal(matchesQuickFeed('Quick sheet pan salmon', '', 3600, false), true);

console.log('creator-video-filter-check: ok');
