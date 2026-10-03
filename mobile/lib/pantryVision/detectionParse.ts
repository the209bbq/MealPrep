import {
  areSameIngredientForPantryDedupe,
  canonicalIngredientPhrase,
} from '../recipeMatch/ingredientNormalize';
import type { PantryCategory } from '../../types/mealprep';
import {
  dedupePantryRows,
  mergePantryPasses,
  mergePantryRowPair,
  type PantryMergeIdentity,
} from './pantryItemMerge';

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

const CLIENT_PANTRY_MERGE_IDENTITY: PantryMergeIdentity = {
  identityKey: detectionIdentityKey,
  rowsMatch: areSameIngredientForPantryDedupe,
};

function finalizeDetectionRow(row: PantryVisionDetectionRow): PantryVisionDetectionRow {
  return {
    ...row,
    name: formatDetectedIngredientName(row.name),
  };
}

function mergeDetectionRows(
  existing: PantryVisionDetectionRow,
  incoming: PantryVisionDetectionRow,
): PantryVisionDetectionRow {
  const merged = mergePantryRowPair(existing, incoming);
  return {
    ...merged,
    category: existing.confidence >= incoming.confidence ? existing.category : incoming.category,
    storage: existing.storage ?? incoming.storage,
  };
}

/** Collapse duplicate products (synonym / fuzzy) into one row. */
export function dedupeDetections(items: PantryVisionDetectionRow[]): PantryVisionDetectionRow[] {
  const sorted = stableSortDetections(items);
  const merged: PantryVisionDetectionRow[] = [];
  for (const row of sorted) {
    let matchIndex = -1;
    for (let i = 0; i < merged.length; i += 1) {
      const other = merged[i];
      if (
        detectionIdentityKey(row.name) === detectionIdentityKey(other.name) ||
        CLIENT_PANTRY_MERGE_IDENTITY.rowsMatch(row.name, other.name)
      ) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex >= 0) {
      merged[matchIndex] = mergeDetectionRows(merged[matchIndex], row);
    } else {
      merged.push(row);
    }
  }
  return stableSortDetections(merged.map(finalizeDetectionRow));
}

/** Union two model passes (enumerate + verify) without dropping items. */
export function mergeDetectionPasses(
  passA: PantryVisionDetectionRow[],
  passB: PantryVisionDetectionRow[],
): PantryVisionDetectionRow[] {
  const combined = mergePantryPasses(passA, passB, CLIENT_PANTRY_MERGE_IDENTITY);
  return stableSortDetections(
    combined.map((row) => {
      const fromA = passA.find((p) => CLIENT_PANTRY_MERGE_IDENTITY.rowsMatch(p.name, row.name));
      const fromB = passB.find((p) => CLIENT_PANTRY_MERGE_IDENTITY.rowsMatch(p.name, row.name));
      return finalizeDetectionRow({
        ...row,
        category: fromA && fromB
          ? fromA.confidence >= fromB.confidence
            ? fromA.category
            : fromB.category
          : (fromA ?? fromB ?? row).category,
        storage: fromA?.storage ?? fromB?.storage,
      });
    }),
  );
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
