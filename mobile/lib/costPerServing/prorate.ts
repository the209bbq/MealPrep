import { amountToOunces, parsePackageSizeFromText, type ProductPackageSize } from '../deals/packagePricing';
import { convertQuantity, normalizeUnit, unitKind } from '../units/conversion';
import { gramsPerCupForKey } from './densities';

function packageSizeFromText(text: string): ProductPackageSize | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = parsePackageSizeFromText(trimmed);
  if (parsed) return parsed;
  const simple = /^(\d+(?:\.\d+)?)\s*(\S+)$/.exec(trimmed);
  if (simple) {
    const amount = Number.parseFloat(simple[1] ?? '');
    const unit = simple[2] ?? 'each';
    if (Number.isFinite(amount) && amount > 0) return { amount, unit };
  }
  return null;
}

function amountInOunces(quantity: number, unit: string): number | null {
  return amountToOunces(quantity, unit);
}

function volumeToMassOz(volumeQty: number, volumeUnit: string, gramsPerCup: number): number | null {
  const ml = convertQuantity(volumeQty, volumeUnit, 'cup');
  if (ml === null) return null;
  const grams = ml * gramsPerCup;
  return amountToOunces(grams, 'g');
}

/**
 * Fraction of one retail package consumed (can exceed 1 when recipe needs more than one package).
 */
export function fractionOfPackageUsed(
  neededQuantity: number,
  neededUnit: string,
  packageSize: ProductPackageSize,
  densityKey?: string,
): number | null {
  if (!Number.isFinite(neededQuantity) || neededQuantity <= 0) return null;
  const pkgAmount = packageSize.amount;
  const pkgUnit = packageSize.unit;
  if (!Number.isFinite(pkgAmount) || pkgAmount <= 0) return null;

  const needU = normalizeUnit(neededUnit);
  const pkgU = normalizeUnit(pkgUnit);

  const direct = convertQuantity(neededQuantity, needU, pkgU);
  if (direct !== null) return direct / pkgAmount;

  const needKind = unitKind(needU);
  const pkgKind = unitKind(pkgU);
  if (needKind && pkgKind && needKind === pkgKind) {
    const needOz = amountInOunces(neededQuantity, needU);
    const pkgOz = amountInOunces(pkgAmount, pkgU);
    if (needOz !== null && pkgOz !== null && pkgOz > 0) return needOz / pkgOz;
  }

  if (densityKey && needKind === 'volume' && pkgKind === 'mass') {
    const gpc = gramsPerCupForKey(densityKey);
    if (gpc) {
      const needOz = volumeToMassOz(neededQuantity, needU, gpc);
      const pkgOz = amountInOunces(pkgAmount, pkgU);
      if (needOz !== null && pkgOz !== null && pkgOz > 0) return needOz / pkgOz;
    }
  }
  if (densityKey && needKind === 'mass' && pkgKind === 'volume') {
    const gpc = gramsPerCupForKey(densityKey);
    if (gpc) {
      const needOz = amountInOunces(neededQuantity, needU);
      const pkgVolCups = convertQuantity(pkgAmount, pkgU, 'cup');
      if (needOz !== null && pkgVolCups !== null && pkgVolCups > 0) {
        const pkgOz = volumeToMassOz(pkgVolCups, 'cup', gpc);
        if (pkgOz !== null && pkgOz > 0) return needOz / pkgOz;
      }
    }
  }

  if (needU === 'each' || needU === 'count' || pkgU === 'each' || pkgU === 'count') {
    if (needU === pkgU) return neededQuantity / pkgAmount;
  }

  return null;
}

export function proratedPackageCost(
  neededQuantity: number,
  neededUnit: string,
  packageSize: ProductPackageSize,
  packagePrice: number,
  densityKey?: string,
): number | null {
  const fraction = fractionOfPackageUsed(neededQuantity, neededUnit, packageSize, densityKey);
  if (fraction === null) return null;
  return Math.round(fraction * packagePrice * 100) / 100;
}

export function packageSizeFromDealUnit(unit: string | undefined, itemName: string): ProductPackageSize | null {
  if (unit?.trim()) {
    const fromUnit = packageSizeFromText(unit);
    if (fromUnit) return fromUnit;
  }
  return packageSizeFromText(itemName);
}
