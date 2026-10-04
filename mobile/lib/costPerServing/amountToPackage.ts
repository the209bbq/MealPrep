import { amountToOunces, parsePackageSizeFromText, type ProductPackageSize } from '../deals/packagePricing';
import { gramsEachForEntry, gramsPerCupForEntry } from './eachWeights';
import { countPackageUsedFraction, isRecipeCountUnit, canonicalCountUnit } from './countUnits';
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

function canonicalNeedUnit(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return 'each';
  if (isRecipeCountUnit(trimmed)) return canonicalCountUnit(trimmed);
  if (isVolumeUnit(trimmed)) return canonicalVolumeUnit(trimmed);
  return trimmed.toLowerCase();
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

  const needU = canonicalNeedUnit(unit);
  const pkgU = canonicalNeedUnit(packageSize.unit);

  const countFrac = countPackageUsedFraction({
    quantity,
    unit: needU,
    packageAmount: packageSize.amount,
    packageUnit: pkgU,
  });
  if (countFrac != null) return countFrac;

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

  if (isRecipeCountUnit(needU) && gramsEach != null && gramsEach > 0) {
    const needGrams = quantity * gramsEach * sizeScale;
    const pkgGrams = packageMassGrams(packageSize);
    if (pkgGrams != null && pkgGrams > 0) return needGrams / pkgGrams;
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
