import assert from 'node:assert/strict';
import {
  buildRecipeImagePrompt,
  type ImagePromptRecipe,
} from '../lib/libraryRecipes/imagePrompt';

function baseRecipe(overrides: Partial<ImagePromptRecipe>): ImagePromptRecipe {
  return {
    title: 'Test Dish',
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

const porkChops = baseRecipe({
  title: 'Pork Chops with Dry Rub',
  ingredients: [
    { name: 'pork chops', quantity: 4, unit: 'each' },
    { name: 'brown sugar', quantity: 2, unit: 'tbsp' },
    { name: 'smoked paprika', quantity: 1, unit: 'tbsp' },
    { name: 'garlic powder', quantity: 1, unit: 'tsp' },
  ],
  steps: [
    'Mix dry rub and coat chops.',
    'Grill 6 minutes per side.',
    'Rest and serve on a platter with parsley.',
  ],
});

const porkPrompt = buildRecipeImagePrompt(porkChops);
assert.match(porkPrompt, /not breaded/i);
assert.match(porkPrompt, /pork chops/i);

const meatballs = baseRecipe({
  title: 'Classic Meatballs',
  ingredients: [
    { name: 'ground beef', quantity: 1, unit: 'lb' },
    { name: 'egg', quantity: 1, unit: 'each' },
    { name: 'parmesan', quantity: 0.25, unit: 'cup' },
  ],
  steps: ['Bake meatballs until browned.', 'Serve warm on a plate with marinara on the side.'],
});

const meatPrompt = buildRecipeImagePrompt(meatballs);
assert.match(meatPrompt, /no pasta/i);
assert.match(meatPrompt, /not served on spaghetti/i);

console.log('library-image-prompt-check: ok');
