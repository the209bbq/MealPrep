const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const memory = {};
const sandbox = {
  console,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  localStorage: {
    getItem(key) { return memory[key] || null; },
    setItem(key, value) { memory[key] = String(value); }
  }
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, 'New', 'stores.js'), 'utf8'),
  sandbox,
  { filename: 'stores.js' }
);

sandbox.getRecipes = () => [
  {
    id: 'lemon-chicken',
    name: 'Grilled Lemon Herb Chicken',
    description: 'Char-grilled chicken breast over Jasmine rice with garlic broccoli and citrus drizzle.',
    yieldPortions: 10,
    ingredients: []
  },
  {
    id: 'bowl-a',
    name: 'Bowl A',
    yieldPortions: 10,
    ingredients: [
      { id: 'ing-1', name: 'chicken', grams: 200, cost: 8, unit: 'g', storeId: '', notes: '' }
    ]
  },
  {
    id: 'bowl-b',
    name: 'Bowl B',
    yieldPortions: 10,
    ingredients: [
      { id: 'ing-2', name: 'chicken', grams: 150, cost: 6, unit: 'g', storeId: '', notes: '' },
      { id: 'ing-3', name: 'jasmine rice', grams: 80, cost: 1.2, unit: 'g', notes: 'bulk rice' }
    ]
  }
];

const winco = sandbox.addStore({
  name: 'WinCo',
  url: 'wincofoods.com',
  typicalItems: 'chicken, produce',
  notes: ''
});
sandbox.addStore({
  name: 'Costco',
  url: 'https://www.costco.com',
  searchUrlTemplate: 'https://www.costco.com/s?keyword={query}',
  typicalItems: 'rice, bulk',
  notes: ''
});

assert.strictEqual(sandbox.getStores()[0].url, 'https://wincofoods.com');

const inferred = sandbox.planShoppingTrip(['lemon-chicken'], 'Inferred menu shop');
assert.ok(inferred.groups.some((group) => group.items.length > 0), 'menu copy should yield shopping needs');
assert.strictEqual(sandbox.getTrips().length, 1);

const grouped = sandbox.planShoppingTrip(['bowl-a', 'bowl-b'], 'Two bowls');
const wincoGroup = grouped.groups.find((group) => group.storeName === 'WinCo');
const costcoGroup = grouped.groups.find((group) => group.storeName === 'Costco');
assert.ok(wincoGroup, 'chicken should group at WinCo');
assert.ok(costcoGroup, 'rice should group at Costco');
const chicken = wincoGroup.items.find((item) => item.name === 'chicken');
assert.strictEqual(chicken.grams, 350);
assert.ok(String(chicken.recipeName).includes('Bowl A'));
assert.ok(String(chicken.recipeName).includes('Bowl B'));

const checked = sandbox.setTripItemChecked(grouped.id, chicken.id, true);
assert.strictEqual(
  checked.groups.flatMap((group) => group.items).find((item) => item.id === chicken.id).checked,
  true
);
assert.strictEqual(sandbox.getTrip(grouped.id).groups.flatMap((g) => g.items).find((item) => item.id === chicken.id).checked, true);

const moved = sandbox.assignTripItemStore(grouped.id, chicken.id, '');
assert.ok(moved.groups.some((group) => group.storeId === '' && group.items.some((item) => item.id === chicken.id)));

sandbox.updateStore(winco.id, { name: 'WinCo Foods', typicalItems: 'chicken, green beans' });
assert.strictEqual(sandbox.getStores().find((store) => store.id === winco.id).name, 'WinCo Foods');

const csvRows = sandbox.shoppingExportRows(sandbox.getTrip(grouped.id));
assert.ok(csvRows[0].trip_id);
assert.ok('checked' in csvRows[0]);

console.log('shopping tests passed');
