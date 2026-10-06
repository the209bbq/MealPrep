import { MEALDB } from '../../config/mealdb';
import { HOME_CLASSIC_CATEGORY_CHIPS } from '../../config/recipesTabSurface';
import { listStorageKeysWithPrefix, removeStorageKey } from '../storage';
import { clearAllMealDbCatalogSnapshots } from './catalogCache';
import { clearAllMealDbCategoryFeedSnapshots } from './categoryFeedCache';
import { clearAllMealDbCategoryListSnapshots } from './categoryListCache';
import {
  invalidateMealDbClientCacheForHomeRefresh,
  invalidateMealDbListClientCacheForHomeRefresh,
  revalidateStaleMealDbPaths,
} from './client';

export function clearMealDbHomeRecipeStorageCaches(): void {
  clearAllMealDbCategoryListSnapshots();
  clearAllMealDbCategoryFeedSnapshots();
  clearAllMealDbCatalogSnapshots();
  const prefix = `${MEALDB.cacheKeyPrefix}:`;
  for (const key of listStorageKeysWithPrefix(prefix)) {
    const suffix = key.slice(prefix.length);
    if (
      suffix.startsWith('category-list:') ||
      suffix.startsWith('category:') ||
      suffix.startsWith('catalog:')
    ) {
      removeStorageKey(key);
    }
  }
  for (const category of HOME_CLASSIC_CATEGORY_CHIPS) {
    removeStorageKey(`${MEALDB.cacheKeyPrefix}:category-list:${category}`);
  }
}

export function invalidateMealDbHomeRecipeCaches(): void {
  clearMealDbHomeRecipeStorageCaches();
  invalidateMealDbClientCacheForHomeRefresh();
}

export function clearMealDbHomeCategoryListCachesOnly(): void {
  clearAllMealDbCategoryListSnapshots();
  invalidateMealDbListClientCacheForHomeRefresh();
}

export function mealDbHomeStaleRevalidatePaths(): string[] {
  const paths = ['categories.php'];
  for (const category of HOME_CLASSIC_CATEGORY_CHIPS) {
    paths.push(`filter.php?c=${encodeURIComponent(category)}`);
  }
  return paths;
}

export function revalidateStaleMealDbHomeCachesOnOpen(): void {
  revalidateStaleMealDbPaths(mealDbHomeStaleRevalidatePaths());
}
