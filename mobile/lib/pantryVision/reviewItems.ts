import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  parseVisionStorageField,
  suggestStorageLocationForPantryItem,
  type PantryStorageLocation,
} from '../../config/pantryStorage';
import type { PantryCategory, PantryItem, Recipe } from '../../types/mealprep';
import { areSameIngredientForPantryDedupe } from '../recipeMatch/ingredientNormalize';
import {
  dedupeDetections,
  dropJunkDetections,
  isLowConfidenceDetection,
  mergeDetectionPasses,
  type PantryVisionDetectionRow,
} from './detectionParse';
import { buildIngredientCatalog, matchDetectionToCatalog } from './matchIngredients';
import type { PantryScanReviewItem, PantryVisionDetection } from './types';
import { formatDetectedIngredientName } from './detectionParse';

/** Per-item storage: vision field, then keyword auto-sort (can differ from scan hint), else scan hint. */
export function resolveReviewItemStorage(
  detection: PantryVisionDetection,
  name: string,
  category: PantryCategory,
  scanHint: PantryStorageLocation,
): PantryStorageLocation {
  const fromVision = parseVisionStorageField(detection.storage);
  if (fromVision) return fromVision;
  const auto = suggestStorageLocationForPantryItem(name, category);
  if (auto !== scanHint) return auto;
  return scanHint;
}

/** Drop detections that already match something in the user's pantry (by id or normalized name). */
export function filterDetectionsNotAlreadyInPantry(
  detections: PantryVisionDetection[],
  pantry: PantryItem[],
): PantryVisionDetection[] {
  if (pantry.length === 0) return detections;
  const pantryCatalog = buildIngredientCatalog(pantry, []);
  return detections.filter((detection) => {
    const match = matchDetectionToCatalog(detection, pantryCatalog);
    for (const item of pantry) {
      if (item.ingredientId === match.ingredientId) return false;
      if (areSameIngredientForPantryDedupe(item.name, match.name)) return false;
    }
    return true;
  });
}

export function normalizeDetectionsForReview(
  detections: PantryVisionDetection[],
  extraPass?: PantryVisionDetection[],
): PantryVisionDetection[] {
  const rows: PantryVisionDetectionRow[] = detections.map((d) => ({
    name: d.name,
    quantity: d.quantity,
    unit: d.unit,
    category: d.category,
    confidence: d.confidence,
    storage: d.storage,
  }));
  const extraRows: PantryVisionDetectionRow[] = (extraPass ?? []).map((d) => ({
    name: d.name,
    quantity: d.quantity,
    unit: d.unit,
    category: d.category,
    confidence: d.confidence,
    storage: d.storage,
  }));

  const merged = extraPass?.length ? mergeDetectionPasses(rows, extraRows) : dedupeDetections(rows);
  const { kept } = dropJunkDetections(merged);
  return kept.map((row) => ({
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    confidence: row.confidence,
    storage: row.storage,
  }));
}

export function detectionsToReviewItems(
  detections: PantryVisionDetection[],
  pantry: PantryItem[],
  recipes: Recipe[],
  photoUri: string | null,
  isDemoSample: boolean,
  scanHint: PantryStorageLocation = DEFAULT_PANTRY_STORAGE_LOCATION,
): PantryScanReviewItem[] {
  const normalized = filterDetectionsNotAlreadyInPantry(
    normalizeDetectionsForReview(detections),
    pantry,
  );
  const catalog = buildIngredientCatalog(pantry, recipes);
  const stamp = Date.now();
  return normalized.map((detection, index) => {
    const match = matchDetectionToCatalog(detection, catalog);
    const category = match.category;
    return {
      key: `review-${stamp}-${index}`,
      enabled: true,
      name: match.name,
      quantity: detection.quantity,
      unit: match.unit,
      category,
      confidence: detection.confidence,
      ingredientId: match.ingredientId,
      location: resolveReviewItemStorage(detection, match.name, category, scanHint),
      photoUri,
      isDemoSample,
      needsReview: isLowConfidenceDetection(detection.confidence),
      sourceAiName: match.name,
      addedManually: false,
    };
  });
}

