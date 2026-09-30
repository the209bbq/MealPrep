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
    return {
      key: `review-${stamp}-${index}`,
      enabled: true,
      name: match.name,
      quantity: detection.quantity,
      unit: match.unit,
      category: match.category,
      confidence: detection.confidence,
      ingredientId: match.ingredientId,
      location: 'Pantry scan',
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
      location: item.location.trim() || 'Pantry scan',
      photoUri: item.photoUri,
      expiresOn: null,
      updatedAt: now,
    }));
}
