/**
 * Rule-based recipe diet tagging checks.
 * Run from mobile/: npm run test:diet-tag
 */

import assert from 'node:assert/strict';
import { tagRecipe } from '../lib/diet/tagRecipe';

function main(): void {
  const butter = tagRecipe({ ingredientLines: ['2 tbsp butter'] });
  assert.ok(butter.contains_allergens.includes('milk'), 'butter should map to milk');

  const soySauce = tagRecipe({ ingredientLines: ['1 tbsp soy sauce'] });
  assert.ok(soySauce.contains_allergens.includes('soy'), 'soy sauce should map to soy');
  assert.ok(soySauce.contains_allergens.includes('wheat'), 'soy sauce should map to wheat');

  const chicken = tagRecipe({ ingredientLines: ['1 lb chicken breast'] });
  assert.ok(!chicken.diets_ok.includes('vegetarian'), 'chicken should fail vegetarian');
  assert.ok((chicken.diets_fail.vegetarian?.length ?? 0) > 0, 'chicken should list vegetarian fail');

  const honey = tagRecipe({ ingredientLines: ['2 tbsp honey'] });
  assert.ok(!honey.diets_ok.includes('vegan'), 'honey should fail vegan');

  const seasoning = tagRecipe({ ingredientLines: ['seasoning to taste'] });
  assert.ok(seasoning.unknown_items.length > 0, 'seasoning should be unknown');
  assert.equal(seasoning.contains_allergens.length, 0, 'unknown items should not assert allergens');

  const dislikes = tagRecipe({
    ingredientLines: ['1 cup cilantro', '2 limes'],
    dislikes: ['cilantro'],
  });
  assert.ok(dislikes.dislikes_hit.length > 0, 'dislikes should match cilantro');

  console.log('diet-tag-check: ok');
}

main();
