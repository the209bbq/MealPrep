/**
 * Unit checks for manual grocery aisle inference.
 * Run from mobile/: npx tsx scripts/grocery-categorize-check.ts
 */

import { communityDealsForGroceryList } from '../lib/communityDeals/filterDeals';
import { inferGroceryCategoryFromName } from '../lib/grocery/categorize';
import type { GroceryListItem } from '../types/mealprep';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const dryGoods = ['rice', 'brown rice', 'pasta', 'spaghetti', 'oats', 'flour', 'black beans', 'lentils', 'quinoa'];
for (const name of dryGoods) {
  assert(inferGroceryCategoryFromName(name) === 'dry_goods', `${name} → dry_goods`);
}

assert(inferGroceryCategoryFromName('chicken breast') === 'meats', 'chicken → meats');
assert(inferGroceryCategoryFromName('milk') === 'dairy', 'milk → dairy');
assert(inferGroceryCategoryFromName('frozen peas') === 'frozen', 'frozen → frozen');
assert(inferGroceryCategoryFromName('soy sauce') === 'condiments', 'soy sauce → condiments');
assert(inferGroceryCategoryFromName('cumin') === 'spices', 'cumin → spices');
assert(inferGroceryCategoryFromName('spinach') === 'produce', 'spinach → produce');

const riceOnly: GroceryListItem[] = [
  {
    id: 'rice-1',
    ingredientId: 'rice',
    name: 'rice',
    category: 'dry_goods',
    quantity: 1,
    unit: 'lb',
    checked: false,
    sourceRecipeIds: [],
    origin: 'manual',
    plannedMealLinks: [],
  },
];

const sampleDeal = {
  id: 'sample-1',
  storeKey: 'save_mart',
  itemName: 'boneless chicken breast',
  price: 1.99,
  unit: 'lb',
  reportedBy: 'demo',
  createdAt: new Date().toISOString(),
  confirmCount: 0,
  expiredCount: 0,
  isSample: true,
};

assert(
  communityDealsForGroceryList([sampleDeal], riceOnly).length === 0,
  'sample deals should not appear when they do not match the list',
);

console.log('Grocery categorize checks passed.');
