import type { BasePriceEntry } from './types';
import { canonicalCountUnit } from './countUnits';
import { canonicalVolumeUnit, isVolumeUnit } from './volumeUnits';

export interface AuditSampleAmount {
  quantity: number;
  unit: string;
}

/** One sensible recipe amount to verify pricing for a base-table row. */
export function sampleRecipeAmountForEntry(entry: BasePriceEntry): AuditSampleAmount {
  const pkgU = entry.packageUnit.trim().toLowerCase();

  if (pkgU === 'dozen' || pkgU === 'dz') {
    return { quantity: 2, unit: 'each' };
  }

  const countU = canonicalCountUnit(pkgU);
  if (countU === 'each') {
    return { quantity: 1, unit: 'each' };
  }
  if (['bunch', 'head', 'can', 'jar', 'bottle', 'loaf', 'stick', 'slice', 'package', 'clove'].includes(countU)) {
    return { quantity: 1, unit: countU };
  }

  if (pkgU === 'lb' || pkgU === 'lbs') {
    if (entry.id === 'butter') {
      return { quantity: 2, unit: 'tbsp' };
    }
    return { quantity: 0.5, unit: 'lb' };
  }

  if (pkgU === 'oz' || pkgU === 'ounces') {
    const hasCupDensity =
      entry.gramsPerCup != null ||
      entry.id.startsWith('frozen_') ||
      /\bfrozen\b/i.test(entry.name);
    if (hasCupDensity) {
      return { quantity: 1, unit: 'cup' };
    }
    return { quantity: 4, unit: 'oz' };
  }

  if (pkgU === 'floz' || pkgU === 'fl oz') {
    return { quantity: 2, unit: 'tbsp' };
  }

  if (pkgU === 'gal' || pkgU === 'gallon') {
    return { quantity: 1, unit: 'cup' };
  }

  if (pkgU === 'qt' || pkgU === 'quart') {
    return { quantity: 0.5, unit: 'cup' };
  }

  if (pkgU === 'pt' || pkgU === 'pint') {
    return { quantity: 0.25, unit: 'cup' };
  }

  if (pkgU === 'g' || pkgU === 'gram' || pkgU === 'grams') {
    return { quantity: 100, unit: 'g' };
  }

  if (pkgU === 'kg') {
    return { quantity: 200, unit: 'g' };
  }

  if (isVolumeUnit(pkgU)) {
    return { quantity: 2, unit: 'tbsp' };
  }

  return { quantity: 1, unit: canonicalVolumeUnit(pkgU) || 'each' };
}
