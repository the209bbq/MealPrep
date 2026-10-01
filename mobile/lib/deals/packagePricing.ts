/** Grocery amount → package count for store line totals (price is per package/sell unit). */

const OZ_PER_LB = 16;
const G_PER_OZ = 28.3495;

export type AmountUnit = 'oz' | 'lb' | 'g' | 'kg' | 'each' | 'count' | string;

function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'ounces' || u === 'ounce') return 'oz';
  if (u === 'grams' || u === 'gram') return 'g';
  if (u === 'kilograms' || u === 'kilogram' || u === 'kgs') return 'kg';
  if (u === 'ct' || u === 'ea' || u === 'item' || u === 'items') return 'each';
  return u;
}

/** Convert a grocery amount to ounces when possible (mass); count units return null. */
export function amountToOunces(quantity: number, unit: string): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const u = normalizeUnit(unit);
  if (u === 'oz') return quantity;
  if (u === 'lb') return quantity * OZ_PER_LB;
  if (u === 'g') return quantity / G_PER_OZ;
  if (u === 'kg') return (quantity * 1000) / G_PER_OZ;
  return null;
}

export interface ProductPackageSize {
  amount: number;
  unit: string;
}

const SIZE_IN_TEXT_RE =
  /(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms)\b/i;

/** Parse a sell size from product title/description (e.g. "Chicken Breast 24 oz"). */
export function parsePackageSizeFromText(text: string): ProductPackageSize | null {
  const match = text.match(SIZE_IN_TEXT_RE);
  if (!match) return null;
  const amount = Number.parseFloat(match[1] ?? '');
  const unit = match[2] ?? '';
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit };
}

/**
 * How many store packages to buy for a grocery line. Falls back to 1 when size is unknown
 * or units cannot be converted.
 */
export function packagesNeededForLine(
  neededQuantity: number,
  neededUnit: string,
  packageSize: ProductPackageSize | null,
): number {
  if (!Number.isFinite(neededQuantity) || neededQuantity <= 0) return 1;

  const needU = normalizeUnit(neededUnit);
  if (needU === 'each' || needU === 'count') {
    return Math.max(1, Math.ceil(neededQuantity));
  }

  if (!packageSize) return 1;

  const pkgU = normalizeUnit(packageSize.unit);
  if (pkgU === 'each' || pkgU === 'count') {
    return Math.max(1, Math.ceil(neededQuantity / packageSize.amount));
  }

  const needOz = amountToOunces(neededQuantity, needU);
  const pkgOz = amountToOunces(packageSize.amount, pkgU);
  if (needOz == null || pkgOz == null || pkgOz <= 0) return 1;

  return Math.max(1, Math.ceil(needOz / pkgOz));
}

export function computeLineTotal(unitPrice: number, packages: number): number {
  return Math.round(unitPrice * packages * 100) / 100;
}

const DELI_PREPARED_RE =
  /\b(deli|sliced|prepared|cooked|rotisserie|breaded|nugget|strip|lunch\s*meat|smoked|honey\s*ham)\b/i;
const FRESH_RAW_RE = /\b(fresh|raw|boneless|skinless|breast|thigh|whole)\b/i;

/** Prefer raw/fresh grocery matches over deli/prepared when scores are close. */
export function scoreProductTitleForGrocery(searchTerm: string, productTitle: string): number {
  const title = productTitle.toLowerCase();
  const term = searchTerm.toLowerCase();
  let score = 0;
  if (title.includes(term)) score += 40;
  const termTokens = term.split(/\s+/).filter((t) => t.length > 2);
  for (const token of termTokens) {
    if (title.includes(token)) score += 8;
  }
  if (DELI_PREPARED_RE.test(productTitle)) score -= 35;
  if (FRESH_RAW_RE.test(productTitle)) score += 12;
  return score;
}
