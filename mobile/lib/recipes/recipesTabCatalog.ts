import type { RecipesTabRow } from '../../config/recipesTabFilters';
import type { PantryDiscoverySuggestion } from '../recipeDiscovery/pantrySuggestions';
import { compareRecipePantryMatches, type PantryMatchIndex, type RecipePantryMatch } from '../recipeMatch';
import type { Recipe } from '../../types/mealprep';
import { dedupeRecipesTabRows } from './unifiedFeed';

function zeroKitchenMatch(recipe: Recipe): RecipePantryMatch {
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    totalIngredients: recipe.ingredients.length,
    matchedCount: 0,
    missingCount: recipe.ingredients.length,
    percentMatch: 0,
    matched: [],
    missing: recipe.ingredients,
  };
}

/**
 * Full Recipes tab catalog: built-in kitchen + account recipes + online discovery,
 * de-duplicated and sorted by pantry overlap (best matches first when pantry has items).
 */
export function buildRecipesTabCatalogRows(options: {
  kitchenRecipes: Recipe[];
  pantryMatches: PantryMatchIndex;
  discoverySuggestions: readonly PantryDiscoverySuggestion[];
}): RecipesTabRow[] {
  const { kitchenRecipes, pantryMatches, discoverySuggestions } = options;

  const kitchenRows: RecipesTabRow[] = kitchenRecipes.map((recipe) => ({
    kind: 'kitchen',
    recipe,
    match: pantryMatches.byRecipeId.get(recipe.id) ?? zeroKitchenMatch(recipe),
  }));

  const discoveryRows: RecipesTabRow[] = discoverySuggestions.map((row) => ({
    kind: 'discovery',
    recipe: row.recipe,
    match: row.match,
  }));

  const merged = dedupeRecipesTabRows([...kitchenRows, ...discoveryRows]);
  merged.sort((a, b) => compareRecipePantryMatches(a.match, b.match));
  return merged;
}
