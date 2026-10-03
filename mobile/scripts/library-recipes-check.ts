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

const feed = recipesForRecipesFeed([], DEMO_LIBRARY_RECIPE_ROWS.map(libraryRowToAppRecipe));
assert.ok(feed.length >= 2, 'library recipes should appear in feed merge');

console.log('library-recipes-check: ok');
