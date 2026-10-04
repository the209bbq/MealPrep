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
  'Mystery Cooking Challenge',
  'USA vs Turkey Food',
  'I Cooked YouTubers Their Last Meals',
  '$20 vs $200 vs $300 Steak',
  'Shawarma Vs. Picanha Cooking Challenge',
  "Jackass vs. the World's Hottest Peppers",
  'We Put an Air Fryer Through 7 Cooking Challenges | Gear Heads',
  '8 Budget Kitchen Tools That Rival High-End Ones | Gear Heads',
  'The 9 Kitchen Tools Serious Home Cooks MUST Have',
  'This Robot Cooking Gadget Cooks EVERYTHING',
  'Butcher Explains Which Ground Beef to Buy',
  '8 Levels of Tasters Rate Mac and Cheese',
  'LIVE: Food Network Chefs Cozy Fall Recipes',
  "Scott's takes on controversial cooking question",
  "What Does 'Confit' Mean?",
  'How to Pick a Ripe Mango',
  "Answering the Internet's Most Asked Chicken Questions",
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
  'One $5 Chicken. Seven Days of Meals.',
  'I Fed My Family for $25 This Week',
  'The $1 Meal I Make With 1 Potato',
  'No Ice Cream Machine Needed Vanilla Ice Cream',
  'Best Steak Tacos',
  'For More Tender Fish, Poach in Oil',
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

assert.equal(
  isRecipeLikeVideo(
    'Easy Chicken Dinner',
    'Thanks for watching! We now have 5 million subscribers on this channel.',
  ),
  true,
  'subscriber boilerplate in description should not exclude',
);

assert.equal(matchesQuickFeed('Random chicken video', '', 120, true), false);
assert.equal(matchesQuickFeed('15 minute garlic pasta', '', 600, false), true);
assert.equal(matchesQuickFeed('Quick sheet pan salmon', '', 3600, false), true);

console.log('creator-video-filter-check: ok');
