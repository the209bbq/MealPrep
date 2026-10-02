/**
 * Pantry ingredient matching: parity vs legacy implementation + perf budgets.
 * Run from mobile/: npm run test:recipe-match-perf
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { buildPantryMatchIndex } from '../lib/recipeMatch/match';
import { kitchenRecipesForPantryMatch } from '../lib/recipeMatch/kitchenCatalogMerge';
import * as legacy from '../lib/recipeMatch/ingredientNormalize.legacy';
import * as current from '../lib/recipeMatch/ingredientNormalize';
import type { PantryItem, Recipe, RecipeIngredient } from '../types/mealprep';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(scriptDir, '..');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function pantryFrom(names: string[]): PantryItem[] {
  return names.map((n, i) => ({
    id: `p${i}`,
    ingredientId: n.toLowerCase().replace(/\s+/g, '-'),
    name: n,
    category: 'produce' as const,
    quantity: 1,
    unit: 'each',
    storageLocation: 'pantry' as const,
    updatedAt: new Date().toISOString(),
  }));
}

const fixtureLabels = [
  'boneless chicken breast 2 lb',
  'Skippy Peanut Butter',
  'rice',
  'broccoli crown',
  'garlic bulb',
  'yellow onion',
  'ground beef',
  'cheddar',
  'marinara',
  'bell peppers tri-color',
  'jasmine rice bag',
  'canned black beans',
  'chicken thigh',
  'mozzarella',
  'pepper',
];

for (const label of fixtureLabels) {
  assert(
    legacy.canonicalIngredientPhrase(label) === current.canonicalIngredientPhrase(label),
    `phrase mismatch for ${label}`,
  );
  assert(
    legacy.expandSynonymKeys(label).slice().sort().join('|') ===
      current.expandSynonymKeys(label).slice().sort().join('|'),
    `expandSynonymKeys mismatch for ${label}`,
  );
}

for (let i = 0; i < fixtureLabels.length; i += 1) {
  for (let j = 0; j < fixtureLabels.length; j += 1) {
    const a = fixtureLabels[i];
    const b = fixtureLabels[j];
    assert(
      legacy.ingredientMatchScore(a, b) === current.ingredientMatchScore(a, b),
      `ingredientMatchScore mismatch ${a} vs ${b}`,
    );
    assert(
      legacy.fuzzyNameScore(a, b) === current.fuzzyNameScore(a, b),
      `fuzzyNameScore mismatch ${a} vs ${b}`,
    );
  }
}

const raw = JSON.parse(readFileSync(join(mobileRoot, 'test-fixtures', 'live-recipes.json'), 'utf8')) as Array<{
  slug: string;
  name: string;
  ingredients: RecipeIngredient[];
}>;

const recipes: Recipe[] = raw.slice(0, 48).map((r) => ({
  id: r.slug,
  name: r.name,
  tag: '',
  description: '',
  servings: 4,
  minutes: 30,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: r.ingredients,
  steps: [],
  isMaster: false,
  createdAt: '',
}));

const pantry = pantryFrom([
  'boneless chicken breast 2 lb',
  'rice',
  'broccoli',
  'garlic',
  'olive oil',
  'tomato sauce jar',
  'pasta penne',
  'cheddar',
  'ground beef',
  'onion',
  'bell pepper',
  'black beans canned',
]);

const kitchen = kitchenRecipesForPantryMatch(recipes.slice(0, 15));

function medianMs(run: () => void, iterations: number): number {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const kitchenMs = medianMs(() => buildPantryMatchIndex(kitchen, pantry), 7);
const onlineMs = medianMs(() => buildPantryMatchIndex(recipes, pantry), 7);

assert(kitchenMs < 20, `kitchen match budget: ${kitchenMs.toFixed(1)}ms (expected < 20ms)`);
assert(onlineMs < 150, `online match budget: ${onlineMs.toFixed(1)}ms (expected < 150ms)`);

console.log(
  `recipe-match-perf-check: ok (kitchen ${kitchenMs.toFixed(1)}ms, online ${onlineMs.toFixed(1)}ms)`,
);
