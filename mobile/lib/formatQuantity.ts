const WHOLE_TOLERANCE = 0.04;
const PINCH_THRESHOLD = 1 / 16;

const COOKING_FRACTIONS: ReadonlyArray<{ value: number; char: string }> = [
  { value: 1 / 8, char: '⅛' },
  { value: 1 / 4, char: '¼' },
  { value: 1 / 3, char: '⅓' },
  { value: 3 / 8, char: '⅜' },
  { value: 1 / 2, char: '½' },
  { value: 5 / 8, char: '⅝' },
  { value: 2 / 3, char: '⅔' },
  { value: 3 / 4, char: '¾' },
  { value: 7 / 8, char: '⅞' },
];

const CURRENCY_SYMBOLS = '$£€¥₹¢';

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\.$/, '');
}

function isMetricWholeUnit(unit: string): boolean {
  const u = normalizeUnit(unit);
  return /^(g|gram|grams|mg|milligram|milligrams|ml|milliliter|milliliters|l|liter|liters)$/.test(u);
}

function isMetricKgUnit(unit: string): boolean {
  const u = normalizeUnit(unit);
  return /^(kg|kilogram|kilograms)$/.test(u);
}

function formatMetricKg(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const nearestWhole = Math.round(rounded);
  if (Math.abs(rounded - nearestWhole) <= WHOLE_TOLERANCE) {
    return String(nearestWhole);
  }
  return String(rounded);
}

function shouldUseWholeNumberDisplay(value: number, unit?: string): boolean {
  const trimmed = unit?.trim();
  if (!trimmed) {
    return Math.abs(value) >= 10;
  }
  return isMetricWholeUnit(trimmed);
}

function nearestFractionChar(remainder: number): string | null {
  let bestChar: string | null = null;
  let bestDist = Infinity;
  for (const frac of COOKING_FRACTIONS) {
    const dist = Math.abs(remainder - frac.value);
    if (dist < bestDist) {
      bestDist = dist;
      bestChar = frac.char;
    }
  }
  return bestChar;
}

function formatQuantityAsFraction(value: number): string {
  if (value === 0) return '0';

  if (value > 0 && value < PINCH_THRESHOLD) return 'pinch';

  const nearestWhole = Math.round(value);
  if (Math.abs(value - nearestWhole) <= WHOLE_TOLERANCE) {
    return String(nearestWhole);
  }

  let whole = Math.floor(value);
  let remainder = value - whole;

  if (remainder >= 1 - WHOLE_TOLERANCE) {
    return String(whole + 1);
  }

  if (remainder <= WHOLE_TOLERANCE) {
    return String(whole);
  }

  if (whole === 0 && remainder < 1 / 8) {
    if (remainder < PINCH_THRESHOLD) return 'pinch';
    return '⅛';
  }

  const fracChar = nearestFractionChar(remainder);
  if (!fracChar) return String(Math.round(value));

  if (whole === 0) return fracChar;
  return `${whole}${fracChar}`;
}

/** Format a numeric amount as a kitchen-friendly fraction (display only). */
export function formatQuantity(value: number, options?: { unit?: string }): string {
  if (!Number.isFinite(value)) return String(value);

  const unit = options?.unit?.trim();
  if (unit && isMetricKgUnit(unit)) {
    return formatMetricKg(value);
  }

  if (shouldUseWholeNumberDisplay(value, unit)) {
    return String(Math.round(value));
  }

  if (value < 0) {
    return `-${formatQuantity(-value, options)}`;
  }

  return formatQuantityAsFraction(value);
}

/** Quantity plus unit, e.g. `¾ cup` or `250 g`. */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  const trimmedUnit = unit.trim();
  if (!trimmedUnit) return formatQuantity(quantity);
  const amount = formatQuantity(quantity, { unit: trimmedUnit });
  return `${amount} ${trimmedUnit}`;
}

/** Ingredient line with structured quantity/unit and optional name. */
export function formatIngredientAmount(quantity: number, unit: string, name?: string): string {
  const trimmedName = name?.trim() ?? '';
  if (quantity > 0 && unit.trim()) {
    const amount = formatQuantityWithUnit(quantity, unit);
    return trimmedName ? `${amount} ${trimmedName}` : amount;
  }
  if (quantity > 0 && !unit.trim()) {
    const amount = formatQuantity(quantity);
    return trimmedName ? `${amount} ${trimmedName}` : amount;
  }
  return trimmedName ? formatIngredientText(trimmedName) : '';
}

function shouldFormatDecimalInIngredientText(match: string, offset: number, full: string): boolean {
  const before = full.slice(0, offset);
  const after = full.slice(offset + match.length);

  const charBefore = before.slice(-1);
  if (charBefore && CURRENCY_SYMBOLS.includes(charBefore)) return false;
  if (/[a-zA-Zv]$/.test(before)) return false;
  if (/[\d.]$/.test(before)) return false;

  if (/^\.\d/.test(after)) return false;

  if (/^\s*(degrees|degree|°\s*[fFcC]?|℉|℃|\b[fFcC]\b)/i.test(after)) return false;

  return true;
}

/**
 * Replace decimal numbers embedded in free-text ingredient lines (imports), e.g.
 * `0.75 cup flour` → `¾ cup flour`. Leaves prices, versions, and temperatures unchanged.
 */
export function formatIngredientText(text: string): string {
  if (!text || !/\d+\.\d+/.test(text)) return text;
  return text.replace(/\d+\.\d+/g, (match, offset, full) => {
    if (!shouldFormatDecimalInIngredientText(match, offset, full)) return match;
    const n = Number.parseFloat(match);
    if (!Number.isFinite(n)) return match;
    return formatQuantity(n);
  });
}
