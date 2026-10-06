/**
 * Regression checks for sim-week smaller bugs (#9, #14–#19, #22, #24).
 * Run from mobile/: npm run test:simweek-smaller
 */

import assert from 'node:assert/strict';
import { GROCERY_COPY } from '../config/grocery';
import { suggestStorageLocationForPantryItem } from '../config/pantryStorage';
import { shouldHideRecipeForDietPrefs } from '../lib/diet/conflicts';
import { filterStaplesForDietPrefs } from '../lib/pantry/filterStaplesForDiet';
import { STAPLE_CATALOG } from '../lib/pantry/stapleCatalog';
import { countUpcomingScheduledMeals } from '../lib/mealCalendar/groupMeals';
import { formatMealPickerHeaderDate } from '../lib/mealCalendar/formatScheduleDate';
import { recipeCategoryGroup } from '../lib/seamlessFlow/categoryGroup';
import { guessGhostDaySlot } from '../lib/seamlessFlow/ghostGuesser';
import { pickSwapPantryMatch } from '../lib/seamlessFlow/swapSuggestion';
import { emptyEngagementIndexForGhost } from '../lib/recipeRanking/engagementIndexHelpers';
import { searchTitleMatchBoost } from '../lib/recipeRanking/sortLists';
import {
  canonicalIngredientSearchLabel,
  tokenizeIngredientName,
} from '../lib/recipeMatch/ingredientNormalize';
import { ingredientNameMatchesPick, mainIngredientPickFromLabel } from '../lib/mainIngredient';
import type { UserDietPrefs } from '../lib/diet/types';
import type { RecipePantryMatch } from '../lib/recipeMatch';
import type { MealPlanItem } from '../types/mealprep';

const emptyIndex = emptyEngagementIndexForGhost(new Date('2026-10-06T12:00:00'));

assert.equal(recipeCategoryGroup({ category: 'Chicken', title: 'Bread omelette' }), 'breakfast');
assert.equal(recipeCategoryGroup({ category: 'Breakfast', title: 'Blini Pancakes' }), 'breakfast');

const friedRiceGhost = guessGhostDaySlot({
  category: 'Chicken',
  title: 'Chicken Fried Rice',
  mealPlan: [],
  todayIso: '2026-10-06',
  now: new Date('2026-10-06T18:00:00'),
  index: emptyIndex,
});
assert.equal(friedRiceGhost.group, 'main');
assert.notEqual(friedRiceGhost.slot, 'breakfast', 'Chicken Fried Rice must not ghost breakfast');
assert.equal(friedRiceGhost.slot, 'dinner', 'evening main should ghost dinner');

const friedRiceMondayMorning = guessGhostDaySlot({
  category: 'Chinese',
  title: 'Chicken Fried Rice',
  mealPlan: [],
  todayIso: '2026-10-12',
  now: new Date('2026-10-12T08:00:00'),
  index: emptyIndex,
});
assert.notEqual(friedRiceMondayMorning.slot, 'breakfast', 'fried rice at 8am must not suggest breakfast');

assert.equal(recipeCategoryGroup({ category: 'Breakfast', title: 'Boxty Breakfast' }), 'breakfast');

const ranked: RecipePantryMatch[] = [
  {
    recipeId: 'current',
    recipeName: 'Hard Recipe',
    totalIngredients: 10,
    matchedCount: 0,
    missingCount: 10,
    percentMatch: 0,
    matched: [],
    missing: [],
  },
  {
    recipeId: 'mealdb-ready',
    recipeName: 'Bread omelette',
    totalIngredients: 4,
    matchedCount: 4,
    missingCount: 0,
    percentMatch: 100,
    matched: [],
    missing: [],
  },
  {
    recipeId: 'near',
    recipeName: 'Near ready',
    totalIngredients: 10,
    matchedCount: 8,
    missingCount: 2,
    percentMatch: 80,
    matched: [],
    missing: [],
  },
];
const swap = pickSwapPantryMatch(ranked, 'current');
assert.ok(swap && swap.recipeId === 'mealdb-ready', 'swap prefers ready classic');

const nearOnly: RecipePantryMatch[] = [
  ranked[0]!,
  ranked[2]!,
];
const nearSwap = pickSwapPantryMatch(nearOnly, 'current');
assert.ok(nearSwap && nearSwap.recipeId === 'near', 'swap accepts near-ready alternative');

assert.equal(
  formatMealPickerHeaderDate('2026-10-13', '2026-10-06').includes('Oct'),
  true,
  'picker header is friendly, not raw ISO',
);

const mealPlan: MealPlanItem[] = [
  {
    id: 'past',
    recipeSlug: 'a',
    recipeApiId: null,
    title: 'Old',
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: '',
    scheduledOn: '2026-10-04',
    mealSlot: 'dinner',
    leftoverOfId: null,
    linkedLeftoverId: null,
  },
  {
    id: 'future',
    recipeSlug: 'b',
    recipeApiId: null,
    title: 'Soon',
    imageUrl: null,
    made: false,
    madeAt: null,
    addedAt: '',
    scheduledOn: '2026-10-08',
    mealSlot: 'dinner',
    leftoverOfId: null,
    linkedLeftoverId: null,
  },
];
assert.equal(countUpcomingScheduledMeals(mealPlan, '2026-10-06', 7), 1);

assert.equal(GROCERY_COPY.plannedMealsLine(1).includes('(s)'), false);
assert.equal(GROCERY_COPY.plannedMealsLine(2).includes('meals'), true);

assert.equal(suggestStorageLocationForPantryItem('Heavy cream', 'dairy'), 'fridge');
assert.equal(suggestStorageLocationForPantryItem('Yellow onion', 'produce'), 'pantry');
assert.equal(suggestStorageLocationForPantryItem('Garlic', 'produce'), 'pantry');
assert.equal(suggestStorageLocationForPantryItem('Potatoes', 'produce'), 'pantry');

assert.equal(canonicalIngredientSearchLabel('chocolate sandwich cookies'), 'chocolate sandwich cookie');
assert.equal(canonicalIngredientSearchLabel('foie gras'), 'foie gras');

const peanutPrefs: UserDietPrefs = {
  diets: [],
  allergens: ['peanuts'],
  dislikes: [],
  hideConflicts: true,
};
assert.ok(shouldHideRecipeForDietPrefs(peanutPrefs, ['Pad Thai with peanuts']));
const staples = filterStaplesForDietPrefs(STAPLE_CATALOG, peanutPrefs);
assert.ok(!staples.some((row) => row.id === 'peanut_butter'));

assert.ok(searchTitleMatchBoost('Chicken Fried Rice', 'Chicken Fried Rice') > 5000);
assert.ok(
  ingredientNameMatchesPick('eggs', mainIngredientPickFromLabel('egg')),
  'cook-with egg matches eggs',
);
assert.ok(
  ingredientNameMatchesPick('cheddar', mainIngredientPickFromLabel('cheddar cheese')),
  'cheddar cheese filter matches cheddar ingredient',
);

console.log('simweek-smaller-bugs-check: ok');
