/**
 * Home QA round 1 (items 3–4, 8, 10–11, 13, 15–16): static UI / logic checks.
 * Run from mobile/: npm run test:home-qa1-ui
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Recipe } from '../types/mealprep';
import { CREATOR_RECIPES_COPY } from '../config/creatorRecipes';
import { RECIPE_IMPORT_COPY } from '../config/recipeImport';
import {
  buildMealPickerRecipeOptions,
  type MealPickerRecipeOption,
} from '../lib/mealCalendar/recipePickerOptions';
import {
  compareMealPickerPantryRank,
  recipeSuitsMealPickerSlot,
} from '../lib/mealCalendar/mealPickerSlotFilter';
import type { RecipePantryMatch } from '../lib/recipeMatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

function kitchenRecipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return {
    tag: partial.tag ?? 'Chicken',
    description: '',
    servings: 4,
    minutes: 30,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: partial.ingredients ?? [{ name: 'salt', quantity: 1, unit: 'tsp' }],
    steps: [],
    isMaster: true,
    createdAt: '',
    ...partial,
  };
}

assert.equal(CREATOR_RECIPES_COPY.searchPlaceholder, 'Search recipes');
assert.notEqual(
  RECIPE_IMPORT_COPY.importBoxLabel,
  RECIPE_IMPORT_COPY.importButtonAccessibility,
  'paste field and import button need distinct a11y labels',
);

const pwaRegister = fs.readFileSync(path.join(mobileRoot, 'public/pwa-register.js'), 'utf8');
assert.match(pwaRegister, /userInteracted/, 'PWA reload should respect user interaction');
assert.ok(
  !/controllerchange[\s\S]*window\.location\.reload\(\)/.test(pwaRegister) ||
    /PENDING_RELOAD_KEY/.test(pwaRegister),
  'PWA reload should only run after an explicit pending-reload flag',
);
assert.ok(
  !/updatefound[\s\S]{0,400}SKIP_WAITING/.test(pwaRegister),
  'PWA should not auto skip-waiting inside updatefound',
);

const pantryCta = fs.readFileSync(path.join(mobileRoot, 'components/home/HomePantryCta.tsx'), 'utf8');
assert.ok(!pantryCta.includes('numberOfLines'), 'pantry CTA text should not be line-clamped');

const importBox = fs.readFileSync(path.join(mobileRoot, 'components/recipes/RecipeImportBox.tsx'), 'utf8');
const cameraImportBlock = importBox.slice(
  importBox.indexOf('async function runCameraPhotoImport'),
  importBox.indexOf('async function runPhotoImport'),
);
assert.ok(
  cameraImportBlock.indexOf('setLoading(true)') > cameraImportBlock.indexOf('pickRecipeImportPhotoFromCamera'),
  'camera import should set loading only after a photo is picked',
);

const videoDetail = fs.readFileSync(path.join(mobileRoot, 'components/recipes/VideoRecipeDetailView.tsx'), 'utf8');
assert.match(
  videoDetail,
  /isImportPreview && !showLoading && !importError \?/,
  'import preview should not show placeholder servings/time block',
);
const importCtaMatches = videoDetail.match(/VIRAL_RECIPES_COPY\.getRecipeCta/g) ?? [];
assert.ok(importCtaMatches.length <= 2, 'video preview should not duplicate get-recipe CTA headings');

const visitHook = fs.readFileSync(path.join(mobileRoot, 'lib/recipesTab/useVisitSessionOnFocus.ts'), 'utf8');
assert.match(visitHook, /useHydrated/, 'visit session should wait for hydration before reading storage');

const omelette = kitchenRecipe({
  id: 'mealdb-omelette',
  name: 'Bread omelette',
  tag: 'Breakfast',
});
const boterkoek = kitchenRecipe({ id: 'mealdb-cake', name: 'Boterkoek', tag: 'Dessert' });
const aioli = kitchenRecipe({ id: 'mealdb-sauce', name: 'Aioli Garlic Sauce', tag: 'Starter' });

assert.ok(recipeSuitsMealPickerSlot(omelette, 'breakfast'));
assert.ok(!recipeSuitsMealPickerSlot(omelette, 'dinner'));
assert.ok(!recipeSuitsMealPickerSlot(boterkoek, 'dinner'));
assert.ok(!recipeSuitsMealPickerSlot(aioli, 'dinner'));

const ranked: RecipePantryMatch[] = [
  {
    recipeId: 'mealdb-partial',
    recipeName: 'Partial Pantry',
    totalIngredients: 5,
    matchedCount: 2,
    missingCount: 3,
    percentMatch: 31,
    matched: [],
    missing: [],
  },
  {
    recipeId: 'mealdb-omelette',
    recipeName: 'Bread omelette',
    totalIngredients: 3,
    matchedCount: 3,
    missingCount: 0,
    percentMatch: 100,
    matched: [],
    missing: [],
  },
];

const roastChicken = kitchenRecipe({ id: 'mealdb-chicken', name: 'Roast Chicken', tag: 'Chicken' });
const partialPantry = kitchenRecipe({ id: 'mealdb-partial', name: 'Partial Pantry', tag: 'Chicken' });

const pickerRows = buildMealPickerRecipeOptions(
  [omelette, boterkoek, aioli, roastChicken, partialPantry],
  [
    ...ranked,
    {
      recipeId: 'mealdb-chicken',
      recipeName: 'Roast Chicken',
      totalIngredients: 3,
      matchedCount: 3,
      missingCount: 0,
      percentMatch: 100,
      matched: [],
      missing: [],
    },
  ],
  20,
  new Set<string>(),
  [],
  { mealSlot: 'dinner' },
);

const dinnerTitles = pickerRows.map((row) => row.title);
assert.ok(!dinnerTitles.includes('Bread omelette'), 'breakfast dishes should be filtered from dinner picker');
assert.ok(!dinnerTitles.includes('Boterkoek'), 'dessert should be filtered from dinner picker');
assert.ok(!dinnerTitles.includes('Aioli Garlic Sauce'), 'sauce should be filtered from dinner picker');

const readyIdx = pickerRows.findIndex((row) => row.title === 'Roast Chicken');
const partialIdx = pickerRows.findIndex((row) => row.title === 'Partial Pantry');
assert.ok(readyIdx >= 0 && partialIdx >= 0 && readyIdx < partialIdx, 'ready-to-cook should sort above partial pantry match');

const searchRows = buildMealPickerRecipeOptions(
  [omelette, boterkoek],
  ranked,
  20,
  new Set<string>(),
  [],
  { mealSlot: 'dinner', includeAllForSearch: true },
);
assert.ok(
  searchRows.some((row) => row.title === 'Boterkoek'),
  'search mode should bypass slot filter',
);

const sortProbe: MealPickerRecipeOption[] = [
  {
    recipeId: 'a',
    title: 'Zeta',
    pantryPercent: 10,
    matchedCount: 1,
    missingCount: 2,
    isSaved: false,
  },
  {
    recipeId: 'b',
    title: 'Alpha',
    pantryPercent: 0,
    matchedCount: 2,
    missingCount: 0,
    isSaved: false,
  },
];
const sorted = [...sortProbe].sort(compareMealPickerPantryRank);
assert.equal(sorted[0]?.recipeId, 'b', 'ready-to-cook sorts ahead of partial matches');

console.log('home-qa1-ui-check: ok');