export function createManualPantryReviewItem(
  name: string,
  pantry: PantryItem[],
  recipes: Recipe[],
  photoUri: string | null,
  scanHint: PantryStorageLocation = DEFAULT_PANTRY_STORAGE_LOCATION,
): PantryScanReviewItem {
  const trimmed = formatDetectedIngredientName(name);
  const catalog = buildIngredientCatalog(pantry, recipes);
  const detection: PantryVisionDetection = {
    name: trimmed,
    quantity: 1,
    unit: 'each',
    category: 'dry_goods',
    confidence: 1,
  };
  const match = matchDetectionToCatalog(detection, catalog);
  const category = match.category;
  return {
    key: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    name: match.name,
    quantity: 1,
    unit: match.unit,
    category,
    confidence: 1,
    ingredientId: match.ingredientId,
    location: suggestStorageLocationForPantryItem(match.name, category) || scanHint,
    photoUri,
    isDemoSample: false,
    needsReview: false,
    sourceAiName: null,
    addedManually: true,
  };
}

export function registerAiBaselineEntries(
  items: PantryScanReviewItem[],
  baseline: Map<string, { aiName: string }>,
): void {
  for (const item of items) {
    const aiName = item.sourceAiName?.trim();
    if (!aiName) continue;
    if (!baseline.has(item.key)) {
      baseline.set(item.key, { aiName });
    }
  }
}

/** Merge a second scan into existing review rows (scan again). */
export function mergeSecondScanIntoReview(
  existing: PantryScanReviewItem[],
  newDetections: PantryVisionDetection[],
  pantry: PantryItem[],
  recipes: Recipe[],
  scanHint: PantryStorageLocation,
): PantryScanReviewItem[] {
  const fresh = detectionsToReviewItems(newDetections, pantry, recipes, existing[0]?.photoUri ?? null, false, scanHint);
  const byIngredient = new Map<string, PantryScanReviewItem>();
  for (const row of existing) {
    byIngredient.set(row.ingredientId, row);
  }
  for (const row of fresh) {
    const prior = byIngredient.get(row.ingredientId);
    if (!prior) {
      byIngredient.set(row.ingredientId, row);
      continue;
    }
    const sameUnit = prior.unit === row.unit;
    byIngredient.set(row.ingredientId, {
      ...prior,
      quantity: sameUnit ? prior.quantity + row.quantity : Math.max(prior.quantity, row.quantity),
      confidence: Math.max(prior.confidence, row.confidence),
      needsReview: prior.needsReview || row.needsReview,
      enabled: prior.enabled || row.enabled,
    });
  }
  return [...byIngredient.values()];
}

export function reviewItemsToPantryItems(
  items: PantryScanReviewItem[],
  scanPhotoPath?: string | null,
): PantryItem[] {
  const now = new Date().toISOString();
  const path = scanPhotoPath?.trim() || null;
  return items
    .filter((item) => item.enabled && item.name.trim().length > 0)
    .map((item, index) => ({
      id: `scan-${now}-${index}`,
      ingredientId: item.ingredientId,
      name: item.name.trim(),
      category: item.category,
      quantity: item.quantity,
      unit: item.unit.trim() || 'each',
      location: item.location ?? DEFAULT_PANTRY_STORAGE_LOCATION,
      photoUri: item.photoUri,
      scanPhotoPath: path,
      expiresOn: null,
      updatedAt: now,
    }));
}

export function applyBatchStorageLocation(
  items: PantryScanReviewItem[],
  location: PantryScanReviewItem['location'],
): PantryScanReviewItem[] {
  return items.map((item) => ({ ...item, location }));
}

export function applyCategoryDefaultsToReviewLocations(items: PantryScanReviewItem[]): PantryScanReviewItem[] {
  return items.map((item) => ({
    ...item,
    location: suggestStorageLocationForPantryItem(item.name, item.category),
  }));
}
