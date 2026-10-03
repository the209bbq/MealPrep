/** Re-export the ingredient normalization layer (single implementation module). */
export {
  areSameIngredientForPantryDedupe,
  canonicalIngredientPhrase,
  canonicalIngredientSearchLabel,
  expandSynonymKeys,
  fuzzyNameScore,
  FUZZY_MATCH_THRESHOLD,
  ingredientMatchScore,
  INGREDIENT_SYNONYMS,
  normalizeIngredientName,
  STRIP_TOKENS,
  tokenizeIngredientName,
} from './ingredientNormalize';
