import { normalizeUnit } from '../units/conversion';

const UNPRICEABLE_NAME_RE =
  /\b(to taste|as needed|for garnish|optional|water|ice)\b|^\s*salt\s*$/i;

const PINCH_ONLY_RE = /^\s*pinch\b/i;

export function isUnpriceableIngredient(name: string, quantity: number, unit: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (UNPRICEABLE_NAME_RE.test(trimmed)) return true;
  const u = normalizeUnit(unit);
  if ((u === 'pinch' || u === 'pinches' || PINCH_ONLY_RE.test(trimmed)) && quantity <= 0) {
    return true;
  }
  if (/^\s*salt\b/i.test(trimmed) && /to taste/i.test(trimmed)) return true;
  return false;
}
