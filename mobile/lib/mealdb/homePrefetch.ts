import { MEALDB } from '../../config/mealdb';
import { HOME_CLASSIC_CATEGORY_CHIPS } from '../../config/recipesTabSurface';
import type { MealDbCatalogCategory } from '../../config/recipesTabSurface';
import { mapWithConcurrency } from '../concurrency';
import type { PantryItem } from '../../types/mealprep';
import {
  fetchCreatorChannelVideos,
  fetchCreatorFeed,
  fetchCreatorList,
} from '../creatorVideos/client';
import { compareCreatorsByFitAndSubscribers } from '../creatorVideos/fitOrder';
import { fetchMealDbCategoryFeedRows } from './categories';

export interface HomeRecipePrefetchInput {
  pantry: PantryItem[];
  accessToken: string | null;
  categories?: readonly MealDbCatalogCategory[];
  /** When set, prefetch channel videos for these ids (e.g. visible rotation slots). */
  creatorChannelIds?: readonly string[];
  /** When true, warm filter.php lists only (no meal lookups). */
  listOnly?: boolean;
}

let prefetchGeneration = 0;
let prefetchInFlight: Promise<void> | null = null;
let scheduledForGeneration: number | null = null;

export function resetHomeRecipePrefetchForTests(): void {
  prefetchGeneration += 1;
  prefetchInFlight = null;
  scheduledForGeneration = null;
}

export async function runHomeRecipePrefetch(input: HomeRecipePrefetchInput): Promise<void> {
  const generation = prefetchGeneration;
  if (prefetchInFlight) return prefetchInFlight;

  const categories = input.categories ?? HOME_CLASSIC_CATEGORY_CHIPS;
  const detailLimit = MEALDB.homeCategoryPrefetchMealCount;

  prefetchInFlight = (async () => {
    await mapWithConcurrency(
      categories,
      MEALDB.homeCategoryPrefetchConcurrency,
      async (category) => {
        if (generation !== prefetchGeneration) return;
        await fetchMealDbCategoryFeedRows(category, input.pantry, {
          detailLimit,
          lookupConcurrency: MEALDB.homePrefetchLookupConcurrency,
          listOnly: input.listOnly,
        });
      },
    );

    if (generation !== prefetchGeneration) return;

    try {
      const creators = await fetchCreatorList(input.accessToken);
      const sorted = [...creators].sort(compareCreatorsByFitAndSubscribers);
      await fetchCreatorFeed('popular', input.accessToken);

      const channelIds =
        input.creatorChannelIds?.length
          ? input.creatorChannelIds
          : sorted.slice(0, 3).map((row) => row.youtubeChannelId);

      await mapWithConcurrency(channelIds, 2, async (channelId) => {
        if (generation !== prefetchGeneration || !channelId) return;
        await fetchCreatorChannelVideos(channelId, input.accessToken);
      });
    } catch {
      // Prefetch is best-effort; home still loads on demand.
    }
  })().finally(() => {
    prefetchInFlight = null;
  });

  return prefetchInFlight;
}

/** Prefetch a single category (e.g. on bubble press-in). */
export function prefetchMealDbCategoryOnIntent(
  category: MealDbCatalogCategory,
  pantry: PantryItem[],
): Promise<void> {
  return fetchMealDbCategoryFeedRows(category, pantry, {
    detailLimit: MEALDB.homeCategoryPrefetchMealCount,
    lookupConcurrency: MEALDB.homePrefetchLookupConcurrency,
  }).then(() => undefined);
}

export function scheduleHomeRecipePrefetch(input: HomeRecipePrefetchInput): void {
  const generation = prefetchGeneration;
  if (scheduledForGeneration === generation) return;
  scheduledForGeneration = generation;

  const run = () => {
    if (generation !== prefetchGeneration) return;
    void runHomeRecipePrefetch(input);
  };

  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(run, { timeout: 4_000 });
    return;
  }
  setTimeout(run, 300);
}
