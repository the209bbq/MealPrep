import { amountToOunces, parsePackageSizeFromText, type ProductPackageSize } from '../deals/packagePricing';
import type { BasePriceEntry } from './types';

const ML_PER_CUP = 236.588;
const ML_PER_TBSP = 14.787;
const ML_PER_TSP = 4.929;
const G_PER_OZ = 28.3495;

function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (u === 'cups' || u === 'c') return 'cup';
  if (u === 'tablespoon' || u === 'tablespoons' || u === 'tbs') return 'tbsp';
  if (u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'pound' || u === 'pounds' || u === 'lbs' || u === 'lb.') return 'lb';
  if (u === 'gram' || u === 'grams') return 'g';
  if (u === 'kilogram' || u === 'kilograms' || u === 'kgs') return 'kg';
  if (u === 'milliliter' || u === 'milliliters') return 'ml';
  if (u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'l';
  if (u === 'fluid ounce' || u === 'fluid ounces' || u === 'fl oz' || u === 'fl-oz') return 'floz';
  if (u === 'clove' || u === 'cloves') return 'clove';
  if (u === 'can' || u === 'cans') return 'can';
  if (u === 'jar' || u === 'jars') return 'jar';
  if (u === 'bunch' || u === 'bunches') return 'bunch';
  if (u === 'slice' || u === 'slices') return 'slice';
  if (u === 'stick' || u === 'sticks') return 'stick';
  if (u === 'head' || u === 'heads') return 'head';
  if (u === 'package' || u === 'packages' || u === 'pkg') return 'package';
  if (u === 'dozen' || u === 'dz') return 'dozen';
  if (u === 'each' || u === 'ea' || u === 'ct' || u === 'count') return 'each';
  return u;
}

function volumeToMl(quantity: number, unit: string): number | null {
  const u = normalizeUnit(unit);
  if (u === 'cup') return quantity * ML_PER_CUP;
  if (u === 'tbsp') return quantity * ML_PER_TBSP;
  if (u === 'tsp') return quantity * ML_PER_TSP;
  if (u === 'floz') return quantity * 29.5735;
  if (u === 'ml') return quantity;
  if (u === 'l') return quantity * 1000;
  if (u === 'gal') return quantity * 3785.41;
  if (u === 'qt') return quantity * 946.353;
  if (u === 'pt') return quantity * 473.176;
  return null;
}

function usedAmountInPackageUnits(
  quantity: number,
  unit: string,
  packageSize: ProductPackageSize,
  gramsPerCup?: number,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const needU = normalizeUnit(unit);
  const pkgU = normalizeUnit(packageSize.unit);
  if (pkgU === 'each' || pkgU === 'count' || pkgU === 'clove' || pkgU === 'can' || pkgU === 'head') {
    if (needU === 'dozen') return quantity * 12;
    if (needU === pkgU || needU === 'each' || needU === 'count') return quantity;
    if (needU === 'clove' && (pkgU === 'each' || pkgU === 'head')) {
      const CLOVES_PER_HEAD = 10;
      return quantity / (packageSize.amount * CLOVES_PER_HEAD);
    }
    if (needU === 'slice' && pkgU === 'each') return quantity;
    return null;
  }

  if (pkgU === 'dozen' && (needU === 'each' || needU === 'count')) {
    return quantity / 12;
  }

  const needOz = amountToOunces(quantity, needU);
  const pkgOz = amountToOunces(packageSize.amount, pkgU);
  if (needOz != null && pkgOz != null && pkgOz > 0) {
    return needOz / pkgOz;
  }

  const needMl = volumeToMl(quantity, needU);
  if (needMl != null && gramsPerCup != null && gramsPerCup > 0) {
    const needGrams = (needMl / ML_PER_CUP) * gramsPerCup;
    const needOzFromDensity = needGrams / G_PER_OZ;
    if (pkgOz != null && pkgOz > 0) return needOzFromDensity / pkgOz;
    if (pkgU === 'g') return needGrams / packageSize.amount;
    if (pkgU === 'kg') return needGrams / (packageSize.amount * 1000);
  }

  if (needU === 'g' && pkgU === 'g') return quantity / packageSize.amount;
  if (needU === 'kg' && pkgU === 'kg') return quantity / packageSize.amount;
  if (needU === 'lb' && pkgU === 'lb') return quantity / packageSize.amount;
  if (needU === 'oz' && pkgU === 'oz') return quantity / packageSize.amount;

  return null;
}

export function proratedPackageCost(input: {
  quantity: number;
  unit: string;
  packageAmount: number;
  packageUnit: string;
  packagePrice: number;
  gramsPerCup?: number;
  rememberedSizeUnit?: string;
}): number | null {
  let packageSize: ProductPackageSize = {
    amount: input.packageAmount,
    unit: input.packageUnit,
  };
  if (input.rememberedSizeUnit?.trim()) {
    const parsed = parsePackageSizeFromText(input.rememberedSizeUnit);
    if (parsed) packageSize = parsed;
  }

  const fraction = usedAmountInPackageUnits(
    input.quantity,
    input.unit,
    packageSize,
    input.gramsPerCup,
  );
  if (fraction == null || !Number.isFinite(fraction) || fraction <= 0) return null;
  return Math.round(input.packagePrice * fraction * 100) / 100;
}

export function packageSizeFromBaseEntry(entry: BasePriceEntry): ProductPackageSize {
  return { amount: entry.packageAmount, unit: entry.packageUnit };
}
