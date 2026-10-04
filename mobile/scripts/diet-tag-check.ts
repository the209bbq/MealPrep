/**
 * Rule-based recipe diet tagging checks.
 * Run from mobile/: npm run test:diet-tag
 */

import assert from 'node:assert/strict';
import { allergensForLine, tagRecipe } from '../lib/diet/tagRecipe';

function assertAllergens(line: string, expected: string[], message: string): void {
  const actual = allergensForLine(line).sort();
  const want = [...expected].sort();
  assert.deepEqual(actual, want, `${message}: got [${actual.join(', ')}], want [${want.join(', ')}]`);
}

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

  assertAllergens('almond milk', ['tree_nuts'], 'almond milk');
  assertAllergens('coconut milk', [], 'coconut milk');
  assertAllergens('peanut butter', ['peanuts'], 'peanut butter');
  assertAllergens('eggplant', [], 'eggplant');
  assertAllergens('butternut squash', [], 'butternut squash');
  assertAllergens('cream cheese|eggplant', ['milk'], 'cream cheese|eggplant');
  assertAllergens('soy milk', ['soy'], 'soy milk');
  assertAllergens('cashew milk', ['tree_nuts'], 'cashew milk');
  assertAllergens('cocoa butter', [], 'cocoa butter');
  assertAllergens('cream of tartar', [], 'cream of tartar');
  assertAllergens('coconut cream', [], 'coconut cream');

  const oats = tagRecipe({ ingredientLines: ['1 cup rolled oats'] });
  assert.ok(!oats.contains_allergens.includes('gluten'), 'plain oats should not be definite gluten');
  assert.ok(oats.unknown_items.length > 0, 'plain oats should be gluten-uncertain (unknown)');

  const gfOats = tagRecipe({ ingredientLines: ['1 cup gluten-free oats'] });
  assert.ok(!gfOats.contains_allergens.includes('gluten'), 'gluten-free oats should not tag gluten');
  assert.equal(gfOats.unknown_items.length, 0, 'gluten-free oats should not be unknown');

  const dairyFreeCheese = tagRecipe({ ingredientLines: ['dairy-free cheese shreds'] });
  assert.ok(!dairyFreeCheese.contains_allergens.includes('milk'), 'dairy-free cheese should not tag milk');

  function assertFishDiets(line: string, label: string): void {
    const tag = tagRecipe({ ingredientLines: [line] });
    assert.ok(!tag.diets_ok.includes('vegetarian'), `${label} should fail vegetarian`);
    assert.ok(!tag.diets_ok.includes('vegan'), `${label} should fail vegan`);
    assert.ok(tag.diets_ok.includes('pescatarian'), `${label} should pass pescatarian`);
  }

  assertFishDiets('salmon fillet', 'salmon');
  assertFishDiets('large shrimp', 'shrimp');
  assertFishDiets('1 tbsp fish sauce', 'fish sauce');

  console.log('diet-tag-check: ok');
}

main();
