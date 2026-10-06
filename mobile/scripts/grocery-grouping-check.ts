/**
 * Pure-logic checks for grocery day/combine grouping.
 * Run from mobile/: npx tsx scripts/grocery-grouping-check.ts
 */

import { buildGroceryList, createManualGroceryItem } from '../lib/grocery';
import {
  groupGroceryByDayAndMeal,
  mergeGroceryItemsForCombinedView,
  mergedGroceryChecked,
  pruneGroceryForRemovedMeals,
  readGroceryCombinePreference,
  writeGroceryCombinePreference,
} from '../lib/grocery/grouping';
import type { GroceryListItem, MealPlanItem, Recipe } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const recipe: Recipe = {
  id: 'tacos',
  name: 'Tacos',
  tag: '',
  description: '',
  servings: 2,
  minutes: 20,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: [
    { name: 'Onion', ingredientId: 'onion', quantity: 1, unit: 'each' },
    { name: 'Cumin', ingredientId: 'cumin', quantity: 1, unit: 'tsp' },
  ],
  steps: [],
  isMaster: true,
  createdAt: '',
};

const chili: Recipe = {
  ...recipe,
  id: 'chili',
  name: 'Chili',
  ingredients: [{ name: 'Onion', ingredientId: 'onion', quantity: 2, unit: 'each' }],
};

const mealMon: MealPlanItem = {
  id: 'meal-mon',
  recipeSlug: 'chili',
  recipeApiId: null,
  title: 'Chili',
  imageUrl: null,
  made: false,
  madeAt: null,
  addedAt: '',
  scheduledOn: '2026-10-06',
  mealSlot: 'dinner',
  leftoverOfId: null,
  linkedLeftoverId: null,
};

const mealWed: MealPlanItem = {
  ...mealMon,
  id: 'meal-wed',
  recipeSlug: 'tacos',
  title: 'Tacos',
  scheduledOn: '2026-10-08',
  mealSlot: 'dinner',
};

const built = buildGroceryList([chili, recipe], [], [], {}, [], {
  mealPlan: [mealMon, mealWed],
  userId: 'user-1',
});

assert(built.some((row) => row.plannedMealLinks[0]?.mealPlanItemId === 'meal-mon'), 'chili rows link to Monday meal');
assert(built.filter((row) => row.name === 'Onion').length === 2, 'onions are listed per meal');

const dayGroups = groupGroceryByDayAndMeal(built, [mealMon, mealWed], '2026-10-06');
assert(dayGroups.some((g) => g.isoDate === '2026-10-06'), 'has Monday group');
const monMeals = dayGroups.find((g) => g.isoDate === '2026-10-06')?.meals ?? [];
assert(monMeals.some((m) => m.header.includes('Chili')), 'Monday shows chili meal header');

const merged = mergeGroceryItemsForCombinedView(built);
const onionMerged = merged.find((line) => line.name === 'Onion');
assert(onionMerged != null && onionMerged.underlyingIds.length === 2, 'combined view merges onions');
assert(onionMerged.quantityLabel.includes('3'), 'onion quantities sum to 3 each');

const checkState = built.map((row) => ({ ...row, checked: row.name === 'Onion' && row.plannedMealLinks[0]?.mealPlanItemId === 'meal-mon' }));
assert(!mergedGroceryChecked(checkState.filter((r) => r.name === 'Onion')), 'merged onion unchecked until all checked');
const allOnionChecked = checkState.map((row) => (row.name === 'Onion' ? { ...row, checked: true } : row));
assert(mergedGroceryChecked(allOnionChecked.filter((r) => r.name === 'Onion')), 'merged onion checked when all underlying checked');

const garlicRows: GroceryListItem[] = [
  {
    id: 'g1',
    ingredientId: 'garlic',
    name: 'Garlic',
    category: 'produce',
    quantity: 1,
    unit: 'head',
    checked: false,
    sourceRecipeIds: [],
    origin: 'plan',
    plannedMealLinks: [{ mealPlanItemId: 'm1', scheduledOn: '2026-10-06', mealSlot: 'dinner', mealTitle: 'A' }],
  },
  {
    id: 'g2',
    ingredientId: 'garlic',
    name: 'Garlic',
    category: 'produce',
    quantity: 3,
    unit: 'clove',
    checked: false,
    sourceRecipeIds: [],
    origin: 'plan',
    plannedMealLinks: [{ mealPlanItemId: 'm2', scheduledOn: '2026-10-07', mealSlot: 'dinner', mealTitle: 'B' }],
  },
];
const garlicMerged = mergeGroceryItemsForCombinedView(garlicRows).find((l) => l.name === 'Garlic');
assert(garlicMerged != null && garlicMerged.quantityLabel.includes('+'), 'non-convertible units show side by side');

const manual = createManualGroceryItem({ name: 'Paper towels', quantity: 1, unit: 'each' });
const aisleOrder = mergeGroceryItemsForCombinedView([...built, manual]).map((line) => line.category);
assert(aisleOrder.indexOf('produce') < aisleOrder.indexOf('dry_goods'), 'produce sorts before dry goods');

const withManual = [...built, manual];
const otherGroup = groupGroceryByDayAndMeal(withManual, [mealMon, mealWed], '2026-10-06').find((g) => g.key === 'other');
assert(otherGroup != null && otherGroup.meals.some((m) => m.items.some((i) => i.name === 'Paper towels')), 'manual items in Other');

const checkedChiliOnion = built.find(
  (row) => row.name === 'Onion' && row.plannedMealLinks[0]?.mealPlanItemId === 'meal-mon',
)!;
const pruned = pruneGroceryForRemovedMeals(
  built.map((row) => (row.id === checkedChiliOnion.id ? { ...row, checked: true } : row)),
  ['meal-mon'],
);
assert(pruned.some((row) => row.id === checkedChiliOnion.id), 'checked items stay when meal removed');
assert(!pruned.some((row) => row.plannedMealLinks[0]?.mealPlanItemId === 'meal-mon' && !row.checked), 'unchecked mon meal rows removed');

writeGroceryCombinePreference(true);
assert(readGroceryCombinePreference() === true, 'combine preference persists locally');
writeGroceryCombinePreference(false);

console.log('Grocery grouping checks passed.');
