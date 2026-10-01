/**
 * Add-price suggestion ordering regression.
 * Run from mobile/: npx tsx scripts/add-price-suggestions-check.ts
 */

import { buildAddPriceItemSuggestions } from '../lib/smartShop/addPriceSuggestions';
import type { GroceryListItem } from '../types/mealprep';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const items: GroceryListItem[] = [
  {
    id: 'a',
    ingredientId: 'i-a',
    name: 'Eggs',
    category: 'dairy',
    quantity: 1,
    unit: 'dozen',
    checked: false,
    sourceRecipeIds: [],
  },
  {
    id: 'b',
    ingredientId: 'i-b',
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'gal',
    checked: false,
    sourceRecipeIds: [],
  },
];

const suggestions = buildAddPriceItemSuggestions({
  groceryItems: items,
  storeKey: 'kroger',
  storeId: 'store-1',
  communityDeals: [
    {
      id: 'd1',
      storeKey: 'kroger',
      itemName: 'Milk',
      price: 3.99,
      reportedBy: 'u1',
      createdAt: new Date().toISOString(),
      confirmCount: 0,
      expiredCount: 0,
    },
  ],
});

assert(suggestions[0]?.item.id === 'a', 'unpriced list items should sort first');
assert(suggestions[1]?.item.id === 'b', 'priced items should follow');
assert(suggestions[0]?.hasPriceAtStore === false, 'eggs should be unpriced');
assert(suggestions[1]?.hasPriceAtStore === true, 'milk should match community deal');

console.log('add-price-suggestions-check: ok');
