import { parseMealDbMeasure } from '../mealdb/parseMeasure';
import type { RecipeIngredient } from '../../types/mealprep';

const EMBEDDED_QTY_RE =
  /^([\d./\s]+)?\s*(fl\s+oz|tbsp|tsp|cup|cups|oz|lb|g|kg|ml|l|clove|cloves|can|cans|bunch|pinch|each)?\s*(.*)$/i;

function parseFractionQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/')) {
    const [a, b] = trimmed.split('/').map((p) => Number.parseFloat(p.trim()));
    if (a && b) return a / b;
  }
  const n = Number.parseFloat(trimmed.replace(/\s+/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Resolve quantity + unit from structured fields or embedded text in the name. */
export function resolvedIngredientAmount(ing: RecipeIngredient): {
  quantity: number;
  unit: string;
  name: string;
} {
  let quantity = ing.quantity;
  let unit = ing.unit?.trim() ?? '';
  let name = ing.name.trim().replace(/\s*\(optional\)\s*$/i, '').trim();

  if (quantity > 0 && unit) {
    return { quantity, unit, name };
  }

  const combined = [quantity > 0 ? String(quantity) : '', unit, name].filter(Boolean).join(' ').trim();
  const mealDb = parseMealDbMeasure(combined);
  if (mealDb.quantity > 0 && mealDb.unit) {
    return { quantity: mealDb.quantity, unit: mealDb.unit, name };
  }

  const embedded = EMBEDDED_QTY_RE.exec(name);
  if (embedded) {
    const qtyRaw = (embedded[1] ?? '').trim();
    const unitRaw = (embedded[2] ?? '').trim();
    const rest = (embedded[3] ?? '').trim();
    const parsedQty = parseFractionQty(qtyRaw);
    if (parsedQty !== null && parsedQty > 0) {
      return {
        quantity: parsedQty,
        unit: unitRaw || 'each',
        name: rest || name,
      };
    }
  }

  if (quantity > 0) {
    return { quantity, unit: unit || 'each', name };
  }

  return { quantity: 0, unit, name };
}
