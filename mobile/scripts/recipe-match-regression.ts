/**
 * Regression checks for pantry ↔ recipe matching, Made-it deductions, and grocery merge.
 * Run from mobile/: npm run test:recipe-match
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPantryDeductionLines, applyPantryDeductions } from '../lib/mealPlan/pantryDeduction';
import { mergeGroceryWithMissing } from '../lib/recipeMatch/groceryFromMissing';
import { buildPantryMatchIndex, filterRankedMatches, scoreRecipeAgainstPantry } from '../lib/recipeMatch/match';
import { expandSynonymKeys, fuzzyNameScore } from '../lib/recipeMatch/normalize';
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

function ing(names: string[]): RecipeIngredient[] {
  return names.map((n) => ({
    name: n,
    ingredientId: n.toLowerCase().replace(/\s+/g, '-'),
    quantity: 1,
    unit: 'each',
  }));
}

// --- expandSynonymKeys must not grant every synonym group to every name ---
const garlicKeys = expandSynonymKeys('garlic');
assert(!garlicKeys.some((k) => k.includes('rice')), 'garlic should not expand to rice synonyms');

// --- fuzzy matching ---
assert(fuzzyNameScore('Skippy Peanut Butter', 'peanut butter') >= 0.72, 'peanut butter brand match');
assert(fuzzyNameScore('pepper', 'Peppercorn jus') < 0.72, 'pepper must not match peppercorn jus');
assert(fuzzyNameScore('pepper', 'Peppercorns') < 0.72, 'pepper must not match peppercorns');
assert(fuzzyNameScore('apple', 'pineapple') < 0.72, 'apple must not match pineapple');
assert(fuzzyNameScore('rice', 'ice') < 0.72, 'rice must not match ice');
assert(fuzzyNameScore('chicken breast', 'Chicken broth') < 0.72, 'chicken breast vs broth');
assert(fuzzyNameScore('rice', 'Rice vinegar') < 0.72, 'rice vs rice vinegar');
assert(fuzzyNameScore('Bell pepper', 'pepper') < 0.72, 'bell pepper vs pantry pepper only');
assert(fuzzyNameScore('White pepper', 'bell pepper') < 0.72, 'white pepper vs bell pepper');

// --- live catalog repro ---
const recipesPath = join(mobileRoot, 'test-fixtures', 'live-recipes.json');
const raw = JSON.parse(readFileSync(recipesPath, 'utf8')) as Array<{
  slug: string;
  name: string;
  ingredients: RecipeIngredient[];
}>;
const recipes: Recipe[] = raw.map((r) => ({
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
  isMaster: true,
  createdAt: '',
}));

const flowPantry = pantryFrom(['chicken breast', 'rice', 'onion', 'garlic', 'bell pepper']);
const { ranked } = buildPantryMatchIndex(recipes, flowPantry);
const shown = filterRankedMatches(ranked, 'all', 50, {
  minMatchedCount: 2,
  pantryItemCount: flowPantry.length,
});
assert(shown.length >= 1 && shown.length <= 4, `flow pantry should show ~1–4 recipes, got ${shown.length}`);
assert(
  shown.some((m) => m.recipeName.includes('Lemon Herb Chicken')),
  'Grilled Lemon Herb Chicken should match flow pantry',
);
assert(
  !shown.some((m) => m.matched.some((row) => row.matchedPantryItem?.name === 'chicken breast' && row.ingredient.name.toLowerCase().includes('shrimp'))),
  'shrimp must not match chicken breast',
);

// --- Made it deduction repro ---
const lemon = recipes.find((r) => r.id === 'lemon-chicken');
assert(lemon, 'lemon-chicken fixture');
const madePantry: PantryItem[] = [
  ['chicken breast', 2, 'lb'],
  ['rice', 5, 'lb'],
  ['onion', 3, 'each'],
  ['garlic', 1, 'each'],
  ['bell pepper', 2, 'each'],
].map(([n, q, u], i) => ({
  id: `p${i}`,
  ingredientId: String(n).replace(/ /g, '-'),
  name: String(n),
  category: 'produce' as const,
  quantity: q as number,
  unit: u as string,
  storageLocation: 'pantry' as const,
  updatedAt: new Date().toISOString(),
}));

const match = scoreRecipeAgainstPantry(lemon!, madePantry);
const grocery = mergeGroceryWithMissing([], match.missing, lemon!.id, madePantry);
assert(grocery.added.some((g) => g.name.toLowerCase().includes('broccoli')), 'missing broccoli added to grocery');
assert(
  grocery.added.find((g) => g.name.toLowerCase().includes('broccoli'))?.category === 'produce',
  'broccoli grocery category should be produce',
);

const lines = buildPantryDeductionLines(match, lemon!, {}, new Set());
const { nextPantry } = applyPantryDeductions(madePantry, lines);
const chickenAfter = nextPantry.find((p) => p.name === 'chicken breast');
const riceAfter = nextPantry.find((p) => p.name === 'rice');
assert(chickenAfter && chickenAfter.quantity > 0 && chickenAfter.quantity < 2, 'chicken partially deducted in lb');
assert(riceAfter && riceAfter.quantity === 5, 'rice left unchanged when cups vs lb');

const mergeTwice = mergeGroceryWithMissing(
  grocery.items,
  [{ ...match.missing[0], quantity: 8 }],
  'other-recipe',
  madePantry,
);
const broccoliRow = mergeTwice.items.find((g) => g.name.toLowerCase().includes('broccoli'));
assert(broccoliRow && broccoliRow.quantity > 16, 'second recipe increases broccoli quantity');

console.log('Flow pantry recipes shown:', shown.map((m) => m.recipeName).join(', '));
console.log('All recipe-match regression checks passed.');
