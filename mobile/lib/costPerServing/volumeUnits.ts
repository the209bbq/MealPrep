/** US customary + metric kitchen volume conversions (liquid measure). */

export const ML_PER_TSP = 4.92892;
export const ML_PER_TBSP = 14.7868;
export const ML_PER_CUP = 236.588;
export const ML_PER_FLOZ = 29.5735;
export const ML_PER_PINT = 473.176;
export const ML_PER_QUART = 946.353;
export const ML_PER_GALLON = 3785.41;
export const ML_PER_LITER = 1000;

const VOLUME_UNITS = new Set([
  'tsp',
  'tbsp',
  'cup',
  'floz',
  'ml',
  'l',
  'pt',
  'qt',
  'gal',
]);

export function isVolumeUnit(unit: string): boolean {
  return VOLUME_UNITS.has(canonicalVolumeUnit(unit));
}

export function canonicalVolumeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (u === 'teaspoon' || u === 'teaspoons' || u === 't') return 'tsp';
  if (u === 'tablespoon' || u === 'tablespoons' || u === 'tbs' || u === 'tbl') return 'tbsp';
  if (u === 'cups' || u === 'c' || u === 'cup') return 'cup';
  if (u === 'fluid ounce' || u === 'fluid ounces' || u === 'fl oz' || u === 'fl-oz' || u === 'floz') {
    return 'floz';
  }
  if (u === 'milliliter' || u === 'milliliters') return 'ml';
  if (u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'l';
  if (u === 'pint' || u === 'pints') return 'pt';
  if (u === 'quart' || u === 'quarts') return 'qt';
  if (u === 'gallon' || u === 'gallons' || u === 'gal') return 'gal';
  return u;
}

/** Convert a kitchen volume amount to milliliters. */
export function volumeToMl(quantity: number, unit: string): number | null {
  if (!Number.isFinite(quantity)) return null;
  const u = canonicalVolumeUnit(unit);
  if (!VOLUME_UNITS.has(u)) return null;
  switch (u) {
    case 'tsp':
      return quantity * ML_PER_TSP;
    case 'tbsp':
      return quantity * ML_PER_TBSP;
    case 'cup':
      return quantity * ML_PER_CUP;
    case 'floz':
      return quantity * ML_PER_FLOZ;
    case 'ml':
      return quantity;
    case 'l':
      return quantity * ML_PER_LITER;
    case 'pt':
      return quantity * ML_PER_PINT;
    case 'qt':
      return quantity * ML_PER_QUART;
    case 'gal':
      return quantity * ML_PER_GALLON;
    default:
      return null;
  }
}

/** Convert milliliters to a target volume unit. */
export function mlToVolume(ml: number, unit: string): number | null {
  if (!Number.isFinite(ml)) return null;
  const u = canonicalVolumeUnit(unit);
  switch (u) {
    case 'tsp':
      return ml / ML_PER_TSP;
    case 'tbsp':
      return ml / ML_PER_TBSP;
    case 'cup':
      return ml / ML_PER_CUP;
    case 'floz':
      return ml / ML_PER_FLOZ;
    case 'ml':
      return ml;
    case 'l':
      return ml / ML_PER_LITER;
    case 'pt':
      return ml / ML_PER_PINT;
    case 'qt':
      return ml / ML_PER_QUART;
    case 'gal':
      return ml / ML_PER_GALLON;
    default:
      return null;
  }
}

/** Fraction of a package when both amounts are volumes (e.g. tbsp used vs floz package). */
export function volumeUsedFraction(
  usedQty: number,
  usedUnit: string,
  packageAmount: number,
  packageUnit: string,
): number | null {
  const usedMl = volumeToMl(usedQty, usedUnit);
  const pkgMl = volumeToMl(packageAmount, packageUnit);
  if (usedMl == null || pkgMl == null || pkgMl <= 0) return null;
  return usedMl / pkgMl;
}
