#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  packagesNeededForLine,
  parsePackageSizeFromText,
  computeLineTotal,
} from '../lib/deals/packagePricing.ts';

const pkg = parsePackageSizeFromText('Kroger Chicken Breast 24 oz');
assert.equal(packagesNeededForLine(24, 'oz', pkg), 1);
assert.equal(computeLineTotal(3.99, 1), 3.99);

const lbPkg = parsePackageSizeFromText('Chicken Breast 1 lb');
assert.equal(packagesNeededForLine(24, 'oz', lbPkg), 2);

assert.equal(packagesNeededForLine(24, 'oz', null), 1);

assert.equal(
  packagesNeededForLine(12, 'each', parsePackageSizeFromText('Large Eggs 12 ct')),
  1,
  '12 eggs vs 12-count carton',
);

assert.equal(
  packagesNeededForLine(1, 'gal', parsePackageSizeFromText('Half Gallon Milk')),
  2,
  '1 gallon vs half-gallon jug',
);

console.log('package-pricing-check: ok');
