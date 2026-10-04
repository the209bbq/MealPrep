import { amountToOunces, parsePackageSizeFromText, type ProductPackageSize } from '../deals/packagePricing';
import { gramsEachForEntry, gramsPerCupForEntry } from './eachWeights';
import { volumeToMl, volumeUsedFraction, isVolumeUnit, canonicalVolumeUnit } from './volumeUnits';
import type { BasePriceEntry } from './types';

const G_PER_OZ = 28.3495;
const G_PER_LB = 453.592;
const ML_PER_CUP = 236.588;

function normalizeMassUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === 'gram' || u === 'grams' || u === 'g') return 'g';
  if (u === 'kilogram' || u === 'kilograms' || u === 'kg') return 'kg';
  if (u === 'ounce' || u === 'ounces' || u === 'oz') return 'oz';
  if (u === 'pound' || u === 'pounds' || u === 'lbs' || u === 'lb') return 'lb';
  return u;
}

function isCountUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  return (
    u === 'each' ||
    u === 'ea' ||
    u === 'ct' ||
    u === 'count' ||
    u === 'whole' ||
    u === 'piece' ||
    u === 'pc' ||
    u === 'can' ||
    u === 'jar' ||
    u === 'head' ||
    u === 'bunch' ||
    u === 'stick' ||
    u === 'slice' ||
    u === 'clove' ||
    u === 'package'
  );
}

function massToGrams(quantity: number, unit: string): number | null {
  const u = normalizeMassUnit(unit);
  if (u === 'g') return quantity;
  if (u === 'kg') return quantity * 1000;
  if (u === 'oz') return quantity * G_PER_OZ;
  if (u === 'lb') return quantity * G_PER_LB;
  return null;
}

function packageMassGrams(packageSize: ProductPackageSize): number | null {
  const g = massToGrams(packageSize.amount, packageSize.unit);
  if (g != null) return g;
  const oz = amountToOunces(packageSize.amount, packageSize.unit);
  if (oz != null) return oz * G_PER_OZ;
  return null;
}

function usedAmountInPackageUnits(input: {
  quantity: number;
  unit: string;
  packageSize: ProductPackageSize;
  gramsPerCup?: number;
  gramsEach?: number;
  sizeScale?: number;
}): number | null {
  const { quantity, unit, packageSize, gramsPerCup, gramsEach, sizeScale = 1 } = input;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const needU = unit.trim() ? canonicalVolumeUnit(unit) : 'each';
  const pkgU = canonicalVolumeUnit(packageSize.unit);

  if (needU === 'dozen') {
    const eachCount = quantity * 12;
    if (packageSize.unit === 'dozen') return eachCount / (packageSize.amount * 12);
    if (isCountUnit('each') && isCountUnit(packageSize.unit)) {
      return eachCount / packageSize.amount;
    }
  }

  const volFrac = volumeUsedFraction(quantity, needU, packageSize.amount, packageSize.unit);
  if (volFrac != null) return volFrac;

  if (isVolumeUnit(needU) && isVolumeUnit(pkgU)) {
    return volumeUsedFraction(quantity, needU, packageSize.amount, packageSize.unit);
  }

  if (isVolumeUnit(needU) && gramsPerCup != null && gramsPerCup > 0) {
    const needMl = volumeToMl(quantity, needU);
    if (needMl != null) {
      const needGrams = (needMl / ML_PER_CUP) * gramsPerCup;
      const pkgGrams = packageMassGrams(packageSize);
      if (pkgGrams != null && pkgGrams > 0) return needGrams / pkgGrams;
    }
  }

  if (isCountUnit(needU) && gramsEach != null && gramsEach > 0) {
    const needGrams = quantity * gramsEach * sizeScale;
    const pkgGrams = packageMassGrams(packageSize);
    if (pkgGrams != null && pkgGrams > 0) return needGrams / pkgGrams;
  }

  if (needU === 'clove' && (packageSize.unit === 'each' || packageSize.unit === 'head')) {
    const CLOVES_PER_HEAD = 10;
    return quantity / (packageSize.amount * CLOVES_PER_HEAD);
  }

  if (isCountUnit(needU) && isCountUnit(packageSize.unit)) {
    if (packageSize.unit === 'dozen') return quantity / (packageSize.amount * 12);
    return quantity / packageSize.amount;
  }

  const needOz = amountToOunces(quantity, needU);
  const pkgOz = amountToOunces(packageSize.amount, packageSize.unit);
  if (needOz != null && pkgOz != null && pkgOz > 0) return needOz / pkgOz;

  const needG = massToGrams(quantity, needU);
  const pkgG = packageMassGrams(packageSize);
  if (needG != null && pkgG != null && pkgG > 0) return needG / pkgG;

  return null;
}

export function proratedPackageCost(input: {
  quantity: number;
  unit: string;
  packageAmount: number;
  packageUnit: string;
  packagePrice: number;
  gramsPerCup?: number;
  gramsEach?: number;
  sizeScale?: number;
  rememberedSizeUnit?: string;
  baseEntry?: BasePriceEntry;
}): number | null {
  let packageSize: ProductPackageSize = {
    amount: input.packageAmount,
    unit: input.packageUnit,
  };
  if (input.rememberedSizeUnit?.trim()) {
    const parsed = parsePackageSizeFromText(input.rememberedSizeUnit);
    if (parsed) packageSize = parsed;
  }

  const gramsEach =
    input.gramsEach ??
    (input.baseEntry ? gramsEachForEntry(input.baseEntry) : undefined);

  const gramsPerCup =
    input.gramsPerCup ??
    (input.baseEntry ? gramsPerCupForEntry(input.baseEntry) : undefined);

  const fraction = usedAmountInPackageUnits({
    quantity: input.quantity,
    unit: input.unit,
    packageSize,
    gramsPerCup,
    gramsEach,
    sizeScale: input.sizeScale,
  });
  if (fraction == null || !Number.isFinite(fraction) || fraction <= 0) return null;
  return Math.round(input.packagePrice * fraction * 100) / 100;
}

export function packageSizeFromBaseEntry(entry: BasePriceEntry): ProductPackageSize {
  return { amount: entry.packageAmount, unit: entry.packageUnit };
}
