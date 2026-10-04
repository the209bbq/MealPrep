import { parseMealDbMeasure } from '../mealdb/parseMeasure';
import { canonicalVolumeUnit, isVolumeUnit } from './volumeUnits';

const COUNT_UNITS = new Set([
  '',
  'each',
  'ea',
  'ct',
  'count',
  'whole',
  'piece',
  'pieces',
  'pc',
  'large',
  'medium',
  'small',
  'lg',
  'md',
  'sm',
]);

const PREP_AS_CUP = new Set(['chopped', 'diced', 'sliced', 'minced', 'grated', 'shredded', 'crushed']);

const SIZE_MULTIPLIER: Record<string, number> = {
  large: 1.25,
  lg: 1.25,
  medium: 1,
  md: 1,
  small: 0.75,
  sm: 0.75,
};

export interface NormalizedIngredientAmount {
  quantity: number;
  unit: string;
  /** Scales `gramsEach` for count-sized produce (large onion, etc.). */
  sizeScale: number;
}

function parseFractionQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map((p) => Number.parseFloat(p.trim()));
    if (parts.length === 2 && parts[0] && parts[1]) return parts[0] / parts[1];
  }
  const n = Number.parseFloat(trimmed.replace(/\s+/g, ''));
  return Number.isFinite(n) ? n : null;
}

function canonicalAmountUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (!u) return 'each';
  if (COUNT_UNITS.has(u)) return 'each';
  if (PREP_AS_CUP.has(u)) return 'cup';
  if (u === 'can' || u === 'cans') return 'can';
  if (u === 'clove' || u === 'cloves') return 'clove';
  if (u === 'head' || u === 'heads') return 'head';
  if (u === 'bunch' || u === 'bunches') return 'bunch';
  if (u === 'stick' || u === 'sticks') return 'stick';
  if (u === 'slice' || u === 'slices') return 'slice';
  if (u === 'dozen' || u === 'dz') return 'dozen';
  if (u === 'ounce' || u === 'ounces' || u === 'oz') return 'oz';
  if (u === 'pound' || u === 'pounds' || u === 'lbs' || u === 'lb') return 'lb';
  if (u === 'gram' || u === 'grams' || u === 'g') return 'g';
  if (u === 'kilogram' || u === 'kilograms' || u === 'kg') return 'kg';
  if (isVolumeUnit(u)) return canonicalVolumeUnit(u);
  return u;
}

/**
 * Normalize recipe quantity/unit, including TheMealDB-style free-text measures
 * often stored in `unit` (e.g. "1 large", "1/2 tsp", "200g", "1 can").
 */
export function normalizeIngredientAmount(quantity: number, unit: string): NormalizedIngredientAmount {
  let q = quantity;
  let rawUnit = unit.trim();
  let sizeScale = 1;

  if (rawUnit && /^[\d./]/.test(rawUnit)) {
    const parsed = parseMealDbMeasure(rawUnit);
    q = parsed.quantity;
    rawUnit = parsed.unit;
  }

  const glued = /^(\d+(?:\.\d+)?)\s*(g|kg|oz|lb|ml|l|floz|fl oz)$/i.exec(rawUnit);
  if (glued) {
    q = Number.parseFloat(glued[1] ?? '');
    rawUnit = glued[2] ?? '';
  }

  const lower = rawUnit.toLowerCase();
  if (SIZE_MULTIPLIER[lower] != null) {
    sizeScale *= SIZE_MULTIPLIER[lower];
    rawUnit = 'each';
  }

  if (lower === 'can' && q === 1) {
    rawUnit = 'can';
  }

  if (!rawUnit && q > 0) {
    rawUnit = 'each';
  }

  const canonical = canonicalAmountUnit(rawUnit);
  if (!Number.isFinite(q) || q <= 0) {
    const fallback = parseFractionQty(String(quantity));
    if (fallback != null && fallback > 0) q = fallback;
  }

  return {
    quantity: q > 0 ? q : 1,
    unit: canonical,
    sizeScale,
  };
}
