import assert from 'node:assert/strict';
import {
  formatIngredientAmount,
  formatIngredientText,
  formatQuantity,
  formatQuantityWithUnit,
} from '../lib/formatQuantity';

assert.equal(formatQuantity(0.5), '½');
assert.equal(formatQuantity(0.33), '⅓');
assert.equal(formatQuantity(0.67), '⅔');
assert.equal(formatQuantity(1.5), '1½');
assert.equal(formatQuantity(2.25), '2¼');
assert.equal(formatQuantity(0.125), '⅛');
assert.equal(formatQuantity(3), '3');
assert.equal(formatQuantity(2.98), '3');
assert.equal(formatQuantity(1.333), '1⅓');

assert.equal(formatQuantityWithUnit(250, 'g'), '250 g');
assert.equal(formatIngredientText('0.75 cup flour'), '¾ cup flour');
assert.equal(formatIngredientText('no decimals here'), 'no decimals here');

assert.equal(formatIngredientAmount(0.5, 'cup', 'flour'), '½ cup flour');
assert.equal(formatIngredientAmount(0, '', '0.5 cup sugar'), '½ cup sugar');

console.log('format-quantity-check: ok');
