import { normalizeIngredientName } from '../recipeMatch/normalize';

const UNPRICEABLE_NAME_RE =
  /\b(water|ice cubes?|boiling water|cold water|warm water|garnish|for garnish|as needed|to taste)\b/i;

const SKIP_WHEN_VAGUE_RE = /\b(salt|pepper|black pepper|white pepper|sea salt|kosher salt)\b/i;

const VAGUE_UNITS = new Set([
  'pinch',
  'pinches',
  'dash',
  'dashes',
  'handful',
  'handfuls',
  'splash',
  'to taste',
  'as needed',
  'optional',
]);

export function isUnpriceableIngredient(
  name: string,
  quantity: number,
  unit: string,
): boolean {
  const raw = name.trim();
  if (!raw) return true;
  if (UNPRICEABLE_NAME_RE.test(raw)) return true;
  if (/\bto taste\b/i.test(raw) || /\bas needed\b/i.test(raw)) return true;

  const u = unit.trim().toLowerCase();
  if (u && VAGUE_UNITS.has(u)) return true;

  const normalized = normalizeIngredientName(raw);
  if (!normalized) return true;
  if (normalized === 'water' || normalized === 'ice') return true;

  if (SKIP_WHEN_VAGUE_RE.test(normalized)) {
    if (!Number.isFinite(quantity) || quantity <= 0) return true;
    if (!u || VAGUE_UNITS.has(u)) return true;
  }

  return false;
}
