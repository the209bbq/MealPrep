import {
  DEFAULT_PANTRY_STORAGE_LOCATION,
  suggestStorageLocationForCategory,
} from '../../config/pantryStorage';
import type { PantryItem, Recipe } from '../../types/mealprep';
import { buildIngredientCatalog, matchDetectionToCatalog } from './matchIngredients';
import type { PantryScanReviewItem, PantryVisionDetection } from './types';

export function detectionsToReviewItems(
  detections: PantryVisionDetection[],
  pantry: PantryItem[],
  recipes: Recipe[],
  photoUri: string | null,
  isDemoSample: boolean,
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
      location: suggestStorageLocationForCategory(category),
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
    location: suggestStorageLocationForCategory(item.category),
  }));
}
