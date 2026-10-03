import { THEME } from './theme';

/** List + detail hero aspect ratio (width / height). */
export const RECIPE_IMAGE_ASPECT_RATIO = 16 / 9;

/** Fixed height for list thumbnails (avoids layout shift with aspect ratio). */
export const RECIPE_LIST_IMAGE_HEIGHT = 148;

export const RECIPE_IMAGE = {
  aspectRatio: RECIPE_IMAGE_ASPECT_RATIO,
  listHeight: RECIPE_LIST_IMAGE_HEIGHT,
  placeholderGradient: [THEME.primaryLight, THEME.paper] as const,
  transitionMs: 200,
} as const;
