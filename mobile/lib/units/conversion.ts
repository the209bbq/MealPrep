/** Convert pantry/recipe quantities within mass, volume, or count families. */

export type UnitKind = 'mass' | 'volume' | 'count';

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  lbs: 453.592,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  cups: 236.588,
};

const COUNT_UNITS = new Set(['each', 'ea', 'piece', 'pieces', 'bunch', 'can', 'jar', 'head', 'clove', 'cloves']);

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

export function unitKind(unit: string): UnitKind | null {
  const u = normalizeUnit(unit);
  if (!u) return null;
  if (COUNT_UNITS.has(u)) return 'count';
  if (u in MASS_TO_GRAMS) return 'mass';
  if (u in VOLUME_TO_ML) return 'volume';
  return null;
}

export function unitsAreConvertible(a: string, b: string): boolean {
  const ka = unitKind(a);
  const kb = unitKind(b);
  if (ka === null || kb === null) return false;
  return ka === kb;
}

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return quantity;

  const kind = unitKind(from);
  if (kind === null || kind !== unitKind(to)) return null;

  if (kind === 'count') {
    return quantity;
  }

  if (kind === 'mass') {
    const fromFactor = MASS_TO_GRAMS[from];
    const toFactor = MASS_TO_GRAMS[to];
    if (fromFactor === undefined || toFactor === undefined) return null;
    return (quantity * fromFactor) / toFactor;
  }

  const fromFactor = VOLUME_TO_ML[from];
  const toFactor = VOLUME_TO_ML[to];
  if (fromFactor === undefined || toFactor === undefined) return null;
  return (quantity * fromFactor) / toFactor;
}
