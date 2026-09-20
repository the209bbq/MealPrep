const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const store = {};
const sandbox = {
  window: {},
  console,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  Uint8Array,
  DataView,
  TextEncoder,
  URLSearchParams,
  Blob: class Blob {
    constructor(parts) { this.parts = parts; }
  },
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  document: {
    createElement() {
      return { click() {}, remove() {} };
    },
    body: { appendChild() {} }
  },
  localStorage: {
    getItem(key) { return store[key] || null; },
    setItem(key, value) { store[key] = String(value); }
  }
};
sandbox.window.MEALPREP_CONFIG = { usdaApiKey: '' };
sandbox.window = sandbox.window;

const dir = path.join(__dirname, 'New');
for (const file of ['records.js', 'nutrition.js', 'recipes.js', 'stores.js', 'workbook.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(dir, file), 'utf8'), sandbox, { filename: file });
}

const merged = sandbox.effectiveNutrition(
  { calories: 500, protein: 40, carbs: 30, fat: 10, fiber: 0, sodium: 400, potassium: 0, calcium: 0, iron: 0 },
  { calories: 510 }
);
assert.strictEqual(merged.effective.calories, 510);
assert.strictEqual(merged.origins.calories, 'input');
assert.strictEqual(merged.origins.protein, 'sourced');
assert.strictEqual(merged.effective.protein, 40);

const recipe = sandbox.hydrateRecipe({
  id: 'test-bowl',
  name: 'Test Bowl',
  tag: 'High Protein',
  description: 'Unit test',
  yieldPortions: 10,
  ingredients: [
    sandbox.normalizeIngredient({
      name: 'chicken',
      grams: 200,
      cost: 8.5,
      storeId: '',
      sourcedNutrition: { calories: 200, protein: 40, carbs: 0, fat: 4, fiber: 0, sodium: 80, potassium: 0, calcium: 0, iron: 0 },
      inputNutrition: { sodium: 90 }
    })
  ]
});
assert.strictEqual(recipe.protein, 40);
assert.strictEqual(recipe.sodium, 90);
assert.ok(Math.abs(sandbox.recipeCostPerPortion(recipe) - 0.85) < 0.001);

sandbox.addStore({
  name: 'WinCo',
  url: 'https://www.wincofoods.com',
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

const saved = sandbox.upsertSavedRecipe({
  ...recipe,
  ingredients: [
    ...recipe.ingredients,
    sandbox.normalizeIngredient({ name: 'jasmine rice', grams: 80, cost: 1.2, notes: 'bulk rice' })
  ]
});
const trip = sandbox.planShoppingTrip([saved.id], 'Test trip');
const names = trip.groups.map((group) => group.storeName).sort();
assert.ok(names.includes('WinCo'));
assert.ok(names.includes('Costco'));

const rows = sandbox.nutritionCompareRows([saved]);
const sodiumRow = rows.find((row) => row.field === 'sodium' && String(row.recipe_name).includes('chicken'));
assert.strictEqual(Number(sodiumRow.input_value), 90);
assert.strictEqual(Number(sodiumRow.sourced_value), 80);
assert.strictEqual(Number(sodiumRow.effective_value), 90);
assert.strictEqual(sodiumRow.origin, 'input');

const csv = sandbox.toCsv(['a', 'b'], [{ a: 'x', b: 'y,z' }]);
assert.ok(csv.includes('"y,z"'));
const xlsx = sandbox.buildXlsx([{ name: 'Sheet1', rows: [['hello', 'world']] }]);
assert.ok(xlsx instanceof Uint8Array);
assert.ok(xlsx.length > 100);

const records = sandbox.getRecords();
assert.ok(records.some((record) => record.kind === 'store'));
assert.ok(records.some((record) => record.source && record.timestamp));

console.log('lab tests passed');
