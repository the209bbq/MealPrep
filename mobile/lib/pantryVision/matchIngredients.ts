import type { PantryCategory, PantryItem, Recipe } from '../../types/mealprep';
import type { PantryScanReviewItem, PantryVisionDetection } from './types';

export interface IngredientCatalogEntry {
  ingredientId: string;
  name: string;
  category: PantryCategory;
  defaultUnit: string;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[demo sample\]/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugIngredientId(name: string): string {
  const slug = normalizeName(name).replace(/\s+/g, '-');
  return slug || 'ingredient';
}

export function buildIngredientCatalog(pantry: PantryItem[], recipes: Recipe[]): IngredientCatalogEntry[] {
  const map = new Map<string, IngredientCatalogEntry>();

  for (const item of pantry) {
    map.set(item.ingredientId, {
      ingredientId: item.ingredientId,
      name: item.name,
      category: item.category,
      defaultUnit: item.unit,
    });
  }

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      if (!map.has(ing.ingredientId)) {
        map.set(ing.ingredientId, {
          ingredientId: ing.ingredientId,
          name: ing.name,
          category: 'dry_goods',
          defaultUnit: ing.unit,
        });
      }
    }
  }

  return [...map.values()];
}

function scoreMatch(detectionName: string, candidateName: string): number {
  const a = normalizeName(detectionName);
  const b = normalizeName(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const aTokens = new Set(a.split(' '));
  const bTokens = b.split(' ').filter((t) => aTokens.has(t));
  if (bTokens.length === 0) return 0;
  return Math.min(0.8, bTokens.length / Math.max(aTokens.size, 1));
}

export function matchDetectionToCatalog(
  detection: PantryVisionDetection,
  catalog: IngredientCatalogEntry[],
): { ingredientId: string; name: string; category: PantryCategory; unit: string } {
  let best: IngredientCatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of catalog) {
    const score = scoreMatch(detection.name, entry.name);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best && bestScore >= 0.72) {
    return {
      ingredientId: best.ingredientId,
      name: best.name,
      category: best.category,
      unit: detection.unit.trim() || best.defaultUnit,
    };
  }

  return {
    ingredientId: slugIngredientId(detection.name),
    name: detection.name.replace(/^\[demo sample\]\s*/i, '').trim() || detection.name,
    category: detection.category,
    unit: detection.unit.trim() || 'each',
  };
}

export function mergeReviewItems(items: PantryScanReviewItem[], keysToMerge: string[]): PantryScanReviewItem[] {
  if (keysToMerge.length < 2) return items;
  const mergeSet = new Set(keysToMerge);
  const merging = items.filter((item) => mergeSet.has(item.key));
  if (merging.length < 2) return items;

  const primary = merging[0];
  const sameUnit = merging.every((m) => m.unit === primary.unit);
  const mergedQuantity = sameUnit ? merging.reduce((sum, m) => sum + m.quantity, 0) : primary.quantity;

  const kept = items.filter((item) => !mergeSet.has(item.key));

  return [
    ...kept,
    {
      ...primary,
      quantity: mergedQuantity,
      enabled: merging.some((m) => m.enabled),
    },
  ];
}
