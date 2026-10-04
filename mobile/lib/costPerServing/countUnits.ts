/** Discrete / count-style grocery units (not weight or volume). */

const EACH_LIKE = new Set([
  'each',
  'ea',
  'ct',
  'count',
  'whole',
  'piece',
  'pieces',
  'pc',
]);

const DOZEN_LIKE = new Set(['dozen', 'dz']);

const SAME_UNIT_DISCRETE = new Set([
  'bunch',
  'head',
  'can',
  'jar',
  'bottle',
  'loaf',
  'stick',
  'slice',
  'package',
  'clove',
]);

export function canonicalCountUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (!u) return 'each';
  if (EACH_LIKE.has(u)) return 'each';
  if (DOZEN_LIKE.has(u)) return 'dozen';
  if (u === 'cans') return 'can';
  if (u === 'jars') return 'jar';
  if (u === 'bottles') return 'bottle';
  if (u === 'loaves') return 'loaf';
  if (u === 'heads') return 'head';
  if (u === 'bunches') return 'bunch';
  if (u === 'cloves') return 'clove';
  if (u === 'sticks') return 'stick';
  if (u === 'slices') return 'slice';
  if (u === 'packages' || u === 'pkg') return 'package';
  return u;
}

export function isEachOrDozenUnit(unit: string): boolean {
  const u = canonicalCountUnit(unit);
  return u === 'each' || u === 'dozen';
}

export function isSameUnitDiscrete(unit: string): boolean {
  return SAME_UNIT_DISCRETE.has(canonicalCountUnit(unit));
}

/** Convert recipe/package count lines into comparable “each” units (dozen → 12 each). */
export function toComparableEachCount(quantity: number, unit: string): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const u = canonicalCountUnit(unit);
  if (u === 'dozen') return quantity * 12;
  if (u === 'each') return quantity;
  if (SAME_UNIT_DISCRETE.has(u)) return quantity;
  return null;
}

/** Package capacity in the same comparable units as {@link toComparableEachCount}. */
export function packageComparableCount(packageAmount: number, packageUnit: string): number | null {
  if (!Number.isFinite(packageAmount) || packageAmount <= 0) return null;
  const u = canonicalCountUnit(packageUnit);
  if (u === 'dozen') return packageAmount * 12;
  if (u === 'each') return packageAmount;
  if (SAME_UNIT_DISCRETE.has(u)) return packageAmount;
  return null;
}

/**
 * Fraction of a count-style package used. Handles each↔dozen and matching
 * discrete units (can/can, bunch/bunch, clove/head with garlic rules).
 */
export function countPackageUsedFraction(input: {
  quantity: number;
  unit: string;
  packageAmount: number;
  packageUnit: string;
}): number | null {
  const needU = canonicalCountUnit(input.unit);
  const pkgU = canonicalCountUnit(input.packageUnit);

  if (isEachOrDozenUnit(needU) && isEachOrDozenUnit(pkgU)) {
    const need = toComparableEachCount(input.quantity, needU);
    const pkg = packageComparableCount(input.packageAmount, pkgU);
    if (need == null || pkg == null || pkg <= 0) return null;
    return need / pkg;
  }

  if (SAME_UNIT_DISCRETE.has(needU) && needU === pkgU) {
    return input.quantity / input.packageAmount;
  }

  if (needU === 'clove' && (pkgU === 'head' || pkgU === 'each')) {
    const CLOVES_PER_HEAD = 10;
    return input.quantity / (input.packageAmount * CLOVES_PER_HEAD);
  }

  if (needU === 'each' && pkgU === 'head') {
    return input.quantity / input.packageAmount;
  }

  return null;
}

export function isRecipeCountUnit(unit: string): boolean {
  const u = canonicalCountUnit(unit);
  return isEachOrDozenUnit(u) || SAME_UNIT_DISCRETE.has(u);
}
