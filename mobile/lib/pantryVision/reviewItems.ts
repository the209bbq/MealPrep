import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  parseVisionStorageField,
  suggestStorageLocationForPantryItem,
  type PantryStorageLocation,
} from '../../config/pantryStorage';
import type { PantryCategory, PantryItem, Recipe } from '../../types/mealprep';
import { buildIngredientCatalog, matchDetectionToCatalog } from './matchIngredients';
import type { PantryScanReviewItem, PantryVisionDetection } from './types';

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

export function detectionsToReviewItems(
  detections: PantryVisionDetection[],
  pantry: PantryItem[],
  recipes: Recipe[],
  photoUri: string | null,
  isDemoSample: boolean,
  scanHint: PantryStorageLocation = DEFAULT_PANTRY_STORAGE_LOCATION,
): PantryScanReviewItem[] {
  const catalog = buildIngredientCatalog(pantry, recipes);
  const stamp = Date.now();
  return detections.map((detection, index) => {
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
    };
  });
}

export function reviewItemsToPantryItems(items: PantryScanReviewItem[]): PantryItem[] {
  const now = new Date().toISOString();
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
