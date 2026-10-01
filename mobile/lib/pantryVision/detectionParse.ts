import {
  canonicalIngredientPhrase,
  fuzzyNameScore,
  ingredientMatchScore,
} from '../recipeMatch/ingredientNormalize';
import type { PantryCategory } from '../../types/mealprep';

/** Raw row shape from pantry-vision (before client post-process). */
export interface PantryVisionDetectionRow {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  confidence: number;
  storage?: string;
}

const PANTRY_CATEGORIES = new Set<string>([
  'spices',
  'meats',
  'produce',
  'dairy',
  'dry_goods',
  'cookware',
  'frozen',
  'condiments',
]);

const DEFAULT_MAX_ITEMS = 120;
const LOW_CONFIDENCE_THRESHOLD = 0.55;

function titleCaseToken(token: string): string {
  if (!token) return token;
  if (token.length <= 3 && token === token.toUpperCase()) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/** Human-readable label from normalized phrase (keeps specifics like "chicken breast"). */
export function formatDetectedIngredientName(rawName: string): string {
  const trimmed = rawName.replace(/\[demo sample\]/gi, '').trim();
  if (!trimmed) return rawName.trim();
  const phrase = canonicalIngredientPhrase(trimmed);
  if (!phrase) return trimmed;
  return phrase.split(' ').map(titleCaseToken).join(' ');
}

export function detectionIdentityKey(name: string): string {
  const withoutApostrophe = name.toLowerCase().replace(/'/g, '');
  const phrase = canonicalIngredientPhrase(withoutApostrophe);
  return phrase || withoutApostrophe.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parsePantryVisionPayload(
  raw: unknown,
  options?: { maxItems?: number },
): PantryVisionDetectionRow[] {
  const maxItems = options?.maxItems ?? DEFAULT_MAX_ITEMS;
  if (!raw || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  const out: PantryVisionDetectionRow[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    const quantity = Number(row.quantity);
    const unit = typeof row.unit === 'string' ? row.unit.trim() || 'each' : 'each';
    const categoryRaw = typeof row.category === 'string' ? row.category : 'dry_goods';
    const category = PANTRY_CATEGORIES.has(categoryRaw)
      ? (categoryRaw as PantryCategory)
      : ('dry_goods' as PantryCategory);
    const confidence = Number(row.confidence);
    const storage = typeof row.storage === 'string' ? row.storage : undefined;
    out.push({
      name: name.slice(0, 120),
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.min(quantity, 9999) : 1,
      unit: unit.slice(0, 32),
      category,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
      storage,
    });
  }
  return stableSortDetections(out).slice(0, maxItems);
}

/** Deterministic ordering for stable merges, caches, and tests. */
export function stableSortDetections<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => detectionIdentityKey(a.name).localeCompare(detectionIdentityKey(b.name)));
}

function pickBetterName(a: string, b: string): string {
  const scoreLength = (n: string) => n.trim().length;
  if (scoreLength(a) !== scoreLength(b)) return scoreLength(a) > scoreLength(b) ? a : b;
  return a.localeCompare(b) <= 0 ? a : b;
}

function mergeRowPair(
  existing: PantryVisionDetectionRow,
  incoming: PantryVisionDetectionRow,
): PantryVisionDetectionRow {
  const sameUnit = existing.unit.toLowerCase() === incoming.unit.toLowerCase();
  const quantity = sameUnit ? existing.quantity + incoming.quantity : Math.max(existing.quantity, incoming.quantity);
  const rawName = pickBetterName(existing.name, incoming.name);
  return {
    name: rawName,
    quantity,
    unit: existing.unit || incoming.unit,
    category: existing.confidence >= incoming.confidence ? existing.category : incoming.category,
    confidence: Math.max(existing.confidence, incoming.confidence),
    storage: existing.storage ?? incoming.storage,
  };
}

/** Collapse duplicate products (synonym / fuzzy) into one row. */
export function dedupeDetections(items: PantryVisionDetectionRow[]): PantryVisionDetectionRow[] {
  const sorted = stableSortDetections(items);

  const merged: PantryVisionDetectionRow[] = [];
  for (const row of sorted) {
    const key = detectionIdentityKey(row.name);
    let matchIndex = -1;
    for (let i = 0; i < merged.length; i += 1) {
      const other = merged[i];
      const otherKey = detectionIdentityKey(other.name);
      if (key === otherKey) {
        matchIndex = i;
        break;
      }
      if (ingredientMatchScore(row.name, other.name) >= 1 || fuzzyNameScore(row.name, other.name) >= 0.92) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex >= 0) {
      merged[matchIndex] = mergeRowPair(merged[matchIndex], row);
    } else {
      merged.push(row);
    }
  }
  return stableSortDetections(
    merged.map((row) => ({
      ...row,
      name: formatDetectedIngredientName(row.name),
    })),
  );
}

/** Union two model passes (enumerate + verify) without dropping items. */
export function mergeDetectionPasses(
  passA: PantryVisionDetectionRow[],
  passB: PantryVisionDetectionRow[],
): PantryVisionDetectionRow[] {
  return dedupeDetections([...passA, ...passB]);
}

export function isLowConfidenceDetection(confidence: number): boolean {
  return confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function dropJunkDetections(
  items: PantryVisionDetectionRow[],
  options?: { minConfidence?: number },
): { kept: PantryVisionDetectionRow[]; droppedCount: number } {
  const minConfidence = options?.minConfidence ?? 0.25;
  const kept: PantryVisionDetectionRow[] = [];
  let droppedCount = 0;
  for (const row of items) {
    if (row.confidence < minConfidence) {
      droppedCount += 1;
      continue;
    }
    kept.push(row);
  }
  return { kept, droppedCount };
}

export { LOW_CONFIDENCE_THRESHOLD };
