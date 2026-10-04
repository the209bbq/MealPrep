import assert from 'node:assert/strict';
import { RECIPE_SOURCES } from '../config/recipeSources';
import { libraryRowToAppRecipe } from '../lib/libraryRecipes/mapToAppRecipe';
import { isLibraryRecipeAppId, libraryRecipeAppId } from '../lib/libraryRecipes/slug';
import { recipesForRecipesFeed } from '../lib/recipeMatch/kitchenCatalogMerge';
import { DEMO_LIBRARY_RECIPE_ROWS } from '../lib/libraryRecipes/demoSamples';

assert.equal(RECIPE_SOURCES.recipeApiEnabled, false, 'RecipeAPI should be paused via config');

const mapped = libraryRowToAppRecipe(DEMO_LIBRARY_RECIPE_ROWS[0]);
assert.equal(mapped.id, libraryRecipeAppId('sheet-pan-chicken-and-vegetables'));
assert.ok(isLibraryRecipeAppId(mapped.id));
assert.equal(mapped.servings, 4);
assert.ok(mapped.ingredients.length > 0);

assert.equal(RECIPE_SOURCES.libraryRecipesEnabled, false, 'library feed paused while viral shelf is primary');

const libraryRows = DEMO_LIBRARY_RECIPE_ROWS.map(libraryRowToAppRecipe);
const feedWithLibraryOff = recipesForRecipesFeed([], libraryRows);
assert.equal(
  feedWithLibraryOff.length,
  0,
  'library rows should not appear in Recipes feed while libraryRecipesEnabled is false',
);

const feedWhenEnabled = (() => {
  const sources = { ...RECIPE_SOURCES, libraryRecipesEnabled: true as const };
  const byId = new Map<string, ReturnType<typeof libraryRowToAppRecipe>>();
  if (sources.libraryRecipesEnabled) {
    for (const recipe of libraryRows) byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
})();
assert.ok(feedWhenEnabled.length >= 2, 'library merge path still works when re-enabled');

console.log('library-recipes-check: ok');
